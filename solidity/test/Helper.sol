// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import {Test} from "forge-std/Test.sol";
import {XERC20} from "../src/test/XERC20.sol";
import {XERC20Registry} from "../src/XERC20Registry.sol";

abstract contract Helper is Test {
    function _registerPair(
        address owner,
        address registrar,
        XERC20Registry registry,
        bytes32 erc20,
        address xerc20
    ) public {
        vm.prank(owner);
        registry.grantRole(keccak256("REGISTRAR"), registrar);
        vm.prank(registrar);
        registry.registerXERC20(erc20, xerc20);
    }

    function _transferToken(address token, address from, address to, uint256 amount) internal {
        vm.startPrank(from);
        ERC20(token).transfer(to, amount);
        vm.stopPrank();
    }
}
