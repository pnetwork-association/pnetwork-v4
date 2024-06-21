// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.20;

import {RLPReader} from "solidity-rlp/contracts/RLPReader.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import {IPAM} from "./interfaces/IPAM.sol";
import {IAdapter} from "./interfaces/IAdapter.sol";

contract PAM is Ownable, IPAM {
    bytes32 public constant SWAP_EVENT_TOPIC =
        0xb255de8953b7f0014df3bb00e17f11f43945268f579979c7124353070c2db98d;
    uint256 public constant TEE_ADDRESS_CHANGE_GRACE_PERIOD = 172800; // 48 hours

    address public teeAddress;
    address public teeAddressNew;
    uint256 public teeAddressChangeGraceThreshold;

    mapping(bytes32 => bool) pastEvents;

    error InvalidEventRLP();
    error InvalidTeeSigner();
    error InvalidSignature();
    error InvalidEventContentLength(uint256 length);
    error UnsupportedProtocolId(bytes1 protocolId);
    error UnsupportedChainId(uint256 chainId);
    error UnexpectedEventTopic(bytes32 topic);
    error InvalidSender();
    error InvalidMessageId(uint256 actual, uint256 expected);
    error InvalidDestinationChainId(uint256 chainId);

    event TeeSignerChanged(address newAddress);
    event TeeSignerPendingChange(
        address newAddress,
        bytes attestation,
        uint256 gracePeriod
    );

    constructor() Ownable(msg.sender) {}

    function setTeeSigner(
        bytes calldata pubKey,
        bytes memory attestation
    ) public onlyOwner {
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

    function _maybeUpdateTeeAddress() internal {
        if (
            teeAddressNew != address(0) &&
            block.timestamp > teeAddressChangeGraceThreshold
        ) {
            teeAddress = teeAddressNew;
            teeAddressNew = address(0);
            emit TeeSignerChanged(teeAddress);
        }
    }

    function isAuthorized(
        IAdapter.Operation memory operation,
        Metadata calldata metadata
    ) external returns (bool) {
        _maybeUpdateTeeAddress();

        if (teeAddress == address(0)) revert InvalidTeeSigner();

        if (
            ECDSA.recover(sha256(metadata.statement), metadata.signature) !=
            teeAddress
        ) return false;

        //  Statement format:
        //    | version   | protocol   |  originChainId     |   eventId     | eventBytes  |
        //    | (1 byte)  | (1 byte)   |    (32 bytes)      |  (32 bytes)   |  varlen     |

        uint16 offset = (2 + 32); // skip version, protocolId, originChainId

        bytes32 eventId = bytes32(metadata.statement[offset:offset += 32]);

        if (pastEvents[eventId]) return false;

        bytes memory eventBytes = metadata.statement[offset:];

        RLPReader.RLPItem memory eventRLP = RLPReader.toRlpItem(eventBytes);
        if (!RLPReader.isList(eventRLP)) revert InvalidEventRLP();

        RLPReader.RLPItem[] memory eventContent = RLPReader.toList(eventRLP);

        // Event must contain address, logs and data
        if (eventContent.length != 3)
            revert InvalidEventContentLength(eventContent.length);

        RLPReader.RLPItem[] memory logs = RLPReader.toList(eventContent[1]);

        bytes32 topic = bytes32(RLPReader.toBytes(logs[0]));
        if (topic != SWAP_EVENT_TOPIC) revert UnexpectedEventTopic(topic);

        bytes memory dataBytes = RLPReader.toBytes(eventContent[2]);

        IAdapter.Operation memory expected = abi.decode(
            dataBytes,
            (IAdapter.Operation)
        );

        if (operation.erc20 != expected.erc20) return false;
        if (operation.sender != expected.sender) return false;

        if (
            sha256(abi.encode(operation.recipient)) !=
            sha256(abi.encode(expected.recipient))
        ) return false;
        if (operation.originChainId != expected.originChainId) return false;
        if (operation.destinationChainId != expected.destinationChainId)
            return false;
        if (operation.amount != expected.amount) return false;
        if (sha256(operation.data) != sha256(expected.data)) return false;

        return true;
    }

    function _getAddressFromPublicKey(
        bytes calldata pubKey
    ) internal pure returns (address) {
        return address(uint160(uint256(keccak256(pubKey[1:]))));
    }
}
