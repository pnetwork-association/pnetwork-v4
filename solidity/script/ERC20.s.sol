// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract ERC20 is Script {
    function approve(address erc20, address spender, uint256 amount) external {
        vm.startBroadcast();
        IERC20(erc20).approve(spender, amount);
        vm.stopBroadcast();
    }
}
