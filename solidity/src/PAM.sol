// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.20;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { RLPReader } from "solidity-rlp/contracts/RLPReader.sol";

contract PAM is Ownable {
    error InvalidEventRLP();
    error InvalidEventContentLength(uint256);
    error UnsupportedProtocolId(bytes1);
    error UnsupportedChainId(uint256);
    error UnexpectedEventTopic(bytes32);
    error InvalidSender();
    error InvalidMessageId(uint256, uint256);
    error InvalidDestinationChainId(uint256);

    event TeeSignerChanged(address);
    event TeeSignerPendingChange(address, bytes, uint256);
    event YahoInitialized(uint256, address);

    uint256 public constant TEE_ADDRESS_CHANGE_GRACE_PERIOD = 172800; // 48 hours

    address public teeAddress;
    address public teeAddressNew;
    uint256 public teeAddressChangeGraceThreshold;
    mapping(uint256 => address) public yahos;

    function setTeeSigner(bytes calldata pubKey, bytes memory attestation) public onlyOwner {
        if (teeAddress == address(0)) {
            // Setting the teeAddress the first time
            teeAddress = _getAddressFromPublicKey(pubKey);
            emit TeeSignerPendingChange(teeAddress, attestation, block.timestamp);
            emit TeeSignerChanged(teeAddress);
        } else {
            // The new address will be set after a grace period of 48 hours
            teeAddressNew = _getAddressFromPublicKey(pubKey);
            teeAddressChangeGraceThreshold = block.timestamp + TEE_ADDRESS_CHANGE_GRACE_PERIOD;
            emit TeeSignerPendingChange(teeAddressNew, attestation, teeAddressChangeGraceThreshold);
        }
    }

    function isAuthorized(bytes calldata statement, bytes memory signature) public returns (bool) {
        if (teeAddressNew != address(0) && block.timestamp > teeAddressChangeGraceThreshold) {
            teeAddress = teeAddressNew;
            teeAddressNew = address(0);
            emit TeeSignerChanged(teeAddress);
        }
        require(teeAddress != address(0), "Tee signer not set!");
        return ECDSA.recover(sha256(statement), signature) == teeAddress;
    }

    function _getAddressFromPublicKey(bytes calldata pubKey) internal pure returns (address) {
        return address(uint160(uint256(keccak256(pubKey[1:]))));
    }


}
