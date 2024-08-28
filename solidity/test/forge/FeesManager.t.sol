// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {EnumerableMap} from "@openzeppelin/contracts/utils/structs/EnumerableMap.sol";

import {Vm} from "forge-std/Vm.sol";
import {Helper} from "./Helper.sol";
import {Test, stdMath} from "forge-std/Test.sol";

import {XERC20} from "../../src/xerc20/XERC20.sol";
import {FeesManager} from "../../src/FeesManager.sol";
import {ERC20Test} from "../../src/test/ERC20Test.sol";

import "forge-std/console.sol";

contract FeesManagerTest is Test, Helper {
    using EnumerableMap for EnumerableMap.AddressToUintMap;
    address node0 = vm.addr(4);
    address node1 = vm.addr(5);
    address node2 = vm.addr(6);
    address node3 = vm.addr(7);

    uint256 stakedAmount0 = 1 ether;
    uint256 stakedAmount1 = 2 ether;
    uint256 stakedAmount2 = 3 ether;
    uint256 stakedAmount3 = 4 ether;

    uint256 totalStaked =
        stakedAmount0 + stakedAmount1 + stakedAmount2 + stakedAmount3;

    address[] nodes = [node0, node1, node2, node3];

    uint256[] stakedAmounts = [
        stakedAmount0,
        stakedAmount1,
        stakedAmount2,
        stakedAmount3
    ];

    uint256 tokenAmount_A = 1 ether;
    uint256 tokenAmount_B = 2 ether;
    uint256 tokenAmount_ether = 3 ether;

    EnumerableMap.AddressToUintMap tokensBalances;

    XERC20 xerc20_A;
    XERC20 xerc20_B;
    XERC20 xerc20_C;
    FeesManager feesManager;

    error FailedToTransfer();

    function _deployXERC20(
        string memory name,
        string memory symbol,
        uint256 supply
    ) internal returns (XERC20) {
        vm.startPrank(owner);
        XERC20 xerc20 = new XERC20(
            string.concat("p", name),
            string.concat("p", symbol),
            owner
        );

        xerc20.setLimits(owner, supply, supply);

        vm.stopPrank();
        return xerc20;
    }

    function setUp() public {
        xerc20_A = _deployXERC20("Token A", "TKNA", 100 ether);
        xerc20_B = _deployXERC20("Token B", "TKNB", 100 ether);
        xerc20_C = _deployXERC20("Token C", "TKNC", 100 ether);

        feesManager = new FeesManager(securityCouncil);

        vm.startPrank(owner);
        xerc20_A.mint(address(feesManager), tokenAmount_A);
        xerc20_B.mint(address(feesManager), tokenAmount_B);
        vm.deal(address(feesManager), tokenAmount_ether);

        tokensBalances.set(address(xerc20_A), tokenAmount_A);
        tokensBalances.set(address(xerc20_B), tokenAmount_B);
        tokensBalances.set(address(0), tokenAmount_ether);

        vm.startPrank(securityCouncil);

        for (uint i = 0; i < nodes.length; i++) {
            for (uint j = 0; j < tokensBalances.length(); j++) {
                (address token, uint256 balance) = tokensBalances.at(j);
                feesManager.setAllowance(
                    nodes[i],
                    token,
                    (balance * stakedAmounts[i]) / totalStaked
                );
            }
        }

        vm.stopPrank();
    }

    function test_revertWhen_NotSecurityCouncil() public {
        vm.startPrank(evil);
        _expectOwnableUnauthorizedAccountRevert(evil);
        feesManager.increaseAllowance(node0, address(xerc20_A), 1 ether);

        _expectOwnableUnauthorizedAccountRevert(evil);
        feesManager.setAllowance(node0, address(xerc20_A), 1 ether);

        vm.stopPrank();
    }

    function test_setAllowance_EmitAllowanceSet() public {
        uint256 amount = (stakedAmount0 * tokenAmount_A) / totalStaked;
        vm.prank(securityCouncil);
        vm.expectEmit(address(feesManager));
        emit FeesManager.AllowanceSet(node0, address(xerc20_C), amount);
        feesManager.setAllowance(node0, address(xerc20_C), amount);

        uint256 allowance = feesManager.allowances(node0, address(xerc20_C));

        assertEq(allowance, amount);
    }

    function test_increaseAllowance_EmitAllowanceIncreased() public {
        vm.startPrank(securityCouncil);

        uint256 delta = 1 ether;

        vm.expectEmit(address(feesManager));
        emit FeesManager.AllowanceIncreased(node0, address(xerc20_A), delta);
        feesManager.increaseAllowance(node0, address(xerc20_A), delta);

        uint256 allowance = feesManager.allowances(node0, address(xerc20_A));

        assertEq(
            allowance,
            ((stakedAmount0 * tokenAmount_A) / totalStaked) + delta
        );

        vm.stopPrank();
    }

    function test_withdraw_EmitUnsufficientBalance() public {
        vm.prank(node0);
        vm.expectEmit(address(feesManager));
        emit FeesManager.UnsufficientBalance(address(xerc20_C));
        feesManager.withdraw(address(xerc20_C));

        assertEq(xerc20_A.balanceOf(address(feesManager)), tokenAmount_A);
        assertEq(xerc20_B.balanceOf(address(feesManager)), tokenAmount_B);
        assertEq(address(feesManager).balance, tokenAmount_ether);
    }

    function test_withdraw_EmitUnsufficientAllowance() public {
        vm.prank(securityCouncil);
        feesManager.setAllowance(node1, address(xerc20_A), 0);
        vm.prank(node1);
        vm.expectEmit(address(feesManager));
        emit FeesManager.UnsufficientAllowance(address(xerc20_A));
        feesManager.withdraw(address(xerc20_A));

        assertEq(xerc20_A.balanceOf(address(feesManager)), tokenAmount_A);
        assertEq(xerc20_B.balanceOf(address(feesManager)), tokenAmount_B);
        assertEq(address(feesManager).balance, tokenAmount_ether);
    }

    function test_withdraw_EmitUnsufficientBalanceForEther() public {
        vm.deal(address(feesManager), 0);
        vm.prank(node0);
        vm.expectEmit(address(feesManager));
        emit FeesManager.UnsufficientBalance(address(0));
        feesManager.withdraw(address(0));

        assertEq(xerc20_A.balanceOf(address(feesManager)), tokenAmount_A);
        assertEq(xerc20_B.balanceOf(address(feesManager)), tokenAmount_B);
        assertEq(address(feesManager).balance, 0);
    }

    function test_withdraw_EmitUnsufficientAllowanceForEther() public {
        vm.prank(securityCouncil);
        feesManager.setAllowance(node1, address(0), 0);
        vm.prank(node1);
        vm.expectEmit(address(feesManager));
        emit FeesManager.UnsufficientAllowance(address(0));
        feesManager.withdraw(address(0));

        assertEq(xerc20_A.balanceOf(address(feesManager)), tokenAmount_A);
        assertEq(xerc20_B.balanceOf(address(feesManager)), tokenAmount_B);
        assertEq(address(feesManager).balance, tokenAmount_ether);
    }

    function test_withdraw_TransferTokenAllowanceToNode() public {
        uint256 expectedWithdrawnAmount = feesManager.allowances(
            node0,
            address(xerc20_A)
        );
        vm.prank(node0);
        vm.expectEmit(address(xerc20_A));
        emit IERC20.Transfer(
            address(feesManager),
            node0,
            expectedWithdrawnAmount
        );
        feesManager.withdraw(address(xerc20_A));

        assertEq(feesManager.allowances(node0, address(xerc20_A)), 0);
        assertEq(
            xerc20_A.balanceOf(address(feesManager)),
            tokenAmount_A - expectedWithdrawnAmount
        );
        assertEq(xerc20_B.balanceOf(address(feesManager)), tokenAmount_B);
        assertEq(address(feesManager).balance, tokenAmount_ether);
        assertEq(xerc20_A.balanceOf(node0), expectedWithdrawnAmount);
    }

    function test_withdraw_TransferEtherAllowanceToNode() public {
        uint256 expectedWithdrawnAmount = feesManager.allowances(
            node0,
            address(0)
        );

        uint256 node0PrevBalance = node0.balance;
        vm.prank(node0);
        feesManager.withdraw(address(0));

        assertEq(feesManager.allowances(node0, address(0)), 0);
        assertEq(
            address(feesManager).balance,
            tokenAmount_ether - expectedWithdrawnAmount
        );
        assertEq(xerc20_B.balanceOf(address(feesManager)), tokenAmount_B);
        assertEq(
            address(feesManager).balance,
            tokenAmount_ether - expectedWithdrawnAmount
        );
        assertEq(node0.balance, node0PrevBalance + expectedWithdrawnAmount);
    }

    function test_withdrawTo_TransferASetOfTokensAndEtherAllowancesToAddress()
        public
    {
        address[] memory tokens = new address[](3);
        tokens[0] = address(xerc20_A);
        tokens[1] = address(xerc20_B);
        tokens[2] = address(0);

        for (uint i = 0; i < nodes.length; i++) {
            vm.startPrank(nodes[i]);
            feesManager.withdraw(tokens);

            for (uint j = 0; j < tokens.length; j++) {
                uint256 allowance = feesManager.allowances(nodes[i], tokens[j]);

                assertEq(allowance, 0);

                uint256 expectedWithdrawnAmount = (tokensBalances.get(
                    tokens[j]
                ) * stakedAmounts[i]) / totalStaked;
                if (tokens[j] == address(0)) {
                    assertEq(nodes[i].balance, expectedWithdrawnAmount);
                } else {
                    assertEq(
                        XERC20(tokens[j]).balanceOf(nodes[i]),
                        expectedWithdrawnAmount
                    );
                }
            }
            vm.stopPrank();
        }

        for (uint i = 0; i < tokens.length; i++) {
            if (tokens[i] == address(0)) {
                assertEq(address(feesManager).balance, 0);
            } else {
                assertEq(XERC20(tokens[i]).balanceOf(address(feesManager)), 0);
            }
        }
    }
}
