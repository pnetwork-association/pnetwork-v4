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

    address public registry;
    mapping(bytes32 => bool) public pastEvents;

    error Unauthorized();
    error InvalidSender();
    error InvalidEventRLP();
    error RLPInputTooLong();
    error InvalidTokenAddress(address token);
    error UnsupportedChainId(uint256 chainId);
    error UnexpectedEventTopic(bytes32 topic);
    error AlreadyProcessed(bytes32 operationId);
    error UnsupportedProtocolId(bytes1 protocolId);
    error InvalidEventContentLength(uint256 length);
    error UnsufficientAmount(uint256 amount, uint256 fees);
    error InvalidMessageId(uint256 actual, uint256 expected);
    error InvalidDestinationChainId(uint256 destinationChainId);

    constructor(address registry_) Ownable(msg.sender) {
        registry = registry_;
    }

    function settle(
        Operation memory operation,
        IPAM.Metadata calldata metadata
    ) external {
        (, address xerc20) = IXERC20Registry(registry).getAssets(
            operation.erc20
        );

        address pam = IXERC20(xerc20).getPAM(address(this));

        if (!IPAM(pam).isAuthorized(operation, metadata)) revert Unauthorized();

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

        emit Settled();
    }

    /**
     * @notice Wraps a token to another chain
     *
     * @dev Be sure the pair is registered in the local XERC20 registry
     *
     * @param token ERC20 or xERC20 to move across chains
     * @param amount token quantity to move across chains
     * @param recipient whom will receive the token
     * @param destinationChainId chain id where the wrapped version is destined to
     *
     * @dev If the destination chain id doesn't fit in 32 bytes or if there are collisions
     *      the options are one of the two:
     *        1) custom chain id (hardcoded on the PAM in the destination)
     *        2) sha256(chain id)
     *
     * @param data metadata
     */
    function swap(
        address token,
        uint256 amount,
        uint256 destinationChainId,
        string memory recipient,
        bytes memory data
    ) public payable {
        if (token == address(0)) revert InvalidTokenAddress(token);

        require(amount > 0 || token == address(0), "AmountLessThanZero");
        (bytes32 erc20Bytes, address xerc20) = IXERC20Registry(registry)
            .getAssets(token);

        address lockbox = IXERC20(xerc20).getLockbox();
        address erc20 = address(uint160(uint256(erc20Bytes)));

        if (lockbox != address(0) && IXERC20Lockbox(lockbox).IS_NATIVE()) {
            // User wants to wrap Ether: we deposit it to the lockbox and get the
            // relative xERC20
            IXERC20Lockbox(lockbox).depositNativeTo{value: amount}(
                address(this)
            );
        } else {
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
        }

        // At this point we control the xERC20 funds, some we'll go
        // to the fees manager within the burn() fn, so we approve
        // the correct quantity here
        address feesManager = IXERC20(xerc20).getFeesManager();
        uint256 fees = IFeesManager(feesManager).calculateFee(xerc20, amount);
        IERC20(xerc20).approve(feesManager, fees);

        // No need to substract the fees here, see the burn fn
        IXERC20(xerc20).burn(address(this), amount);

        emit Swap(
            _nonce,
            EventContent(
                _nonce,
                erc20Bytes,
                bytes32(destinationChainId), // We'll convert them to bytes32 off chain
                amount - fees,
                bytes32(abi.encodePacked(msg.sender)),
                recipient,
                data
            )
        );

        unchecked {
            ++_nonce;
        }
    }

    /**
     * @notice Wraps a token to another chain
     *
     * @dev Be sure the pair is registered in the local XERC20 registry
     *
     * @param token ERC20 or xERC20 to move across chains
     * @param amount token quantity to move across chains
     * @param recipient whom will receive the token
     * @param destinationChainId chain id where the wrapped version is destined to
     * (it may be a sha256 hash of the relevant ID of the chain (i.e. sha256 of the chain id for EOS))
     */
    function swap(
        address token,
        uint256 amount,
        uint256 destinationChainId,
        string calldata recipient
    ) public payable {
        swap(token, amount, destinationChainId, recipient, "");
    }
}
