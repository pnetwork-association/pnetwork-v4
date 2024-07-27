// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Vm} from "forge-std/Vm.sol";
import {Test, stdMath} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";

import {PAM} from "../../src/PAM.sol";
import {Helper} from "./Helper.sol";
import {Adapter} from "../../src/Adapter.sol";
import {FeesManager} from "../../src/FeesManager.sol";
import {IPAM} from "../../src/interfaces/IPAM.sol";
import {IAdapter} from "../../src/interfaces/IAdapter.sol";

import {XERC20} from "../../src/xerc20/XERC20.sol";
import {ERC20Test} from "../../src/test/ERC20Test.sol";
import {DataReceiver} from "../../src/test/DataReceiver.sol";
import {XERC20Lockbox} from "../../src/xerc20/XERC20Lockbox.sol";

import "forge-std/console.sol";

contract IntegrationTest is Test, Helper {
    uint256 constant CHAIN_A = 31337;
    uint256 constant CHAIN_B = 31338;
    string attestatorPrivateKey =
        "0xdfcc79a57e91c42d7eea05f82a08bd1b7e77f30236bb7c56fe98d3366a1929c4";
    string attestatorPublicKey =
        "0x0480472f799469d9af8790307a022802785c2b1e2f9c0930bdf9bafe193245e7a37cf43c720edc0892a2a97050005207e412f2227b1d92a78b8ee366fe4fea5ac9";
    address attestatorAddress = 0x3Da392a1403440087cA765E20B7c442b8129392b;
    bytes32 SWAP_TOPIC = IAdapter.Swap.selector;

    /// @dev Signers
    address user;
    address owner;
    address recipient;

    /// @dev Contracts
    XERC20 xerc20_A;
    ERC20 erc20_A;
    Adapter adapter_A;
    XERC20Lockbox lockbox_A;
    FeesManager feesManager_A;
    PAM pam_A;

    XERC20 xerc20_B;
    ERC20 erc20_B;
    Adapter adapter_B;
    XERC20Lockbox lockbox_B;
    FeesManager feesManager_B;
    PAM pam_B;

    /// @dev Variables
    uint256 userBalance;
    bytes32 erc20Bytes_A;
    bytes32 erc20Bytes_B;
    IAdapter.Operation operation;
    IPAM.Metadata metadata;

    constructor() {
        owner = vm.addr(1);
        user = vm.addr(2);
        recipient = vm.addr(3);
        userBalance = 50000;
    }

    function setUp() public {
        (
            adapter_A,
            erc20_A,
            xerc20_A,
            lockbox_A,
            feesManager_A,
            pam_A
        ) = _setupChain(CHAIN_A, owner, address(0));

        (
            adapter_B,
            erc20_B,
            xerc20_B,
            lockbox_B,
            feesManager_B,
            pam_B
        ) = _setupChain(CHAIN_B, owner, address(erc20_A));

        _transferToken(address(erc20_A), owner, user, userBalance);

        erc20Bytes_A = bytes32(abi.encode(address(erc20_A)));
        erc20Bytes_B = bytes32(abi.encode(address(erc20_B)));

        vm.startPrank(owner);
        pam_A.setEmitter(
            bytes32(CHAIN_B),
            bytes32(abi.encode(address(adapter_B)))
        );
        pam_B.setEmitter(
            bytes32(CHAIN_A),
            bytes32(abi.encode(address(adapter_A)))
        );
        vm.stopPrank();
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
            IAdapter.EventBytes(
                bytes.concat(
                    bytes32(nonce),
                    erc20Bytes_A,
                    bytes32(CHAIN_B),
                    bytes32(amount - fees),
                    bytes32(uint256(uint160(user))),
                    bytes32(bytes(recipientStr).length),
                    bytes(recipientStr),
                    data
                )
            )
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

        // If the user has the xERC20 already means
        // they have been wrapped already by the user
        // so we just transfer the collateral here to
        // reflect that
        _transferToken(address(erc20_A), owner, address(lockbox_A), amount);
        _sendXERC20To(owner, address(xerc20_A), user, userBalance);

        vm.startPrank(user);

        xerc20_A.approve(address(adapter_A), amount);

        vm.expectEmit(address(adapter_A));

        uint256 nonce = 0;
        uint256 fees = (amount * 20) / 10000;

        emit IAdapter.Swap(
            nonce,
            IAdapter.EventBytes(
                bytes.concat(
                    bytes32(nonce),
                    erc20Bytes_A,
                    bytes32(CHAIN_B),
                    bytes32(amount - fees),
                    bytes32(uint256(uint160(user))),
                    bytes32(bytes(recipientStr).length),
                    bytes(recipientStr),
                    data
                )
            )
        );

        adapter_A.swap(address(xerc20_A), amount, CHAIN_B, recipientStr, data);

        uint256 U = xerc20_A.balanceOf(user);
        uint256 L = erc20_A.balanceOf(address(lockbox_A));
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
            address(erc20_A),
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
        uint256 fees = (amount * 20) / 10000;
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
            address(erc20_A),
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
        uint256 fees = (pegoutAmount * 20) / 10000;
        uint256 netAmount = pegoutAmount - fees;
        uint256 prevBalanceLockbox_A = erc20_A.balanceOf(address(lockbox_A));
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
        emit IERC20.Transfer(address(lockbox_A), address(0), netAmount);
        vm.expectEmit(address(erc20_A));
        emit IERC20.Transfer(address(lockbox_A), recipient, netAmount);
        vm.expectEmit(address(adapter_A));
        emit IAdapter.Settled(eventId);
        IAdapter(adapter_A).settle(operation, metadata);

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

        assertEq(
            xerc20_A.balanceOf(address(feesManager_A)),
            prevBalanceFeesManager_A + fees
        );
    }

    function test_settle_e2e_withUserData() public {
        uint256 amount = 10000;
        DataReceiver receiver = new DataReceiver();
        bytes memory data = vm.parseBytes("0xC0FFEE");

        vm.recordLogs();
        _performERC20Swap(
            CHAIN_A,
            address(erc20_A),
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
        uint256 fees = (amount * 20) / 10000;
        emit IERC20.Transfer(address(0), address(receiver), amount - fees);
        vm.expectEmit(address(receiver));
        emit DataReceiver.DataReceived(data);
        vm.expectEmit(address(adapter_B));
        emit IAdapter.Settled(eventId);

        adapter_B.settle(operation, metadata);

        uint256 R = xerc20_B.balanceOf(address(receiver));
        uint256 A = xerc20_B.balanceOf(address(adapter_B));

        assertEq(R, amount - fees);
        assertEq(A, 0);
    }
}
