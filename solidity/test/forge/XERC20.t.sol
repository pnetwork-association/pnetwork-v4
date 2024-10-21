// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {EnumerableMap} from "@openzeppelin/contracts/utils/structs/EnumerableMap.sol";

import {Vm} from "forge-std/Vm.sol";
import {Helper} from "./Helper.sol";
import {Test, stdMath} from "forge-std/Test.sol";

import {PAM} from "../../src/contracts/PAM.sol";
import {Adapter} from "../../src/contracts/Adapter.sol";
import {XERC20} from "../../src/contracts/XERC20.sol";
import {XERC20} from "../../src/contracts/XERC20.sol";
import {XERC20Factory} from "../../src/contracts/XERC20Factory.sol";
import {ERC20Test} from "../../src/contracts/test/ERC20Test.sol";
import {FeesManager} from "../../src/contracts/FeesManager.sol";

import "forge-std/console.sol";

contract XERC20Test is Test, Helper {
    XERC20 xerc20;

    function setUp() public {
        vm.startPrank(owner);
        string memory name = "xToken A";
        string memory symbol = "xTKNA";
        uint256 mintingLimit = 10000 ether;
        uint256 burningLimit = 20000 ether;
        uint256 supply = 100 ether;
        bool freezingEnabled = true;
        bool local = true;

        bytes32 _salt = keccak256(abi.encodePacked(SALT, msg.sender));

        XERC20Factory factory = new XERC20Factory{salt: _salt}();

        xerc20 = XERC20(
            factory.deployXERC20(
                name,
                symbol,
                emptyMintingLimits,
                emptyBurningLimits,
                emptyBridges,
                freezingEnabled
            )
        );

        xerc20.setLimits(owner, mintingLimit, burningLimit);

        vm.stopPrank();
    }

    function test_should_deploy_with_freezeEnabled_true() public {
        vm.startPrank(owner);

        assertTrue(xerc20.freezingEnabled());

        vm.stopPrank();
    }

    function test_revertWhen_onlyOwnerAccess() public {
        vm.prank(evil);
        _expectOwnableUnauthorizedAccountRevert(evil);
        xerc20.freezeAddress(user);

        vm.prank(owner);
        xerc20.freezeAddress(user);

        assertTrue(xerc20.frozen(user));

        vm.prank(evil);
        _expectOwnableUnauthorizedAccountRevert(evil);
        xerc20.unfreezeAddress(user);

        vm.prank(owner);
        xerc20.unfreezeAddress(user);

        assertFalse(xerc20.frozen(user));
    }

    function test_revertWhen_transferFromFrozenAddress() public {
        address exchange = vm.addr(111);
        uint256 stolenAmount = 10 ether;
        vm.prank(owner);
        xerc20.mint(user, 100 ether);

        vm.prank(user);
        xerc20.transfer(evil, stolenAmount);

        vm.prank(owner);
        xerc20.freezeAddress(evil);

        vm.prank(evil);
        vm.expectRevert(bytes("address is frozen"));
        xerc20.transfer(exchange, stolenAmount);

        vm.prank(owner);
        xerc20.unfreezeAddress(evil);

        vm.startPrank(evil);
        xerc20.transfer(exchange, stolenAmount);

        assertEq(xerc20.balanceOf(exchange), stolenAmount);
    }
}
