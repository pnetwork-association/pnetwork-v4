// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Vm} from "forge-std/Vm.sol";
import {Test} from "forge-std/Test.sol";
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

        erc20Bytes_A = bytes32(abi.encode(address(erc20_A)));
        _registerPair(
            CHAIN_A,
            owner,
            owner,
            registry_A,
            erc20Bytes_A,
            address(xerc20_A)
        );

        erc20Bytes_B = bytes32(abi.encode(address(erc20_B)));
        _registerPair(
            CHAIN_B,
            owner,
            owner,
            registry_B,
            erc20Bytes_B,
            address(xerc20_B)
        );

        _transferToken(address(erc20_A), owner, user, userBalance);
    }

    function test_swap_EmitsSwapWithERC20() public {
        uint256 amount = 10000;
        bytes memory data = "";
        bytes32 sourceChainId = bytes32(CHAIN_A);
        bytes32 destinationChainId = bytes32(CHAIN_B);
        string memory recipientStr = vm.toString(recipient);
        vm.startPrank(user);

        erc20_A.approve(address(adapter_A), amount);

        // TODO: use vm.recordLogs()
        vm.expectEmit(address(adapter_A));

        emit IAdapter.Swap(
            IAdapter.Operation(
                erc20Bytes_A,
                user,
                recipientStr,
                sourceChainId,
                destinationChainId,
                amount,
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
        assertEq(F, (amount * 25) / 10000);

        vm.stopPrank();
    }

    function _sendXERC20To(address to, uint256 amount) internal {
        vm.startPrank(owner);
        xerc20_A.setLimits(owner, mintingLimit, burningLimit);
        xerc20_A.mint(to, amount);
        vm.stopPrank();
    }

    function test_swap_EmitsSwapWithXERC20() public {
        uint256 amount = 10000;
        bytes memory data = "";
        bytes32 sourceChainId = bytes32(CHAIN_A);
        bytes32 destinationChainId = bytes32(CHAIN_B);
        string memory recipientStr = vm.toString(recipient);

        _sendXERC20To(user, userBalance);

        vm.startPrank(user);

        xerc20_A.approve(address(adapter_A), amount);

        // TODO: use vm.recordLogs()
        vm.expectEmit(address(adapter_A));

        emit IAdapter.Swap(
            IAdapter.Operation(
                erc20Bytes_A,
                user,
                recipientStr,
                sourceChainId,
                destinationChainId,
                amount,
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
        assertEq(F, (amount * 25) / 10000);

        vm.stopPrank();
    }

    function _performERC20Swap(
        uint256 sourceChainId,
        address erc20,
        address from,
        address adapter,
        uint256 destinationChainId,
        address destinationAddress,
        uint256 amount,
        bytes memory data
    ) internal {
        vm.chainId(sourceChainId);
        vm.startPrank(from);

        string memory recipientStr = vm.toString(recipient);
        string memory destination = vm.toString(destinationAddress);

        ERC20(erc20).approve(address(adapter), amount);

        vm.expectEmit(address(adapter_A));

        emit IAdapter.Swap(
            IAdapter.Operation(
                erc20Bytes_A,
                user,
                recipientStr,
                bytes32(sourceChainId),
                bytes32(destinationChainId),
                amount,
                data
            )
        );

        Adapter(adapter).swap(
            erc20,
            amount,
            destination,
            bytes32(destinationChainId),
            data
        );

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

        // Getting the log of the event
        Vm.Log[] memory entries = vm.getRecordedLogs();
        // console.log(entries[10].emitter); // address
        // console.log(vm.toString(entries[10].topics[0])); // topic0
        // console.log(vm.toString(entries[10].data)); // data
        IAdapter.Operation memory op = abi.decode(
            entries[10].data,
            (IAdapter.Operation)
        );

        vm.chainId(CHAIN_B);

        // ------ OFF CHAIN START ------
        bytes memory statement = vm.parseBytes(
            "0x000000000000000000000000000000000000000000000000000000000000000000012542d0a8a8d91d000e52fcb026fbbd6360970074b1b5dcfe271565a2431ba844f901ba942946259e0334f33a064106302415ad3391bed384e1a0b255de8953b7f0014df3bb00e17f11f43945268f579979c7124353070c2db98db90180000000000000000000000000000000000000000000000000000000000000002000000000000000000000000051a240271ab8ab9f9a21c82d9a85396b704e164d0000000000000000000000002b5ad5c4795c026514f8317c7a215e218dccd6cf00000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000007a690000000000000000000000000000000000000000000000000000000000007a6a00000000000000000000000000000000000000000000000000000000000027100000000000000000000000000000000000000000000000000000000000000140000000000000000000000000000000000000000000000000000000000000002a307836383133456239333632333732454546363230306633623164624333663831393637316342413639000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
        );
        bytes memory signature = vm.parseBytes(
            "0x0c0cbd2a2ccc47c0edefdbc62db42c38d2fa0e14322168ad8da9cb40aa8fae75049d5ae7f6d23e684dd515460498e9b83fff5f393c14299ba1487fd6a468e8a71b"
        );
        // ------ OFF CHAIN END ---------

        vm.expectEmit(address(xerc20_B));
        emit IERC20.Transfer(address(0), recipient, amount);
        vm.expectEmit(address(adapter_B));
        emit IAdapter.Settled();

        adapter_B.settle(op, IPAM.Metadata(statement, signature));
    }
}
