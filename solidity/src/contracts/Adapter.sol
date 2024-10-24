// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IPAM} from "../interfaces/IPAM.sol";
import {IAdapter} from "../interfaces/IAdapter.sol";
import {IPReceiver} from "../interfaces/IPReceiver.sol";
import {XERC20} from "./XERC20.sol";
import {XERC20Lockbox} from "./XERC20Lockbox.sol";
import {ExcessivelySafeCall} from "../libraries/ExcessivelySafeCall.sol";

contract Adapter is IAdapter, Ownable, ReentrancyGuard {
    using ExcessivelySafeCall for address;

    uint256 public constant FEE_BASIS_POINTS = 1750;
    uint256 public constant FEE_DIVISOR = 1000000; // 4 decimals for basis point * 2 decimals for percentage
    bytes32 public constant SWAP_EVENT_TOPIC0 = 
        bytes32(0x66756E6473206172652073616675207361667520736166752073616675202E2E); // swap event custom topic0

    uint256 public nonce;
    address public immutable erc20;
    address public immutable xerc20;
    address public feesManager;
    address public pam;
    uint256 public minFee;
    mapping(bytes32 => bool) public pastEvents;

    constructor(
        address xerc20_,
        address erc20_,
        address feesManager_,
        address pam_
    ) Ownable(msg.sender) {
        erc20 = erc20_;
        xerc20 = xerc20_;
        feesManager = feesManager_;
        pam = pam_;
    }

    function setFeesManager(address feesManager_) external onlyOwner {
        feesManager = feesManager_;

        emit FeesManagerChanged(feesManager_);
    }

    function setPAM(address pam_) external onlyOwner {
        pam = pam_;
        emit PAMChanged(pam_);
    }

    /// @inheritdoc IAdapter
    function settle(
        Operation memory operation,
        IPAM.Metadata calldata metadata
    ) external nonReentrant {
        if (operation.erc20 != bytes32(abi.encode(erc20)))
            revert InvalidOperation();

        (bool isAuthorized, bytes32 eventId) = IPAM(pam).isAuthorized(
            operation,
            metadata
        );

        if (!isAuthorized) revert Unauthorized(eventId);

        if (pastEvents[eventId]) revert AlreadyProcessed(eventId);

        pastEvents[eventId] = true;

        address payable lockbox = payable(XERC20(xerc20).lockbox());

        if (operation.amount > 0) {
            if (lockbox != address(0)) {
                // Local chain only
                XERC20(xerc20).mint(address(this), operation.amount);

                IERC20(xerc20).approve(lockbox, operation.amount);
                XERC20Lockbox(lockbox).withdrawTo(
                    operation.recipient,
                    operation.amount
                );
            } else {
                XERC20(xerc20).mint(operation.recipient, operation.amount);
            }
        }

        if (operation.data.length > 0) {
            // pNetwork aims to deliver cross chain messages successfully regardless of what the user may do with them.
            // We do not want this mint transaction reverting if their receiveUserData function reverts,
            // and thus we swallow any such errors, emitting a `ReceiveUserDataFailed` event instead.
            // This way, a user also has the option include userData even when minting to an externally owned account.
            // Here excessivelySafeCall executes a low-level call which does not revert the caller transaction if
            // the callee reverts, with the increased protection for returnbombing, i.e. the returndata copy is
            // limited to 256 bytes.
            bytes memory data = abi.encodeWithSelector(
                IPReceiver.receiveUserData.selector,
                operation.data
            );
            uint256 gasReserve = 1000; // enough gas to ensure we eventually emit, and return

            (bool success, ) = operation.recipient.excessivelySafeCall(
                gasleft() - gasReserve,
                0,
                0,
                data
            );
            if (!success) emit ReceiveUserDataFailed();
        }

        emit Settled(eventId);
    }

    /// @inheritdoc IAdapter
    function swap(
        address token,
        uint256 amount,
        uint256 destinationChainId,
        string memory recipient,
        bytes memory data
    ) external payable {
        if (erc20 == address(0)) {
            _swapNative(destinationChainId, recipient, data);
        } else {
            _swapToken(token, amount, destinationChainId, recipient, data);
        }
    }

    /// @inheritdoc IAdapter
    function calculateFee(uint256 amount) public view returns (uint256) {
        uint256 fee = (amount * FEE_BASIS_POINTS) / FEE_DIVISOR;

        return fee < minFee ? minFee : fee;
    }

    function _swapToken(
        address token,
        uint256 amount,
        uint256 destinationChainId,
        string memory recipient,
        bytes memory data
    ) internal {
        if (token == address(0)) revert InvalidTokenAddress(token);
        if ((token != erc20) && (token != xerc20)) revert NotAllowed();
        if (amount <= 0) revert InvalidAmount();

        address payable lockbox = payable(XERC20(xerc20).lockbox());

        // Native swaps are not allowed within this fn,
        // use the swapNative one
        if (lockbox != address(0) && XERC20Lockbox(lockbox).IS_NATIVE())
            revert InvalidSwap();

        // We transfer the token (xERC20 or ERC20) to
        // this contract
        SafeERC20.safeTransferFrom(
            IERC20(token),
            msg.sender,
            address(this),
            amount
        );

        if (lockbox != address(0) && token == erc20) {
            // We are on the home chain: then we wrap the ERC20
            // to the relative xERC20
            IERC20(token).approve(lockbox, amount);
            XERC20Lockbox(lockbox).deposit(amount);
        }

        _finalizeSwap(amount, destinationChainId, recipient, data);
    }

    function _swapNative(
        uint256 destinationChainId,
        string memory recipient,
        bytes memory data
    ) internal {
        uint256 amount = msg.value;
        if (erc20 != address(0)) revert NotAllowed();
        if (amount == 0) revert InvalidAmount();

        address payable lockbox = payable(XERC20(xerc20).lockbox());

        // Lockbox must be native here
        if (lockbox != address(0) && !XERC20Lockbox(lockbox).IS_NATIVE())
            revert InvalidSwap();

        if (lockbox != address(0))
            // User wants to wrap Ether: we deposit it to the lockbox and get the
            // relative xERC20
            XERC20Lockbox(lockbox).depositNativeTo{value: amount}(
                address(this)
            );

        _finalizeSwap(amount, destinationChainId, recipient, data);
    }

    function _finalizeSwap(
        uint256 amount,
        uint256 destinationChainId,
        string memory recipient,
        bytes memory data
    ) internal {
        // At this point we control the xERC20 funds
        uint256 fees = calculateFee(amount);
        IERC20(xerc20).transfer(feesManager, fees);

        uint256 netAmount = amount - fees;
        XERC20(xerc20).burn(address(this), netAmount);

        bytes32 topic0 = SWAP_EVENT_TOPIC0;
        uint256 topic1 = nonce;
        bytes memory eventBytes = bytes.concat(
            bytes32(abi.encode(erc20)),
            bytes32(destinationChainId),
            bytes32(netAmount),
            bytes32(uint256(uint160(msg.sender))),
            bytes32(bytes(recipient).length),
            bytes(recipient),
            bytes32(bytes(data).length),
            data
        );
        assembly {
            // For memory bytes, skip the length prefix (32 bytes)
            let dataStart := add(eventBytes, 32)
            let length := mload(eventBytes)

            log2(
                dataStart,
                length,
                topic0,
                topic1
            )
        }

        unchecked {
            ++nonce;
        }
    }
}
