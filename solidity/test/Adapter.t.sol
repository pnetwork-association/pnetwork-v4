// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Vm} from "forge-std/Vm.sol";
import {Test, stdMath} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";

import {PAM} from "../src/PAM.sol";
import {Helper} from "./Helper.sol";
import {Adapter} from "../src/Adapter.sol";
import {FeesManager} from "../src/FeesManager.sol";
import {XERC20Registry} from "../src/XERC20Registry.sol";
import {IPAM} from "../src/interfaces/IPAM.sol";
import {IAdapter} from "../src/interfaces/IAdapter.sol";

import {XERC20} from "../src/test/XERC20.sol";
import {ERC20Test} from "../src/test/ERC20Test.sol";
import {XERC20Lockbox} from "../src/test/XERC20Lockbox.sol";

import "forge-std/console.sol";

contract AdapterTest is Test, Helper {
    uint256 constant CHAIN_A = 31337;
    uint256 constant CHAIN_B = 31338;
    bytes32 DEFAULT_TX_HASH =
        vm.parseBytes32(
            "0x11365bbee18058f12c27236e891a66999c4325879865303f785854e9169c257a"
        );
    bytes32 DEFAULT_BLOCK_HASH =
        vm.parseBytes32(
            "0xa880cb2ab67ec9140db0f6de238b34d4108f6fab99315772ee987ef9002e0e63"
        );

    /// @dev Signers
    address user;
    address owner;
    address recipient;
    bytes metadata;

    /// @dev Contracts
    XERC20 xerc20_A;
    ERC20 erc20_A;
    Adapter adapter_A;
    XERC20Lockbox lockbox_A;
    FeesManager feesManager_A;
    XERC20Registry registry_A;
    PAM pam_A;

    XERC20 xerc20_B;
    ERC20 erc20_B;
    Adapter adapter_B;
    XERC20Lockbox lockbox_B;
    FeesManager feesManager_B;
    XERC20Registry registry_B;
    PAM pam_B;

    /// @dev Variables
    uint256 userBalance;
    bytes32 erc20Bytes_A;
    bytes32 erc20Bytes_B;

    constructor() {
        owner = vm.addr(1);
        user = vm.addr(2);
        recipient = vm.addr(3);
        userBalance = 50000;
        metadata = vm.parseBytes(
            "0x010100000000000000000000000000000000000000000000000000000000000000017baedb36bc429b74574c95a862726dff23af32a7ead38d0f5f32f93ed26f479f29510455db8063018b662f89746c381a361a2c0abc821d5d45ff1f61ffde50820173f734c80ec0df007d418f99c9aa514202f37bfa1baad273d1d873f6cd2e471c"
        );
    }

    function setUp() public {
        (
            registry_A,
            adapter_A,
            erc20_A,
            xerc20_A,
            lockbox_A,
            feesManager_A,
            pam_A
        ) = _setupChain(CHAIN_A, owner, address(0));

        (
            registry_B,
            adapter_B,
            erc20_B,
            xerc20_B,
            lockbox_B,
            feesManager_B,
            pam_B
        ) = _setupChain(CHAIN_B, owner, address(erc20_A));

        _registerPair(
            CHAIN_A,
            owner,
            owner,
            registry_A,
            address(erc20_A),
            address(xerc20_A)
        );

        _registerPair(
            CHAIN_B,
            owner,
            owner,
            registry_B,
            address(erc20_B),
            address(xerc20_B)
        );

        _transferToken(address(erc20_A), owner, user, userBalance);

        erc20Bytes_A = bytes32(abi.encode(address(erc20_A)));
        erc20Bytes_B = bytes32(abi.encode(address(erc20_B)));
    }

    function test_swap_EmitsSwapWithERC20() public {
        uint256 amount = 10000;
        bytes memory data = "";
        string memory recipientStr = vm.toString(recipient);
        vm.startPrank(user);

        erc20_A.approve(address(adapter_A), amount);

        vm.expectEmit(address(adapter_A));

        uint256 fees = (amount * 20) / 10000;
        uint256 nonce = 0;

        emit IAdapter.Swap(
            nonce,
            erc20Bytes_A,
            block.chainid,
            CHAIN_B,
            amount - fees,
            user,
            recipientStr,
            data
        );

        adapter_A.swap(address(erc20_A), amount, CHAIN_B, recipientStr, data);

        uint256 U = erc20_A.balanceOf(user);
        uint256 L = erc20_A.balanceOf(address(lockbox_A));
        uint256 A = xerc20_A.balanceOf(address(adapter_A));
        uint256 F = xerc20_A.balanceOf(address(feesManager_A));

        assertEq(U, userBalance - amount);
        assertEq(L, amount);
        assertEq(A, 0);
        assertEq(F, fees);

        vm.stopPrank();
    }

    function test_swap_EmitsSwapWithXERC20() public {
        uint256 amount = 10000;
        bytes memory data = "";
        string memory recipientStr = vm.toString(recipient);

        _sendXERC20To(owner, address(xerc20_A), user, userBalance);

        vm.startPrank(user);

        xerc20_A.approve(address(adapter_A), amount);

        vm.expectEmit(address(adapter_A));

        uint256 nonce = 0;
        uint256 fees = (amount * 20) / 10000;

        emit IAdapter.Swap(
            nonce,
            erc20Bytes_A,
            block.chainid,
            CHAIN_B,
            amount - fees,
            user,
            recipientStr,
            data
        );

        adapter_A.swap(address(xerc20_A), amount, CHAIN_B, recipientStr, data);

        uint256 U = xerc20_A.balanceOf(user);
        uint256 L = xerc20_A.balanceOf(address(lockbox_A));
        uint256 A = xerc20_A.balanceOf(address(adapter_A));
        uint256 F = xerc20_A.balanceOf(address(feesManager_A));

        assertEq(U, userBalance - amount);
        assertEq(L, 0);
        assertEq(A, 0);
        assertEq(F, fees);

        vm.stopPrank();
    }

    function test_settle_e2e_withERC20() public {
        uint256 nonce = 0;
        uint256 amount = 10000;
        bytes memory data = "";

        vm.recordLogs();
        _performERC20Swap(
            CHAIN_A,
            address(erc20_A),
            user,
            address(adapter_A),
            CHAIN_B,
            recipient,
            amount,
            data
        );

        _getOperationFromRecordedLogs();

        uint256 fees = (amount * 20) / 10000;
        uint256 netAmount = amount - fees;
        console.log("user", user);
        console.log("recipient", recipient);
        IAdapter.Operation memory operation = IAdapter.Operation(
            DEFAULT_BLOCK_HASH,
            DEFAULT_TX_HASH,
            adapter_A.SWAP_EVENT_TOPIC(),
            nonce,
            erc20Bytes_A,
            bytes32(CHAIN_A),
            bytes32(CHAIN_B),
            netAmount,
            user,
            recipient,
            data
        );

        vm.chainId(CHAIN_B);

        vm.expectEmit(address(xerc20_B));
        emit IERC20.Transfer(address(0), recipient, netAmount);
        vm.expectEmit(address(adapter_B));
        emit IAdapter.Settled();

        adapter_B.settle(operation, metadata);

        uint256 R = xerc20_B.balanceOf(recipient);
        uint256 A = xerc20_B.balanceOf(address(adapter_B));

        assertEq(R, netAmount);
        assertEq(A, 0);
    }

    function test_swap_e2e_Pegout() public {
        uint256 amount = 10000;
        bytes memory data = "";

        vm.recordLogs();
        _performERC20Swap(
            CHAIN_A,
            address(erc20_A),
            user,
            address(adapter_A),
            CHAIN_B,
            recipient,
            amount,
            data
        );

        IAdapter.Operation memory operation = _getOperationFromRecordedLogs();

        vm.chainId(CHAIN_B);

        IAdapter(adapter_B).settle(operation, metadata);

        // Pegout
        uint256 pegoutAmount = 5000;
        uint256 fees = (pegoutAmount * 20) / 10000;
        uint256 netAmount = pegoutAmount - fees;
        uint256 prevBalanceLockbox_A = erc20_A.balanceOf(address(lockbox_A));

        vm.recordLogs();
        _performERC20Swap(
            CHAIN_B,
            address(xerc20_B),
            recipient,
            address(adapter_B),
            CHAIN_B,
            recipient,
            pegoutAmount,
            data
        );

        IAdapter.Operation
            memory pegoutOperation = _getOperationFromRecordedLogs();

        vm.chainId(CHAIN_A);

        bytes memory metadata2 = vm.parseBytes("");

        vm.expectEmit(address(xerc20_A));
        emit IERC20.Transfer(address(lockbox_A), address(0), netAmount);
        vm.expectEmit(address(erc20_A));
        emit IERC20.Transfer(address(lockbox_A), recipient, netAmount);
        vm.expectEmit(address(adapter_A));
        emit IAdapter.Settled();
        IAdapter(adapter_A).settle(pegoutOperation, metadata);

        assertEq(xerc20_A.balanceOf(recipient), 0);
        assertEq(xerc20_A.balanceOf(address(adapter_A)), 0);
        assertEq(xerc20_A.balanceOf(address(lockbox_A)), 0);
        assertEq(erc20_A.balanceOf(recipient), netAmount);

        assertEq(
            stdMath.delta(
                erc20_A.balanceOf(address(lockbox_A)),
                prevBalanceLockbox_A
            ),
            netAmount
        );
    }
}
