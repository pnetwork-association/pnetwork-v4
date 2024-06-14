// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "./PAM.sol";
import "./libraries/RLP.sol";
import "./libraries/ExcessivelySafeCall.sol";
import {IAdapter} from "./interfaces/IAdapter.sol";
import {IFeesManager} from "./interfaces/IFeesManager.sol";
import {IPReceiver} from "./interfaces/IPReceiver.sol";
import {IXERC20} from "./interfaces/IXERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import {IXERC20Registry} from "./interfaces/IXERC20Registry.sol";
import {IXERC20Lockbox} from "./interfaces/IXERC20Lockbox.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "hardhat/console.sol";


contract Adapter is IAdapter, Ownable {
    using ExcessivelySafeCall for address;

    address public registry;
    address public pam;
    address public feesManager;
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

    constructor(address registry_, address feesManager_, address pam_) {
        registry = registry_;
        pam = pam_;
        feesManager = feesManager_;
    }

    function setPAM(address pam_) external onlyOwner {
        pam = pam_;
    }

    // function _mint(bytes32 tokenId, address recipient, uint256 value, bytes memory userData) internal {
    //     (address xerc20, address erc20) = IXERC20Registry(registry).getAssets(tokenId);
    //     if (erc20 == address(0)) {
    //         IXERC20(xerc20).mint(recipient, value);
    //     } else {
    //         IXERC20(xerc20).mint(address(this), value);
    //         address lockbox = IXERC20(xerc20).lockbox();
    //         IERC20(xerc20).approve(lockbox, value);
    //         IXERC20Lockbox(lockbox).withdraw(value);
    //         SafeERC20.safeTransfer(IERC20(erc20), recipient, value);
    //     }
    //     uint256 gasReserve = 1000; // enough gas to ensure we eventually emit, and return
    //     if (userData.length > 0) {
    //         // pNetwork aims to deliver cross chain messages successfully regardless of what the user may do with them.
    //         // We do not want this mint transaction reverting if their receiveUserData function reverts,
    //         // and thus we swallow any such errors, emitting a `ReceiveUserDataFailed` event instead.
    //         // This way, a user also has the option include userData even when minting to an externally owned account.
    //         // Here excessivelySafeCall executes a low-level call which does not revert the caller transaction if the callee reverts,
    //         // with the increased protection for returnbombing, i.e. the returndata copy is limited to 256 bytes.
    //         bytes memory data = abi.encodeWithSelector(IPReceiver.receiveUserData.selector, value, userData);
    //         (bool success, ) = recipient.excessivelySafeCall(gasleft() - gasReserve, 0, 0, data);
    //         if (!success) emit ReceiveUserDataFailed();
    //     }
    // }

    struct SwapEvent {
        address erc20;
        uint256 swapAmount;
        address recipient;
        bytes32 originChainId;
        bytes32 destinationChainId;
        bytes data;
    }


    function swap(
        address token,
        uint256 amount,
        string calldata recipient,
        bytes4 destinationChainId
    ) external payable {
        swap(token, amount, recipient, destinationChainId, "");
    }

    function swap(address token, uint256 amount, string memory recipient, bytes4 chainId, bytes memory data) public payable {
        require(amount > 0 || token == address(0), "AmountLessThanZero");
        (bytes32 erc20Bytes, address xerc20, bool isLocal) = IXERC20Registry(registry).getAssets(token);

        uint256 feeAmount;
        uint256 swapAmount;
        address erc20 = address(uint160(uint256(erc20Bytes)));
        if (isLocal) {
            feeAmount = IFeesManager(feesManager).calculateFee(erc20, amount, chainId);
            address lockbox = IXERC20(xerc20).lockbox();
            if (IXERC20Lockbox(lockbox).IS_NATIVE()) {
                if (feeAmount > msg.value) revert UnsufficientAmount(amount, feeAmount);
                swapAmount = msg.value - feeAmount;
                IFeesManager(feesManager).depositFee{value: feeAmount}();
                IXERC20Lockbox(lockbox).depositNative{value: swapAmount}();
            } else {
                if (feeAmount > amount) revert UnsufficientAmount(amount, feeAmount);
                swapAmount = amount - feeAmount;
                SafeERC20.safeTransferFrom(IERC20(erc20), msg.sender, address(this), amount);
                IERC20(erc20).approve(feesManager, feeAmount);
                IFeesManager(feesManager).depositFee(erc20, feeAmount);
                IERC20(erc20).approve(lockbox, swapAmount);
                IXERC20Lockbox(lockbox).deposit(swapAmount);
            }
        } else {
            SafeERC20.safeTransferFrom(IERC20(xerc20), msg.sender, address(this), amount);
            feeAmount = IFeesManager(feesManager).calculateFee(xerc20, amount, chainId);
            if (feeAmount > amount) revert UnsufficientAmount(amount, feeAmount);
            swapAmount = amount - feeAmount;
            IERC20(xerc20).approve(feesManager, feeAmount);
            IFeesManager(feesManager).depositFee(xerc20, feeAmount);
        }
        IXERC20(xerc20).burn(address(this), swapAmount);

        emit Swap(
            erc20,
            msg.sender,
            recipient,
            bytes32(block.chainid),
            chainId,
            swapAmount,
            data
        );
    }

    function _checkEventAndDecodeData(
        bytes calldata statement
    ) internal view returns (uint256 originChainId, uint256[] memory ids, bytes32[] memory hashes) {
        //  Statement format:
        //    | version   | protocol   |  protocol_chain_id |   event id    | event_bytes |
        //    | (1 byte)  | (1 byte)   |    (32 bytes)      |  (32 bytes)   |  varlen     |

        uint16 offset = 2; // skip version, protocolId
        originChainId = uint256(bytes32(statement[offset:(offset += 32)]));

        bytes32 eventId = bytes32(statement[offset:(offset += 32)]);
        require(!pastEvents[eventId], "Event already processed already stored");

        bytes memory eventBytes = statement[offset:];
        RLPReader.RLPItem memory eventRLP = RLPReader.toRlpItem(eventBytes);
        if (!RLPReader.isList(eventRLP)) revert InvalidEventRLP();

        RLPReader.RLPItem[] memory eventContent = RLPReader.toList(eventRLP);

        // Event must contain address, logs and data
        if (eventContent.length != 3) revert InvalidEventContentLength(eventContent.length);

        // MessageDispatched event parsing
        // address yahoAddress = RLPReader.toAddress(eventContent[0]);
        // require(yahoAddress == yahos[originChainId], "Invalid Yaho address");

        RLPReader.RLPItem[] memory logs = RLPReader.toList(eventContent[1]);

        bytes32 topic = bytes32(RLPReader.toBytes(logs[0]));
        if (topic != SWAP_EVENT_TOPIC) revert UnexpectedEventTopic(topic);

        bytes memory swapEventBytes = RLPReader.toBytes(eventContent[2]);
        SwapEvent memory message = abi.decode(swapEventBytes, (SwapEvent));

        // FIXME: check logs[1] ?

        (ids, hashes) = abi.decode(message.data, (uint256[], bytes32[]));
     }

    function settle(bytes calldata statement, bytes memory signature) public {
        require(PAM(pam).isAuthorized(statement, signature), "Unauthorized");

        _checkEventAndDecodeData(statement);
    }

    // function hexStringToAddress(string memory addr) internal pure returns (address) {
    //     bytes memory tmp = bytes(addr);
    //     uint160 iaddr = 0;
    //     uint160 b1;
    //     uint160 b2;
    //     for (uint256 i = 2; i < 2 + 2 * 20; i += 2) {
    //         iaddr *= 256;
    //         b1 = uint160(uint8(tmp[i]));
    //         b2 = uint160(uint8(tmp[i + 1]));
    //         if ((b1 >= 97) && (b1 <= 102)) {
    //             b1 -= 87;
    //         } else if ((b1 >= 65) && (b1 <= 70)) {
    //             b1 -= 55;
    //         } else if ((b1 >= 48) && (b1 <= 57)) {
    //             b1 -= 48;
    //         }
    //         if ((b2 >= 97) && (b2 <= 102)) {
    //             b2 -= 87;
    //         } else if ((b2 >= 65) && (b2 <= 70)) {
    //             b2 -= 55;
    //         } else if ((b2 >= 48) && (b2 <= 57)) {
    //             b2 -= 48;
    //         }
    //         iaddr += (b1 * 16 + b2);
    //     }
    //     return address(iaddr);
    // }

    // function handle(
    //     Operation calldata operation, // encoded message payload being received
    //     bytes calldata signature
    // ) external {
    //     bytes32 operationId = operationIdOf(operation);
    //     if (_operationsStatus[operationId] != OperationStatus.Unseen) revert AlreadyProcessed(operationId);
    //     address actor = ECDSA.recover(ECDSA.toEthSignedMessageHash(operationId), signature);
    //     require(hasRole(MINTER_ROLE, actor), 'Cannot mint');
    //     address destinationAddress = hexStringToAddress(operation.destinationAccount);
    //     _operationsStatus[operationId] = OperationStatus.Executed;
    //     _mint(operation.tokenId, destinationAddress, operation.assetAmount, operation.userData);
    // }

    // function operationIdOf(Operation memory operation) public pure override returns (bytes32) {
    //     return sha256(abi.encode(operation));
    // }

    // function operationStatusOf(Operation calldata operation) external view override returns (OperationStatus) {
    //     return _operationsStatus[operationIdOf(operation)];
    // }
}
