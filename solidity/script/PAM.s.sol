// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/PAM.sol";

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

    function setEmitter(
        address pam,
        uint256 chainid,
        address emitter
    ) external {
        vm.startBroadcast();
        PAM(pam).setEmitter(bytes32(chainid), bytes32(abi.encode(emitter)));
        vm.stopBroadcast();
    }
}
