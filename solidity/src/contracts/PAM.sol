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
        if (teeAddressNew == address(0)) revert UnsetTeeSigner();

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

        // Checking the protocol id against 0x02 (EOS chains)
        // If the condition is satified we expect data content to be
        // a JSON string like:
        //
        //    '{"event_bytes":"00112233445566"}'
        //
        // in hex would be
        //
        //     7b226576656e745f6279746573223a223030313132323333343435353636227d
        //
        // We want to extract 00112233445566, so this is performed by skipping
        // the first 16 chars  and the trailing 2 chars
        //
        // Can't factor out these into variables because otherwise it would
        // raise the "stack too deep" error
        bytes memory eventBytes = uint8(metadata.preimage[1]) == 0x02
            ? _fromUTF8EncodedToBytes(
                eventPayload[(offset + 16):(eventPayload.length - 2)]
            )
            : eventPayload[offset:];

        if (!this.doesContentMatchOperation(eventBytes, operation))
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
        bytes memory _recipient = recipientLen == 42
            ? content[2 + offset:offset += recipientLen]
            : content[offset:offset += recipientLen];
        address recipient = _bytesToAddress(_recipient);

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

    function _fromHexCharToUint8(uint8 x) internal pure returns (uint8) {
        if ((x >= 97) && (x <= 102)) {
            x -= 87;
        } else if ((x >= 65) && (x <= 70)) {
            x -= 55;
        } else if ((x >= 48) && (x <= 57)) {
            x -= 48;
        }
        return x;
    }

    function _fromUTF8EncodedToBytes(
        bytes memory utf8Encoded
    ) internal pure returns (bytes memory) {
        require(utf8Encoded.length % 2 == 0, "invalid utf-8 encoded string");
        bytes memory x = new bytes(utf8Encoded.length / 2);

        uint k;
        uint8 b1;
        uint8 b2;
        for (uint i = 0; i < utf8Encoded.length; i += 2) {
            b1 = _fromHexCharToUint8(uint8(utf8Encoded[i]));
            b2 = _fromHexCharToUint8(uint8(utf8Encoded[i + 1]));
            x[k++] = bytes1(b1 * 16 + b2);
        }
        return x;
    }

    function _bytesToAddress(bytes memory tmp) internal pure returns (address) {
        uint160 iaddr = 0;
        uint160 b1;
        uint160 b2;
        for (uint256 i = 0; i < 2 * 20; i += 2) {
            iaddr *= 256;
            b1 = uint160(_fromHexCharToUint8(uint8(tmp[i])));
            b2 = uint160(_fromHexCharToUint8(uint8(tmp[i + 1])));
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
