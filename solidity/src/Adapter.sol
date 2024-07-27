// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {IPAM} from "./interfaces/IPAM.sol";
import {IPAM} from "./interfaces/IPAM.sol";
import {IXERC20} from "./interfaces/IXERC20.sol";
import {IAdapter} from "./interfaces/IAdapter.sol";
import {IPReceiver} from "./interfaces/IPReceiver.sol";
import {IFeesManager} from "./interfaces/IFeesManager.sol";
import {IXERC20Registry} from "./interfaces/IXERC20Registry.sol";
import {IXERC20Lockbox} from "./interfaces/IXERC20Lockbox.sol";
import {ExcessivelySafeCall} from "./libraries/ExcessivelySafeCall.sol";

contract Adapter is IAdapter, Ownable {
    using ExcessivelySafeCall for address;

    bytes32 public constant SWAP_EVENT_TOPIC =
        0x26d9f1fabb4e0554841202b52d725e2426dda2be4cafcb362eb73f9fb813d609;

    uint256 _nonce;

    address public erc20;
    address public xerc20;
    mapping(bytes32 => bool) public pastEvents;

    error NotAllowed();
    error InvalidSwap();
    error InvalidAmount();
    error InvalidSender();
    error RLPInputTooLong();
    error InvalidOperation();
    error InvalidFeesManager();
    error Unauthorized(bytes32 eventId);
    error InvalidTokenAddress(address token);
    error UnsupportedChainId(uint256 chainId);
    error UnexpectedEventTopic(bytes32 topic);
    error AlreadyProcessed(bytes32 operationId);
    error UnsupportedProtocolId(bytes1 protocolId);
    error InvalidEventContentLength(uint256 length);
    error UnsufficientAmount(uint256 amount, uint256 fees);
    error InvalidMessageId(uint256 actual, uint256 expected);
    error InvalidDestinationChainId(uint256 destinationChainId);

    constructor(address _xerc20, address _erc20) Ownable(msg.sender) {
        erc20 = _erc20;
        xerc20 = _xerc20;
    }

    /// @inheritdoc IAdapter
    // TODO: check reentrancy here
    function settle(
        Operation memory operation,
        IPAM.Metadata calldata metadata
    ) external {
        if (operation.erc20 != bytes32(abi.encode(erc20)))
            revert InvalidOperation();

        address pam = IXERC20(xerc20).getPAM(address(this));

        (bool isAuthorized, bytes32 eventId) = IPAM(pam).isAuthorized(
            operation,
            metadata
        );
        if (!isAuthorized) revert Unauthorized(eventId);

        if (pastEvents[eventId]) revert AlreadyProcessed(eventId);

        pastEvents[eventId] = true;

        address lockbox = IXERC20(xerc20).getLockbox();

        if (operation.amount > 0) {
            if (IXERC20(xerc20).isLocal()) {
                IXERC20(xerc20).mint(address(this), operation.amount);

                IERC20(xerc20).approve(lockbox, operation.amount);
                IXERC20Lockbox(lockbox).withdrawTo(
                    operation.recipient,
                    operation.amount
                );
            } else {
                IXERC20(xerc20).mint(operation.recipient, operation.amount);
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

    function _finalizeSwap(
        uint256 amount,
        uint256 destinationChainId,
        string memory recipient,
        bytes memory data
    ) internal {
        // At this point we control the xERC20 funds
        address feesManager = IXERC20(xerc20).getFeesManager();

        uint256 fees;
        if (feesManager != address(0)) {
            // Entering here means we are on the local chain, since
            // it's there where the fee manager is deployed
            // Some of the funds will go to the fees manager within the burn() fn,
            // so we approve the correct quantity here
            fees = IFeesManager(feesManager).calculateFee(xerc20, amount);
            IERC20(xerc20).approve(feesManager, fees);
        }

        // No need to substract the fees here, see the burn fn
        IXERC20(xerc20).burn(address(this), amount);

        emit Swap(
            _nonce,
            EventBytes(
                bytes.concat(
                    bytes32(_nonce),
                    bytes32(abi.encode(erc20)),
                    bytes32(destinationChainId),
                    bytes32(amount - fees),
                    bytes32(uint256(uint160(msg.sender))),
                    bytes32(bytes(recipient).length),
                    bytes(recipient),
                    data
                )
            )
        );

        unchecked {
            ++_nonce;
        }
    }

    /// @inheritdoc IAdapter
    function swap(
        address token,
        uint256 amount,
        uint256 destinationChainId,
        string memory recipient,
        bytes memory data
    ) public {
        if (token == address(0)) revert InvalidTokenAddress(token);
        if ((token != erc20) && (token != xerc20)) revert NotAllowed();
        if (amount <= 0) revert InvalidAmount();

        address lockbox = IXERC20(xerc20).getLockbox();

        // Native swaps are not allowed within this fn,
        // use the swapNative one
        if (lockbox != address(0) && IXERC20Lockbox(lockbox).IS_NATIVE())
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
            IXERC20Lockbox(lockbox).deposit(amount);
        }

        _finalizeSwap(amount, destinationChainId, recipient, data);
    }

    /// @inheritdoc IAdapter
    function swap(
        address token,
        uint256 amount,
        uint256 destinationChainId,
        string calldata recipient
    ) public {
        swap(token, amount, destinationChainId, recipient, "");
    }

    /// @inheritdoc IAdapter
    function swapNative(
        uint256 destinationChainId,
        string memory recipient,
        bytes memory data
    ) public payable {
        uint256 amount = msg.value;
        if (erc20 != address(0)) revert NotAllowed();
        if (amount == 0) revert InvalidAmount();

        address lockbox = IXERC20(xerc20).getLockbox();

        // Lockbox must be native here
        if (lockbox != address(0) && !IXERC20Lockbox(lockbox).IS_NATIVE())
            revert InvalidSwap();

        if (lockbox != address(0))
            // User wants to wrap Ether: we deposit it to the lockbox and get the
            // relative xERC20
            IXERC20Lockbox(lockbox).depositNativeTo{value: amount}(
                address(this)
            );

        _finalizeSwap(amount, destinationChainId, recipient, data);
    }

    /// @inheritdoc IAdapter
    function swapNative(
        uint256 destinationChainId,
        string memory recipient
    ) public payable {
        swapNative(destinationChainId, recipient, "");
    }
}
