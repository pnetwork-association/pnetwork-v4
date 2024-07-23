// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Script.sol";
import {IXERC20} from "../src/interfaces/IXERC20.sol";

contract XERC20 is Script {
    function setLimits(
        address xerc20,
        address adapter,
        uint256 mintingLimit,
        uint256 burningLimit
    ) external {
        vm.startBroadcast();
        IXERC20(xerc20).setLimits(adapter, mintingLimit, burningLimit);
        vm.stopBroadcast();
    }

    function setLockbox(address xerc20, address lockbox) external {
        vm.startBroadcast();
        IXERC20(xerc20).setLockbox(lockbox);
        vm.stopBroadcast();
    }
}
