// SPDX-License-Identifier: UNLICENSED
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

    address public registry;
    bytes32 public constant SWAP_EVENT_TOPIC =
        0x218247aabc759e65b5bb92ccc074f9d62cd187259f2a0984c3c9cf91f67ff7cf;
    mapping(bytes32 => bool) public pastEvents;

    error UnsufficientAmount(uint256 amount, uint256 fees);
    error AlreadyProcessed(bytes32 operationId);
    error InvalidEventRLP();
    error InvalidEventContentLength(uint256);
    error UnsupportedProtocolId(bytes1);
    error UnsupportedChainId(uint256);
    error UnexpectedEventTopic(bytes32);
    error InvalidSender();
    error InvalidMessageId(uint256, uint256);
    error InvalidDestinationChainId(uint256);
    error RLPInputTooLong();
    error Unauthorized();

    constructor(address registry_) Ownable(msg.sender) {
        registry = registry_;
    }

    /**
     * @notice Wraps a token to another chain
     *
     * @dev Be sure the pair is registered in the local XERC20 registry
     *
     * @param token ERC20 or xERC20 to move across chains
     * @param amount token quantity to move across chains
     * @param recipient whom will receive the token
     * @param destinationChainId chain id where the wrapped version is destined to (it may be a sha256 hash of the relevant ID of the chain (i.e. sha256 of the chain id for EOS))
     */
    function swap(
        address token,
        uint256 amount,
        string calldata recipient,
        bytes32 destinationChainId
    ) external payable {
        swap(token, amount, recipient, destinationChainId, "");
    }

    /**
     * @notice Wraps a token to another chain
     *
     * @dev Be sure the pair is registered in the local XERC20 registry
     *
     * @param token ERC20 or xERC20 to move across chains
     * @param amount token quantity to move across chains
     * @param recipient whom will receive the token
     * @param destinationChainId chain id where the wrapped version is destined to (it may be a sha256 hash of the relevant ID of the chain (i.e. sha256 of the chain id for EOS))
     * @param data metadata
     */
    function swap(
        address token,
        uint256 amount,
        string memory recipient,
        bytes32 destinationChainId,
        bytes memory data
    ) public payable {
        require(amount > 0 || token == address(0), "AmountLessThanZero");
        (bytes32 erc20Bytes, address xerc20) = IXERC20Registry(registry)
            .getAssets(token);

        address lockbox = IXERC20(xerc20).getLockbox();
        address erc20 = address(uint160(uint256(erc20Bytes)));

        if (IXERC20Lockbox(lockbox).IS_NATIVE()) {
            IXERC20Lockbox(lockbox).depositNativeTo{value: amount}(
                address(this)
            );
        } else {
            SafeERC20.safeTransferFrom(
                IERC20(token),
                msg.sender,
                address(this),
                amount
            );

            if (token == erc20) {
                IERC20(token).approve(lockbox, amount);
                IXERC20Lockbox(lockbox).deposit(amount);
            }
        }

        // Fetched by _burnWithCaller() of the xERC20 in order to understand
        // which type of fee to apply
        uint256 destinatinChainIdUInt256 = uint256(destinationChainId);
        assembly {
            tstore(0, destinatinChainIdUInt256)
        }

        address feesManager = IXERC20(xerc20).getFeesManager();
        if (feesManager != address(0)) {
            uint256 fees = IFeesManager(feesManager).calculateFee(
                xerc20,
                amount
            );
            IERC20(xerc20).approve(feesManager, fees);
        }

        IXERC20(xerc20).burn(address(this), amount);

        emit Swap(
            Operation(
                erc20Bytes,
                msg.sender,
                recipient,
                bytes32(block.chainid),
                destinationChainId,
                amount,
                data
            )
        );
    }

    function settle(
        Operation memory operation,
        IPAM.Metadata calldata metadata
    ) public {
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
                    hexStringToAddress(operation.recipient),
                    operation.amount
                );
            } else {
                IXERC20(xerc20).mint(
                    hexStringToAddress(operation.recipient),
                    operation.amount
                );
            }
        }

        if (operation.data.length > 0) {
            // pNetwork aims to deliver cross chain messages successfully regardless of what the user may do with them.
            // We do not want this mint transaction reverting if their receiveUserData function reverts,
            // and thus we swallow any such errors, emitting a `ReceiveUserDataFailed` event instead.
            // This way, a user also has the option include userData even when minting to an externally owned account.
            // Here excessivelySafeCall executes a low-level call which does not revert the caller transaction if the callee reverts,
            // with the increased protection for returnbombing, i.e. the returndata copy is limited to 256 bytes.
            bytes memory data = abi.encodeWithSelector(
                IPReceiver.receiveUserData.selector,
                operation.data
            );
            uint256 gasReserve = 1000; // enough gas to ensure we eventually emit, and return

            (bool success, ) = hexStringToAddress(operation.recipient)
                .excessivelySafeCall(gasleft() - gasReserve, 0, 0, data);
            if (!success) emit ReceiveUserDataFailed();
        }
    }

    function hexStringToAddress(
        string memory addr
    ) internal pure returns (address) {
        bytes memory tmp = bytes(addr);
        uint160 iaddr = 0;
        uint160 b1;
        uint160 b2;
        for (uint256 i = 2; i < 2 + 2 * 20; i += 2) {
            iaddr *= 256;
            b1 = uint160(uint8(tmp[i]));
            b2 = uint160(uint8(tmp[i + 1]));
            if ((b1 >= 97) && (b1 <= 102)) {
                b1 -= 87;
            } else if ((b1 >= 65) && (b1 <= 70)) {
                b1 -= 55;
            } else if ((b1 >= 48) && (b1 <= 57)) {
                b1 -= 48;
            }
            if ((b2 >= 97) && (b2 <= 102)) {
                b2 -= 87;
            } else if ((b2 >= 65) && (b2 <= 70)) {
                b2 -= 55;
            } else if ((b2 >= 48) && (b2 <= 57)) {
                b2 -= 48;
            }
            iaddr += (b1 * 16 + b2);
        }
        return address(iaddr);
    }
}
