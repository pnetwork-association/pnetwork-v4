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

    /// @dev Signers
    address user;
    address owner;
    address recipient;
    bytes statement;
    bytes signature;

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
        statement = vm.parseBytes(
            "0x01010000000000000000000000000000000000000000000000000000000000000001a0243a92f567cdd3e2511404bb6a798388d4ceae3f2c0be6ba277f9e45fae396f901ba942946259e0334f33a064106302415ad3391bed384e1a0b255de8953b7f0014df3bb00e17f11f43945268f579979c7124353070c2db98db90180000000000000000000000000000000000000000000000000000000000000002000000000000000000000000051a240271ab8ab9f9a21c82d9a85396b704e164d0000000000000000000000002b5ad5c4795c026514f8317c7a215e218dccd6cf00000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000007a690000000000000000000000000000000000000000000000000000000000007a6a00000000000000000000000000000000000000000000000000000000000026fc0000000000000000000000000000000000000000000000000000000000000140000000000000000000000000000000000000000000000000000000000000002a307836383133456239333632333732454546363230306633623164624333663831393637316342413639000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
        );

        signature = vm.parseBytes(
            "0xac00fb15ea05ef9745c7712ed20a06e07fec930128c2723cbc42af36d9ca4b05313715d777d770a0daae9303ced6d86915137ca1adb35a2b796037c2fc42abd11b"
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
        bytes32 sourceChainId = bytes32(CHAIN_A);
        bytes32 destinationChainId = bytes32(CHAIN_B);
        string memory recipientStr = vm.toString(recipient);
        vm.startPrank(user);

        erc20_A.approve(address(adapter_A), amount);

        vm.expectEmit(address(adapter_A));

        uint256 fees = (amount * 20) / 10000;
        uint256 netAmount = amount - fees;

        emit IAdapter.Swap(
            IAdapter.Operation(
                erc20Bytes_A,
                user,
                recipientStr,
                sourceChainId,
                destinationChainId,
                netAmount,
                data
            )
        );

        adapter_A.swap(
            address(erc20_A),
            amount,
            recipientStr,
            destinationChainId,
            data
        );

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
        bytes32 sourceChainId = bytes32(CHAIN_A);
        bytes32 destinationChainId = bytes32(CHAIN_B);
        string memory recipientStr = vm.toString(recipient);

        _sendXERC20To(owner, address(xerc20_A), user, userBalance);

        vm.startPrank(user);

        xerc20_A.approve(address(adapter_A), amount);

        vm.expectEmit(address(adapter_A));

        uint256 fees = (amount * 20) / 10000;
        uint256 netAmount = amount - fees;

        emit IAdapter.Swap(
            IAdapter.Operation(
                erc20Bytes_A,
                user,
                recipientStr,
                sourceChainId,
                destinationChainId,
                netAmount,
                data
            )
        );

        adapter_A.swap(
            address(xerc20_A),
            amount,
            recipientStr,
            destinationChainId,
            data
        );

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

        uint256 fees = (amount * 20) / 10000;
        uint256 netAmount = amount - fees;

        vm.expectEmit(address(xerc20_B));
        emit IERC20.Transfer(address(0), recipient, netAmount);
        vm.expectEmit(address(adapter_B));
        emit IAdapter.Settled();

        adapter_B.settle(operation, IPAM.Metadata(statement, signature));

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

        IAdapter(adapter_B).settle(
            operation,
            IPAM.Metadata(statement, signature)
        );

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

        bytes memory stm2 = vm.parseBytes(
            "0x01010000000000000000000000000000000000000000000000000000000000000001a0243a92f567cdd3e2511404bb6a798388d4ceae3f2c0be6ba277f9e45fae396f901ba9463f58053c9499e1104a6f6c6d2581d6d83067eebe1a0b255de8953b7f0014df3bb00e17f11f43945268f579979c7124353070c2db98db90180000000000000000000000000000000000000000000000000000000000000002000000000000000000000000051a240271ab8ab9f9a21c82d9a85396b704e164d0000000000000000000000006813eb9362372eef6200f3b1dbc3f819671cba6900000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000007a6a0000000000000000000000000000000000000000000000000000000000007a6a00000000000000000000000000000000000000000000000000000000000013880000000000000000000000000000000000000000000000000000000000000140000000000000000000000000000000000000000000000000000000000000002a307836383133456239333632333732454546363230306633623164624333663831393637316342413639000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
        );
        bytes memory sig2 = vm.parseBytes(
            "0x092b17ae9cbad765d2cc90df2e26a1281fe49dfff13144a18f6421dae80e64631c3606846668c2851a63347ece8bd978037c8b22c3e4d078386cb688699d6c5b1b"
        );

        vm.expectEmit(address(xerc20_A));
        emit IERC20.Transfer(address(lockbox_A), address(0), netAmount);
        vm.expectEmit(address(erc20_A));
        emit IERC20.Transfer(address(lockbox_A), recipient, netAmount);
        vm.expectEmit(address(adapter_A));
        emit IAdapter.Settled();
        IAdapter(adapter_A).settle(pegoutOperation, IPAM.Metadata(stm2, sig2));

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
