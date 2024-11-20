// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/contracts/PAM.sol";

contract PAMScript is Script {
    function setTeeSigner(
        address pam,
        bytes calldata pubKey,
        bytes memory attestation
    ) external {
        vm.startBroadcast();
        PAM(pam).setTeeSigner(pubKey, attestation);
        vm.stopBroadcast();
    }

    // Call if emitter is not in a EVM chain
    function setEmitter(
        address pam,
        uint256 chainid,
        bytes32 emitter
    ) external {
        vm.startBroadcast();
        PAM(pam).setEmitter(bytes32(chainid), emitter);
        vm.stopBroadcast();
    }

    // Call if emitter is in a EVM chain
    function setEmitter(
        address pam,
        uint256 chainid,
        address emitter
    ) external {
        vm.startBroadcast();
        PAM(pam).setEmitter(bytes32(chainid), bytes32(abi.encode(emitter)));
        vm.stopBroadcast();
    }

    function setTopicZero(
        address pam,
        uint256 chainid,
        bytes32 topic
    ) external {
        vm.startBroadcast();
        PAM(pam).setTopicZero(bytes32(chainid), topic);
        vm.stopBroadcast();
    }

    function applyNewTeeSigner(address pam) external {
        vm.startBroadcast();
        PAM(pam).applyNewTeeSigner();
        vm.stopBroadcast();
    }
}
