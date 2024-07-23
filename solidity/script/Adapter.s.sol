// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Script.sol";
import "../src/Adapter.sol";
import "../src/xerc20/XERC20.sol";
import "../src/XERC20Registry.sol";
import "../src/xerc20/XERC20Lockbox.sol";
import "../src/test/ERC20Test.sol";

import "forge-std/console.sol";

contract RegisterXERC20 is Script {
    function grantRegistrarRole(address registry, address registrar) external {
        vm.startBroadcast();
        XERC20Registry(registry).grantRole(keccak256("REGISTRAR"), registrar);
        vm.stopBroadcast();
    }

    function swap(
        address adapter,
        address token,
        uint256 amount,
        uint256 destinationChainId,
        string memory recipient,
        bytes memory data
    ) external {
        vm.startBroadcast();
        Adapter(adapter).swap(
            token,
            amount,
            destinationChainId,
            recipient,
            data
        );
        vm.stopBroadcast();
    }
}
