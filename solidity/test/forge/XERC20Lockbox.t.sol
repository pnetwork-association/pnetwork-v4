// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {EnumerableMap} from "@openzeppelin/contracts/utils/structs/EnumerableMap.sol";

import "forge-std/StdCheats.sol";
import {Vm} from "forge-std/Vm.sol";
import {Helper} from "./Helper.sol";
import {Test, stdMath} from "forge-std/Test.sol";

import {PAM} from "../../src/contracts/PAM.sol";
import {Adapter} from "../../src/contracts/Adapter.sol";
import {XERC20} from "../../src/contracts/XERC20.sol";
import {XERC20Lockbox} from "../../src/contracts/XERC20Lockbox.sol";
import {XERC20Factory} from "../../src/contracts/XERC20Factory.sol";
import {FeesManager} from "../../src/contracts/FeesManager.sol";

import "forge-std/console.sol";

/**
 * Run this into a fork of Ethereum Mainnet
 * @dev run with
 *   forge test --rpc-url $RPC_URL --fork-block-number $BLOCK_NUM -vvv --mc XERC20LockboxTest
 */
contract XERC20LockboxTest is Test {
    address owner = vm.addr(1);
    address user = vm.addr(2);
    XERC20 xerc20;
    XERC20Lockbox lockbox;
    ERC20 USDC = ERC20(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);

    uint256 usdcBalance = 1_000_000; // 1 USDC
    uint256 conversionRatio;

    modifier onlyMainnet() {
        if (block.chainid == 1) _;
        else return;
    }

    function setUp() public onlyMainnet {
        vm.startPrank(owner);
        string memory xname = "XUSD Coin";
        string memory xsymbol = "XUSDC";
        bool freezingEnabled = false;
        bool isNative = false;

        bytes32 _salt = keccak256(abi.encodePacked("", msg.sender));

        XERC20Factory factory = new XERC20Factory{salt: _salt}();

        uint256[] memory mintingLimits;
        uint256[] memory burningLimits;
        address[] memory emptyBridges;

        xerc20 = XERC20(
            factory.deployXERC20(
                xname,
                xsymbol,
                mintingLimits,
                burningLimits,
                emptyBridges,
                freezingEnabled
            )
        );

        lockbox = XERC20Lockbox(
            factory.deployLockbox(address(xerc20), address(USDC), isNative)
        );

        deal(address(USDC), user, usdcBalance);

        conversionRatio = 10 ** (18 - USDC.decimals());

        vm.stopPrank();
    }

    function test_tokensMustHaveExpectedDecimals() public onlyMainnet {
        assertEq(USDC.decimals(), 6);
        assertEq(xerc20.decimals(), 18);
    }

    function test_userMustHaveExpectedInitialBalance() public onlyMainnet {
        assertEq(USDC.balanceOf(user), usdcBalance);
    }

    function test_depositPrecision() public onlyMainnet {
        vm.startPrank(user);
        USDC.approve(address(lockbox), usdcBalance);
        lockbox.deposit(usdcBalance);

        assertEq(xerc20.balanceOf(user), usdcBalance * conversionRatio);
        assertEq(xerc20.balanceOf(address(lockbox)), 0);
        assertEq(USDC.balanceOf(address(lockbox)), usdcBalance);
        assertEq(USDC.balanceOf(user), 0);
    }

    function test_withdrawPrecision() public onlyMainnet {
        test_depositPrecision();

        vm.startPrank(user);
        uint256 xerc20Balance = xerc20.balanceOf(user);
        uint256 dust = 1000;
        uint256 snapId = vm.snapshotState();

        xerc20.approve(address(lockbox), dust);
        lockbox.withdraw(dust);

        assertEq(USDC.balanceOf(user), 0);
        assertEq(USDC.balanceOf(address(lockbox)), usdcBalance);
        assertEq(xerc20.balanceOf(user), xerc20Balance - dust);
        assertEq(xerc20.balanceOf(address(lockbox)), 0);

        vm.revertToState(snapId);

        xerc20.approve(address(lockbox), xerc20Balance);
        lockbox.withdraw(xerc20Balance);

        assertEq(USDC.balanceOf(user), usdcBalance);
        assertEq(USDC.balanceOf(address(lockbox)), 0);
        assertEq(xerc20.balanceOf(user), 0);
        assertEq(xerc20.balanceOf(address(lockbox)), 0);
    }
}
