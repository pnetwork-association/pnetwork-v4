// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Script.sol";
import "../contracts/test/ERC20Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract ERC20Script is Script {
    function approve(address erc20, address spender, uint256 amount) external {
        vm.startBroadcast();
        IERC20(erc20).approve(spender, amount);
        vm.stopBroadcast();
    }

    function deploy(
        string memory name,
        string memory symbol,
        uint256 totalSupply
    ) external {
        vm.startBroadcast();
        ERC20Test erc20 = new ERC20Test(name, symbol, totalSupply);
        console.log("ERC20 @ ", address(erc20));
        vm.stopBroadcast();
    }
}
