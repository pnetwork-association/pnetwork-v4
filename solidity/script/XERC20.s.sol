// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Script.sol";
import {XERC20} from "../src/xerc20/XERC20.sol";

contract XERC20Script is Script {
    function setLimits(
        address xerc20,
        address adapter,
        uint256 mintingLimit,
        uint256 burningLimit
    ) external {
        vm.startBroadcast();
        XERC20(xerc20).setLimits(adapter, mintingLimit, burningLimit);
        vm.stopBroadcast();
    }

    function setLockbox(address xerc20, address lockbox) external {
        vm.startBroadcast();
        XERC20(xerc20).setLockbox(lockbox);
        vm.stopBroadcast();
    }

    function setPAM(address xerc20, address adapter, address pam) external {
        vm.startBroadcast();
        XERC20(xerc20).setPAM(adapter, pam);
        vm.stopBroadcast();
    }
}
