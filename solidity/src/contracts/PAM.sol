// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import {IPAM} from "../interfaces/IPAM.sol";
import {IAdapter} from "../interfaces/IAdapter.sol";

contract PAM is Ownable, IPAM {
    uint256 public constant TEE_ADDRESS_CHANGE_GRACE_PERIOD = 172800; // 48 hours

    address public teeAddress;
    address public teeAddressNew;
    uint256 public teeAddressChangeGraceThreshold;
    mapping(bytes32 => bytes32) public emitters;
    mapping(bytes32 => bytes32) public chainIdToTopicZero;

    event EmitterSet(bytes32 chainid, bytes32 emitter);
    event EmitterUnset(bytes32 chainId);
    event TeeSignerChanged(address newAddress);
    event TeeSignerPendingChange(
        address newAddress,
        bytes attestation,
        uint256 gracePeriod
    );

    error UnsetTeeSigner();
    error GracePeriodNotElapsed();
    error InvalidNewTeeSigner();
    error AlreadyProcessed(bytes32 eventId);
    error InvalidEventContentLength(uint256 length);
    error UnsupportedProtocolId(bytes1 protocolId);
    error UnsupportedChainId(bytes32 chainId);
    error UnexpectedEventTopic(bytes32 topic);
    error InvalidSender();
    error InvalidEventId(bytes32 actual, bytes32 expected);
    error InvalidDestinationChainId(uint256 chainId);

    constructor() Ownable(msg.sender) {}

    function setTeeSigner(
        bytes calldata pubKey,
        bytes memory attestation
    ) external onlyOwner {
        if (teeAddress == address(0)) {
            // Setting the teeAddress the first time
            teeAddress = _getAddressFromPublicKey(pubKey);
            emit TeeSignerPendingChange(
                teeAddress,
                attestation,
                block.timestamp
            );
            emit TeeSignerChanged(teeAddress);
        } else {
            // The new address will be set after a grace period of 48 hours
            teeAddressNew = _getAddressFromPublicKey(pubKey);

            if (teeAddressNew == address(0)) revert InvalidNewTeeSigner();

            teeAddressChangeGraceThreshold =
                block.timestamp +
                TEE_ADDRESS_CHANGE_GRACE_PERIOD;
            emit TeeSignerPendingChange(
                teeAddressNew,
                attestation,
                teeAddressChangeGraceThreshold
            );
        }
    }

    function setTopicZero(bytes32 chainid, bytes32 topic0) external onlyOwner {
        chainIdToTopicZero[chainid] = topic0;
    }

    function setEmitter(bytes32 chainid, bytes32 emitter) external onlyOwner {
        emitters[chainid] = emitter;

        emit EmitterSet(chainid, emitter);
    }

    function unsetEmitter(bytes32 chainid) external onlyOwner {
        delete emitters[chainid];

        emit EmitterUnset(chainid);
    }

    function applyNewTeeSigner() external {
        if (block.timestamp < teeAddressChangeGraceThreshold)
            revert GracePeriodNotElapsed();

        teeAddress = teeAddressNew;
        teeAddressNew = address(0);

        emit TeeSignerChanged(teeAddress);
    }

    function isAuthorized(
        IAdapter.Operation memory operation,
        Metadata calldata metadata
    ) external view returns (bool, bytes32) {
        //  Metadata preimage format:
        //    | version | protocol | origin | blockHash | txHash | eventPayload |
        //    |   1B    |    1B    |   32B  |    32B    |   32B  |    varlen    |
        //    +----------- context ---------+------------- event ---------------+

        if (teeAddress == address(0)) revert UnsetTeeSigner();

        if (!_contextChecks(operation, metadata)) return (false, bytes32(0));
        bytes32 eventId = sha256(metadata.preimage);

        if (ECDSA.recover(eventId, metadata.signature) != teeAddress)
            return (false, eventId);

        // Event payload format
        // |  emitter  |    topic-0     |    topics-1     |    topics-2     |    topics-3     |  eventBytes  |
        // |    32B    |      32B       |       32B       |       32B       |       32B       |    varlen    |
        bytes32 originChainId = bytes32(metadata.preimage[2:34]);

        uint256 offset = 32;
        bytes calldata eventPayload = metadata.preimage[98:];
        bytes32 emitter = bytes32(eventPayload[0:offset]);
        bytes32 expectedEmitter = emitters[originChainId];

        if ((expectedEmitter == bytes32(0)) || (emitter != expectedEmitter))
            return (false, eventId);

        bytes32 topic0 = bytes32(eventPayload[offset:offset += 32]);

        if (topic0 != chainIdToTopicZero[originChainId])
            return (false, eventId);

        offset += 32 * 3; // skip other topics
        IAdapter.EventBytes memory eventBytes = abi.decode(
            eventPayload[offset:],
            (IAdapter.EventBytes)
        );

        if (!this.doesContentMatchOperation(eventBytes.content, operation))
            return (false, eventId);

        return (true, eventId);
    }

    function doesContentMatchOperation(
        bytes calldata content,
        IAdapter.Operation memory operation
    ) public view returns (bool) {
        // Event Bytes content (see _finalizeSwap() in Adapter)
        // | nonce | erc20 | destination | amount | sender | recipientLen | recipient |   data   |
        // |  32B  |  32B  |     32B     |  32B   |  32B   |     32B      |   varlen  |  varlen  |
        uint256 offset = 32;
        uint256 nonce = uint256(bytes32(content[0:offset]));
        bytes32 erc20 = bytes32(content[offset:offset += 32]);
        bytes32 destinationChainId = bytes32(content[offset:offset += 32]);
        uint256 amount = uint256(bytes32(content[offset:offset += 32]));
        bytes32 sender = bytes32(content[offset:offset += 32]);
        uint256 recipientLen = uint256(bytes32(content[offset:offset += 32]));
        address recipient = _bytesToAddress(
            content[offset:offset += recipientLen]
        );
        bytes memory data = content[offset:];

        return (nonce == operation.nonce &&
            erc20 == operation.erc20 &&
            destinationChainId == operation.destinationChainId &&
            destinationChainId == bytes32(block.chainid) &&
            amount == operation.amount &&
            sender == operation.sender &&
            recipient == operation.recipient &&
            sha256(data) == sha256(operation.data));
    }

    function _contextChecks(
        IAdapter.Operation memory operation,
        Metadata calldata metadata
    ) internal pure returns (bool) {
        uint16 offset = 2; // skip protocol, version
        bytes32 originChainId = bytes32(metadata.preimage[offset:offset += 32]);

        if (originChainId != operation.originChainId) return false;

        bytes32 blockId = bytes32(metadata.preimage[offset:offset += 32]);
        bytes32 txId = bytes32(metadata.preimage[offset:offset += 32]);

        if (blockId != operation.blockId || txId != operation.txId)
            return false;

        return true;
    }

    function _bytesToAddress(bytes memory tmp) internal pure returns (address) {
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

    function _getAddressFromPublicKey(
        bytes calldata pubKey
    ) internal pure returns (address) {
        return address(uint160(uint256(keccak256(pubKey[1:]))));
    }
}
