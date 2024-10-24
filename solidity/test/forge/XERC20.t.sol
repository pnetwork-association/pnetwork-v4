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
    address freezingAddress = vm.addr(123123);

    error ERC20InsufficientAllowance(
        address spender,
        uint256 allowance,
        uint256 needed
    );

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

    function test_should_revertWhen_freezerAddressIsNotSet() public {
        bytes memory errMsg = bytes("Freezing address is not set");

        vm.startPrank(owner);
        vm.expectRevert(errMsg);
        xerc20.freezeAddress(evil);

        vm.expectRevert(errMsg);
        xerc20.unfreezeAddress(evil);

        vm.expectRevert(errMsg);
        xerc20.withdrawFrozenAssets(evil, owner, 10);

        vm.stopPrank();
    }

    function test_setFreezingAddress_revertWhen_callerIsNotOwner() public {
        vm.prank(evil);
        _expectOwnableUnauthorizedAccountRevert(evil);
        xerc20.setFreezingAddress(owner);

        vm.prank(owner);
        xerc20.setFreezingAddress(freezingAddress);

        assertEq(xerc20.freezingAddress(), freezingAddress);
    }

    function test_should_freezeAddress() public {
        vm.prank(owner);
        xerc20.setFreezingAddress(freezingAddress);

        vm.startPrank(freezingAddress);
        xerc20.freezeAddress(evil);

        assertTrue(xerc20.frozen(evil));

        xerc20.unfreezeAddress(evil);

        assertFalse(xerc20.frozen(evil));

        vm.stopPrank();
    }

    // NOTE: testing freeze/unfreeze operations on an address
    // called evil. Firstly we freeze the address and expect
    // that neither a normal transfer either a transfer throug
    // approval can happen from that evil address
    //
    // Finally we unfreeze the address and test the above
    // transfers can again work as expected as nothing
    // happened
    function test_should_revertWhen_transferFromFrozenAddress() public {
        address exchange = vm.addr(111);
        uint256 stolenAmount = 10 ether;
        vm.prank(owner);
        xerc20.mint(user, 100 ether);

        vm.prank(owner);
        xerc20.setFreezingAddress(freezingAddress);

        vm.prank(user);
        xerc20.transfer(evil, stolenAmount);

        vm.prank(freezingAddress);
        xerc20.freezeAddress(evil);

        vm.prank(evil);
        vm.expectRevert(bytes("owner is frozen"));
        xerc20.transfer(exchange, stolenAmount);

        // Transfer through approval
        address evilOtherAddress = vm.addr(54321);
        vm.prank(evil);
        xerc20.approve(evilOtherAddress, stolenAmount);

        vm.prank(evilOtherAddress);
        vm.expectRevert(bytes("owner is frozen"));
        xerc20.transferFrom(evil, exchange, stolenAmount);

        vm.prank(freezingAddress);
        xerc20.unfreezeAddress(evil);

        vm.startPrank(evil);
        xerc20.transfer(exchange, stolenAmount - 10);

        assertEq(xerc20.balanceOf(exchange), stolenAmount - 10);

        xerc20.approve(evilOtherAddress, stolenAmount);
        vm.stopPrank();

        // Transfer through approve
        vm.prank(evilOtherAddress);
        xerc20.transferFrom(evil, exchange, 10);

        assertEq(xerc20.balanceOf(exchange), stolenAmount);
    }

    function test_should_withdrawFrozenAssets() public {
        uint256 stolenAmount = 100 ether;
        vm.startPrank(owner);
        xerc20.setFreezingAddress(freezingAddress);
        xerc20.setLimits(owner, stolenAmount, stolenAmount);
        xerc20.mint(evil, stolenAmount);
        vm.stopPrank();

        assertEq(xerc20.balanceOf(evil), stolenAmount);

        vm.startPrank(freezingAddress);
        xerc20.freezeAddress(evil);
        xerc20.withdrawFrozenAssets(evil, freezingAddress, stolenAmount);
        vm.stopPrank();

        assertEq(xerc20.balanceOf(evil), 0);
        assertEq(xerc20.balanceOf(freezingAddress), stolenAmount);
    }
}
