// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Script.sol";
import "../contracts/Adapter.sol";
import "../contracts/XERC20.sol";
import "../contracts/XERC20Lockbox.sol";
import "../contracts/test/ERC20Test.sol";

import "forge-std/console.sol";

contract AdapterScript is Script {
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

    function settle(
        address adapter,
        IAdapter.Operation memory operation,
        IPAM.Metadata calldata metadata
    ) external {
        vm.startBroadcast();
        Adapter(adapter).settle(operation, metadata);
        vm.stopBroadcast();
    }

    function setPAM(address adapter, address pam) external {
        vm.startBroadcast();
        IAdapter(adapter).setPAM(pam);
        vm.stopBroadcast();
    }
}
