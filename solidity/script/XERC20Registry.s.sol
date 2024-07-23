// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Script.sol";
import "../src/Adapter.sol";
import "../src/xerc20/XERC20.sol";
import "../src/XERC20Registry.sol";
import "../src/xerc20/XERC20Lockbox.sol";
import "../src/test/ERC20Test.sol";

import "forge-std/console.sol";

contract XERC20RegistryScripts is Script {
    function grantRegistrarRole(address registry, address registrar) external {
        vm.startBroadcast();
        XERC20Registry(registry).grantRole(keccak256("REGISTRAR"), registrar);
        vm.stopBroadcast();
    }

    function registerPair(
        address registry,
        address erc20,
        address xerc20
    ) external {
        vm.startBroadcast();
        XERC20Registry(registry).registerXERC20(
            bytes32(abi.encode(erc20)),
            xerc20
        );
        vm.stopBroadcast();
    }

    function deregisterPair(address registry, address xerc20) external {
        vm.startBroadcast();
        XERC20Registry(registry).deregisterXERC20(xerc20);
        vm.stopBroadcast();
    }
}
