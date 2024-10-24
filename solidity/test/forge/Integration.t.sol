// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Vm} from "forge-std/Vm.sol";
import {Test, stdMath} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";

import {PAM} from "../../src/contracts/PAM.sol";
import {Helper} from "./Helper.sol";
import {Adapter} from "../../src/contracts/Adapter.sol";
import {FeesManager} from "../../src/contracts/FeesManager.sol";
import {IPAM} from "../../src/interfaces/IPAM.sol";
import {IAdapter} from "../../src/interfaces/IAdapter.sol";

import {XERC20} from "../../src/contracts/XERC20.sol";
import {ERC20Test} from "../../src/contracts/test/ERC20Test.sol";
import {DataReceiver} from "../../src/contracts/test/DataReceiver.sol";
import {XERC20Lockbox} from "../../src/contracts/XERC20Lockbox.sol";
import {IXERC20Lockbox} from "../../src/interfaces/IXERC20Lockbox.sol";
import {DataReceiverReentrancy} from "../../src/contracts/test/DataReceiverReentrancy.sol";

import "forge-std/console.sol";

contract IntegrationTest is Test, Helper {
    uint256 constant CHAIN_A = 31337;
    uint256 constant CHAIN_B = 31338;
    uint256 constant FEES_BASIS_POINTS = 1750;
    uint256 constant FEES_DIVISOR = 1000000;
    bool constant LOCAL = true;
    bool constant NOT_LOCAL = false;

    string attestatorPrivateKey =
        "0xdfcc79a57e91c42d7eea05f82a08bd1b7e77f30236bb7c56fe98d3366a1929c4";
    string attestatorPublicKey =
        "0x0480472f799469d9af8790307a022802785c2b1e2f9c0930bdf9bafe193245e7a37cf43c720edc0892a2a97050005207e412f2227b1d92a78b8ee366fe4fea5ac9";
    address attestatorAddress = 0x3Da392a1403440087cA765E20B7c442b8129392b;

    /// @dev Signers
    address owner_A;
    address owner_B;

    /// @dev Contracts
    ERC20 erc20;
    XERC20 xerc20_A;
    Adapter adapter_A;
    XERC20Lockbox lockbox_A;
    FeesManager feesManager_A;
    PAM pam_A;

    XERC20 xerc20_B;
    Adapter adapter_B;
    XERC20Lockbox lockbox_B;
    FeesManager feesManager_B;
    PAM pam_B;

    /// @dev Variables
    uint256 userBalance;
    bytes32 erc20Bytes;
    IAdapter.Operation operation;
    IPAM.Metadata metadata;

    constructor() {
        owner_A = vm.addr(1);
        user = vm.addr(2);
        recipient = vm.addr(3);
        owner_B = vm.addr(4);
        userBalance = 50000;
    }

    function setUp() public {
        vm.prank(owner_A);
        erc20 = ERC20(new ERC20Test(erc20Name, erc20Symbol, erc20Supply));
        erc20Bytes = bytes32(abi.encode(address(erc20)));

        (xerc20_A, lockbox_A, adapter_A, feesManager_A, pam_A) = _setupChain(
            CHAIN_A,
            owner_A,
            address(erc20),
            LOCAL
        );

        (xerc20_B, lockbox_B, adapter_B, feesManager_B, pam_B) = _setupChain(
            CHAIN_B,
            owner_B,
            address(erc20),
            NOT_LOCAL
        );

        _transferToken(address(erc20), owner_A, user, userBalance);

        vm.chainId(CHAIN_B);
        vm.startPrank(owner_B);
        pam_B.setEmitter(
            bytes32(CHAIN_A),
            bytes32(abi.encode(address(adapter_A)))
        );
        pam_B.setTopicZero(bytes32(CHAIN_A), SWAP_TOPIC);
        vm.stopPrank();

        vm.chainId(CHAIN_A);
        vm.startPrank(owner_A);
        pam_A.setEmitter(
            bytes32(CHAIN_B),
            bytes32(abi.encode(address(adapter_B)))
        );
        pam_A.setTopicZero(bytes32(CHAIN_B), SWAP_TOPIC);
        vm.stopPrank();
    }

    function test_swap_EmitsSwapWithERC20() public {
        uint256 amount = 10000;
        bytes memory data = "";
        string memory recipientStr = vm.toString(recipient);
        vm.startPrank(user);

        erc20.approve(address(adapter_A), amount);

        uint256 fees = (amount * FEES_BASIS_POINTS) / FEES_DIVISOR;
        uint256 netAmount = amount - fees;
        uint256 nonce = 0;

        vm.expectEmit(address(adapter_A));

        bytes32 topic0 = SWAP_TOPIC;
        bytes memory eventBytes = bytes.concat(
            erc20Bytes,
            bytes32(CHAIN_B),
            bytes32(netAmount),
            bytes32(uint256(uint160(user))),
            bytes32(bytes(recipientStr).length),
            bytes(recipientStr),
            bytes32(bytes(data).length),
            data
        );
        assembly {
            // For memory bytes, skip the length prefix (32 bytes)
            let dataStart := add(eventBytes, 32)
            let length := mload(eventBytes)
            log2(
                dataStart,
                length,
                topic0,
                nonce
            )
        }
        // emit IAdapter.Swap(
        //     nonce,
        //     erc20Bytes,
        //     bytes32(CHAIN_B),
        //     bytes32(netAmount),
        //     bytes32(uint256(uint160(user))),
        //     bytes(recipientStr),
        //     data
        // );

        adapter_A.swap(address(erc20), amount, CHAIN_B, recipientStr, data);

        uint256 U = erc20.balanceOf(user);
        uint256 L = erc20.balanceOf(address(lockbox_A));
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

        // If the user has the xERC20 already means
        // they have been wrapped already by the user
        // so we just transfer the collateral here to
        // reflect that
        _transferToken(address(erc20), owner_A, address(lockbox_A), amount);
        _sendXERC20To(owner_A, address(xerc20_A), user, userBalance);

        vm.startPrank(user);

        xerc20_A.approve(address(adapter_A), amount);

        vm.expectEmit(address(adapter_A));

        uint256 nonce = 0;
        uint256 fees = (amount * FEES_BASIS_POINTS) / FEES_DIVISOR;

        // emit IAdapter.Swap(
        //     nonce,
        //     erc20Bytes,
        //     bytes32(CHAIN_B),
        //     bytes32(amount - fees),
        //     bytes32(uint256(uint160(user))),
        //     bytes(recipientStr),
        //     data
        // );

        bytes32 topic0 = SWAP_TOPIC;
        bytes memory eventBytes = bytes.concat(
            erc20Bytes,
            bytes32(CHAIN_B),
            bytes32(amount - fees),
            bytes32(uint256(uint160(user))),
            bytes32(bytes(recipientStr).length),
            bytes(recipientStr),
            bytes32(bytes(data).length),
            data
        );
        assembly {
            // For memory bytes, skip the length prefix (32 bytes)
            let dataStart := add(eventBytes, 32)
            let length := mload(eventBytes)
            log2(
                dataStart,
                length,
                topic0,
                nonce
            )
        }

        adapter_A.swap(address(xerc20_A), amount, CHAIN_B, recipientStr, data);

        uint256 U = xerc20_A.balanceOf(user);
        uint256 L = erc20.balanceOf(address(lockbox_A));
        uint256 A = xerc20_A.balanceOf(address(adapter_A));
        uint256 F = xerc20_A.balanceOf(address(feesManager_A));

        assertEq(U, userBalance - amount);
        assertEq(L, amount);
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
            address(erc20),
            user,
            address(adapter_A),
            CHAIN_B,
            recipient,
            amount,
            data
        );

        Vm.Log[] memory logs = vm.getRecordedLogs();
        operation = _getOperationFromLogs(logs, SWAP_TOPIC);
        metadata = _getMetadataFromLogs(
            logs,
            SWAP_TOPIC,
            operation,
            attestatorPrivateKey
        );

        bytes32 eventId = _getEventId(metadata.preimage);

        vm.chainId(CHAIN_B);

        vm.expectEmit(address(xerc20_B));
        uint256 fees = (amount * FEES_BASIS_POINTS) / FEES_DIVISOR;
        emit IERC20.Transfer(address(0), recipient, amount - fees);
        vm.expectEmit(address(adapter_B));
        emit IAdapter.Settled(eventId);

        adapter_B.settle(operation, metadata);

        uint256 R = xerc20_B.balanceOf(recipient);
        uint256 A = xerc20_B.balanceOf(address(adapter_B));

        assertEq(R, amount - fees);
        assertEq(A, 0);
    }

    function test_swap_e2e_Pegout() public {
        uint256 amount = 10000;
        bytes memory data = "";

        vm.recordLogs();
        _performERC20Swap(
            CHAIN_A,
            address(erc20),
            user,
            address(adapter_A),
            CHAIN_B,
            recipient,
            amount,
            data
        );

        Vm.Log[] memory logs = vm.getRecordedLogs();
        operation = _getOperationFromLogs(logs, SWAP_TOPIC);
        metadata = _getMetadataFromLogs(
            logs,
            SWAP_TOPIC,
            operation,
            attestatorPrivateKey
        );

        vm.chainId(CHAIN_B);

        IAdapter(adapter_B).settle(operation, metadata);

        // Pegout
        uint256 pegoutAmount = 5000;
        uint256 fees = (pegoutAmount * FEES_BASIS_POINTS) / FEES_DIVISOR;
        uint256 netAmount = pegoutAmount - fees;
        uint256 prevBalanceLockbox_A = erc20.balanceOf(address(lockbox_A));
        uint256 prevBalanceFeesManager_A = xerc20_A.balanceOf(
            address(feesManager_A)
        );

        vm.recordLogs();
        _performERC20Swap(
            CHAIN_B,
            address(xerc20_B),
            recipient,
            address(adapter_B),
            CHAIN_A,
            recipient,
            pegoutAmount,
            data
        );

        logs = vm.getRecordedLogs();
        for (uint256 i = 0; i < logs.length; i++) {
            Vm.Log memory log = logs[i];

            // Print log details
            console.log("Log %d:", i);
            // console.log("Address: %s", log.address);
            console.logBytes(log.data);
            console.logBytes32(log.topics[0]); // You can print multiple topics if necessary
            console.logBytes32(log.topics[1]); // You can print multiple topics if necessary
        }
        operation = _getOperationFromLogs(logs, SWAP_TOPIC);
        metadata = _getMetadataFromLogs(
            logs,
            SWAP_TOPIC,
            operation,
            attestatorPrivateKey
        );

        vm.chainId(CHAIN_A);

        bytes32 eventId = _getEventId(metadata.preimage);

        vm.expectEmit(address(xerc20_A));
        emit IERC20.Transfer(address(0), address(adapter_A), netAmount); // mint
        vm.expectEmit(address(xerc20_A));
        emit IERC20.Approval(address(adapter_A), address(lockbox_A), netAmount);
        vm.expectEmit(address(lockbox_A));
        emit IXERC20Lockbox.Withdraw(address(recipient), netAmount);
        vm.expectEmit(address(xerc20_A));
        emit IERC20.Transfer(address(adapter_A), address(0), netAmount); // burn
        vm.expectEmit(address(erc20));
        emit IERC20.Transfer(address(lockbox_A), recipient, netAmount);
        vm.expectEmit(address(adapter_A));
        emit IAdapter.Settled(eventId);
        IAdapter(adapter_A).settle(operation, metadata);

        assertEq(xerc20_A.balanceOf(recipient), 0);
        assertEq(xerc20_A.balanceOf(address(adapter_A)), 0);
        assertEq(xerc20_A.balanceOf(address(lockbox_A)), 0);
        assertEq(erc20.balanceOf(recipient), netAmount);

        assertEq(
            stdMath.delta(
                erc20.balanceOf(address(lockbox_A)),
                prevBalanceLockbox_A
            ),
            netAmount
        );

        assertEq(
            xerc20_A.balanceOf(address(feesManager_A)),
            prevBalanceFeesManager_A
        );
    }

    function test_settle_e2e_withUserData() public {
        uint256 amount = 10000;
        DataReceiver receiver = new DataReceiver();
        bytes memory data = vm.parseBytes("0xC0FFEE");

        vm.recordLogs();
        _performERC20Swap(
            CHAIN_A,
            address(erc20),
            user,
            address(adapter_A),
            CHAIN_B,
            address(receiver), // recipient
            amount,
            data
        );

        Vm.Log[] memory logs = vm.getRecordedLogs();
        operation = _getOperationFromLogs(logs, SWAP_TOPIC);
        metadata = _getMetadataFromLogs(
            logs,
            SWAP_TOPIC,
            operation,
            attestatorPrivateKey
        );

        bytes32 eventId = _getEventId(metadata.preimage);

        vm.chainId(CHAIN_B);

        vm.expectEmit(address(xerc20_B));
        uint256 fees = (amount * FEES_BASIS_POINTS) / FEES_DIVISOR;
        emit IERC20.Transfer(address(0), address(receiver), amount - fees);
        vm.expectEmit(address(receiver));
        emit DataReceiver.DataReceived(data);
        vm.expectEmit(address(adapter_B));
        emit IAdapter.Settled(eventId);

        adapter_B.settle(operation, metadata);

        uint256 R = xerc20_B.balanceOf(address(receiver));
        uint256 A = xerc20_B.balanceOf(address(adapter_B));
        uint256 T = xerc20_B.totalSupply();

        assertEq(R, amount - fees);
        assertEq(A, 0);
        assertEq(T, amount - fees);
    }

    function test_settle_e2e_RevertWhen_ReentrancyAttack() public {
        uint256 amount = 10000;

        DataReceiverReentrancy receiver = new DataReceiverReentrancy();

        // This is operation and signed metadata
        // crafted for the test
        bytes memory data = vm.parseBytes(
            "0x000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000001a0ad7c5bef027816a800da1736444fb58a807ef4c9603b7848673f7e3a68eb14a52a80e1ef1d7842f27f2e6be0972bb708b9a135c38860dbe73c27c3486c34f4de00000000000000000000000000000000000000000000000000000000000000000000000000000000000000002946259e0334f33a064106302415ad3391bed3840000000000000000000000000000000000000000000000000000000000007a690000000000000000000000000000000000000000000000000000000000007a6a00000000000000000000000000000000000000000000000000000000000026fc0000000000000000000000002b5ad5c4795c026514f8317c7a215e218dccd6cf0000000000000000000000006813eb9362372eef6200f3b1dbc3f819671cba690000000000000000000000000000000000000000000000000000000000000140000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000280000000000000000000000000000000000000000000000000000000000000020201010000000000000000000000000000000000000000000000000000000000007a69ad7c5bef027816a800da1736444fb58a807ef4c9603b7848673f7e3a68eb14a52a80e1ef1d7842f27f2e6be0972bb708b9a135c38860dbe73c27c3486c34f4de0000000000000000000000006d411e0a54382ed43f02410ce1c7a7c122afa6e1a68959eed8a7e77ce926c4c04ee06434559ae1db7f636ceacd659f5c9126f1c30000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000ea00000000000000000000000000000000000000000000000000000000000000000000000000000000000000002946259e0334f33a064106302415ad3391bed3840000000000000000000000000000000000000000000000000000000000007a6a00000000000000000000000000000000000000000000000000000000000026fc0000000000000000000000002b5ad5c4795c026514f8317c7a215e218dccd6cf000000000000000000000000000000000000000000000000000000000000002a3078363831334562393336323337324545463632303066336231646243336638313936373163424136390000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000416493671d8cea48c1f89a2b0599493a1f6309b69df5214e737dbcb1440cd5c41061b1977499b273c161f4ac2fc7a4d4f0e8d0ce5a052b384019d218220fdc78a81c00000000000000000000000000000000000000000000000000000000000000"
        );

        vm.recordLogs();
        _performERC20Swap(
            CHAIN_A,
            address(erc20),
            user,
            address(adapter_A),
            CHAIN_B,
            address(receiver), // recipient
            amount,
            data
        );

        Vm.Log[] memory logs = vm.getRecordedLogs();
        operation = _getOperationFromLogs(logs, SWAP_TOPIC);
        metadata = _getMetadataFromLogs(
            logs,
            SWAP_TOPIC,
            operation,
            attestatorPrivateKey
        );

        bytes32 eventId = _getEventId(metadata.preimage);

        vm.chainId(CHAIN_B);

        // Traces shows the failure is due to ReentrancyGuardReentrantCall()
        // but we can't test it due to https://book.getfoundry.sh/cheatcodes/expect-revert#description
        vm.expectEmit(address(adapter_B));
        emit IAdapter.ReceiveUserDataFailed();
        vm.expectEmit(address(adapter_B));
        emit IAdapter.Settled(eventId);

        adapter_B.settle(operation, metadata);
    }

    function test_settle_e2e_RevertWhen_ReplayAttack() public {
        uint256 amount = 10000;

        bytes memory data = vm.parseBytes("0x");

        vm.recordLogs();
        _performERC20Swap(
            CHAIN_A,
            address(erc20),
            user,
            address(adapter_A),
            CHAIN_B,
            address(recipient),
            amount,
            data
        );

        Vm.Log[] memory logs = vm.getRecordedLogs();
        operation = _getOperationFromLogs(logs, SWAP_TOPIC);
        metadata = _getMetadataFromLogs(
            logs,
            SWAP_TOPIC,
            operation,
            attestatorPrivateKey
        );

        bytes32 eventId = _getEventId(metadata.preimage);

        vm.chainId(CHAIN_B);

        vm.expectEmit(address(adapter_B));
        emit IAdapter.Settled(eventId);
        adapter_B.settle(operation, metadata);

        vm.expectRevert(
            abi.encodeWithSelector(IAdapter.AlreadyProcessed.selector, eventId)
        );
        adapter_B.settle(operation, metadata);
    }
}
