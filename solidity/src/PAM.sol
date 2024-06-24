// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.20;

import {RLPReader} from "solidity-rlp/contracts/RLPReader.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import {IPAM} from "./interfaces/IPAM.sol";
import {IAdapter} from "./interfaces/IAdapter.sol";

import "forge-std/console.sol";

contract PAM is Ownable, IPAM {
    bytes32 public constant SWAP_EVENT_TOPIC =
        0x26d9f1fabb4e0554841202b52d725e2426dda2be4cafcb362eb73f9fb813d609;
    uint256 public constant TEE_ADDRESS_CHANGE_GRACE_PERIOD = 172800; // 48 hours

    address public teeAddress;
    address public teeAddressNew;
    uint256 public teeAddressChangeGraceThreshold;
    mapping(bytes32 => bool) pastEvents;

    error InvalidEventRLP();
    error InvalidTeeSigner();
    error InvalidSignature();
    error GracePeriodNotElapsed();
    error InvalidNewTeeSigner();
    error AlreadyProcessed(bytes32 eventId);
    error InvalidEventContentLength(uint256 length);
    error UnsupportedProtocolId(bytes1 protocolId);
    error UnsupportedChainId(uint256 chainId);
    error UnexpectedEventTopic(bytes32 topic);
    error InvalidSender();
    error InvalidEventId(bytes32 actual, bytes32 expected);
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

    function applyNewTeeSigner() external {
        if (block.timestamp < teeAddressChangeGraceThreshold)
            revert GracePeriodNotElapsed();
        if (teeAddressNew == address(0)) revert InvalidNewTeeSigner();

        teeAddress = teeAddressNew;
        teeAddressNew = address(0);

        emit TeeSignerChanged(teeAddress);
    }

    function _getCommitment(
        bytes memory context,
        IAdapter.Operation memory operation
    ) internal view returns (bytes32) {
        console.logBytes20(bytes20(operation.sender));
        console.logBytes32(bytes32(operation.amount));
        return
            sha256(
                bytes.concat(
                    context,
                    operation.blockId,
                    operation.txId,
                    operation.eventRef,
                    bytes32(operation.nonce),
                    operation.erc20,
                    operation.originChainId,
                    operation.destinationChainId,
                    bytes32(operation.amount),
                    bytes20(operation.sender),
                    bytes20(operation.recipient),
                    operation.data
                )
            );
    }

    function isAuthorized(
        IAdapter.Operation memory operation,
        bytes calldata metadata
    ) external view returns (bool) {
        //  Metadata format:
        //    | version   | protocol   |  originChainId     |   eventId     |  signature  |
        //    | (1 byte)  | (1 byte)   |    (32 bytes)      |  (32 bytes)   |    varlen   |

        if (teeAddress == address(0)) return false;

        uint16 offset = (2 + 32);
        bytes memory context = metadata[0:offset]; // version, protocolId, originChainId
        bytes32 eventId = bytes32(metadata[offset:offset += 32]);
        bytes memory signature = metadata[offset:];

        console.log("signature");
        console.logBytes(signature);
        if (ECDSA.recover(eventId, signature) != teeAddress)
            revert InvalidSignature();

        bytes32 commitment = _getCommitment(context, operation);

        if (pastEvents[eventId]) return false;

        if (commitment != eventId) return false;

        return true;
    }

    function _getAddressFromPublicKey(
        bytes calldata pubKey
    ) internal pure returns (address) {
        return address(uint160(uint256(keccak256(pubKey[1:]))));
    }
}
