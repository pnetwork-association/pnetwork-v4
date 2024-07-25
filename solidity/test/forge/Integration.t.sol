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
import {XERC20Registry} from "../../src/XERC20Registry.sol";
import {IPAM} from "../../src/interfaces/IPAM.sol";
import {IAdapter} from "../../src/interfaces/IAdapter.sol";

import {XERC20} from "../../src/xerc20/XERC20.sol";
import {ERC20Test} from "../../src/test/ERC20Test.sol";
import {XERC20Lockbox} from "../../src/xerc20/XERC20Lockbox.sol";

import "forge-std/console.sol";

contract IntegrationTest is Test, Helper {
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
    IPAM.Metadata metadata;

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
        metadata = IPAM.Metadata(
            vm.parseBytes(
                "0x01010000000000000000000000000000000000000000000000000000000000007a69a880cb2ab67ec9140db0f6de238b34d4108f6fab99315772ee987ef9002e0e6311365bbee18058f12c27236e891a66999c4325879865303f785854e9169c257a0000000000000000000000002946259e0334f33a064106302415ad3391bed384a68959eed8a7e77ce926c4c04ee06434559ae1db7f636ceacd659f5c9126f1c3000000000000000000000000000000000000000000000000000000000000000000000000000000000000000051a240271ab8ab9f9a21c82d9a85396b704e164d0000000000000000000000000000000000000000000000000000000000007a6a00000000000000000000000000000000000000000000000000000000000026fc0000000000000000000000002b5ad5c4795c026514f8317c7a215e218dccd6cf000000000000000000000000000000000000000000000000000000000000002a307836383133456239333632333732454546363230306633623164624333663831393637316342413639"
            ),
            vm.parseBytes(
                "0x2ac391f76e0b65c22d954dd83373b14cb90419693607b0520b713d8fb0494e7407ed9c6ec02f7f877e8a297c8d554998e31f8c365388cdd80e4f290dd969fd721c"
            )
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
            registry_A,
            address(erc20_A),
            address(xerc20_A)
        );

        _registerPair(
            CHAIN_B,
            owner,
            registry_B,
            address(erc20_B),
            address(xerc20_B)
        );

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

        IAdapter.Operation memory operation = _getOperationFromRecordedLogs(
            bytes32(CHAIN_A),
            DEFAULT_BLOCK_HASH,
            DEFAULT_TX_HASH
        );

        vm.chainId(CHAIN_B);

        vm.expectEmit(address(xerc20_B));
        uint256 fees = (amount * 20) / 10000;
        emit IERC20.Transfer(address(0), recipient, amount - fees);
        vm.expectEmit(address(adapter_B));
        emit IAdapter.Settled();

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

        IAdapter.Operation memory operation = _getOperationFromRecordedLogs(
            bytes32(CHAIN_A),
            DEFAULT_BLOCK_HASH,
            DEFAULT_TX_HASH
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
            CHAIN_B,
            recipient,
            pegoutAmount,
            data
        );

        operation = _getOperationFromRecordedLogs(
            bytes32(CHAIN_B),
            DEFAULT_BLOCK_HASH,
            DEFAULT_TX_HASH
        );

        vm.chainId(CHAIN_A);

        IPAM.Metadata memory pegoutMetadata = IPAM.Metadata(
            vm.parseBytes(
                "0x01010000000000000000000000000000000000000000000000000000000000007a6aa880cb2ab67ec9140db0f6de238b34d4108f6fab99315772ee987ef9002e0e6311365bbee18058f12c27236e891a66999c4325879865303f785854e9169c257a00000000000000000000000063f58053c9499e1104a6f6c6d2581d6d83067eeba68959eed8a7e77ce926c4c04ee06434559ae1db7f636ceacd659f5c9126f1c3000000000000000000000000000000000000000000000000000000000000000000000000000000000000000051a240271ab8ab9f9a21c82d9a85396b704e164d0000000000000000000000000000000000000000000000000000000000007a6a00000000000000000000000000000000000000000000000000000000000013880000000000000000000000006813eb9362372eef6200f3b1dbc3f819671cba69000000000000000000000000000000000000000000000000000000000000002a307836383133456239333632333732454546363230306633623164624333663831393637316342413639"
            ),
            vm.parseBytes(
                "0x50e11e1aa6192fa507cd01087106d799642cf431a73640e4ae7219d970f36418645c9cba3613fe4a396a99366598eaed8684700850466d1736b3590ae5a302b91b"
            )
        );

        vm.expectEmit(address(xerc20_A));
        emit IERC20.Transfer(address(lockbox_A), address(0), netAmount);
        vm.expectEmit(address(erc20_A));
        emit IERC20.Transfer(address(lockbox_A), recipient, netAmount);
        vm.expectEmit(address(adapter_A));
        emit IAdapter.Settled();
        IAdapter(adapter_A).settle(operation, pegoutMetadata);

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
}
