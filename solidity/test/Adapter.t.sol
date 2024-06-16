// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Test} from "forge-std/Test.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";

import {Helper} from "./Helper.sol";
import {Adapter} from "../src/Adapter.sol";
import {FeesManager} from "../src/FeesManager.sol";
import {XERC20Registry} from "../src/XERC20Registry.sol";
import {IAdapter} from "../src/interfaces/IAdapter.sol";

import {XERC20} from "../src/test/XERC20.sol";
import {ERC20Test} from "../src/test/ERC20Test.sol";
import {XERC20Lockbox} from "../src/test/XERC20Lockbox.sol";

contract AdapterTest is Test, Helper {
    uint256 constant CHAIN_A = 31337;
    uint256 constant CHAIN_B = 31338;

    /// @dev Signers
    address user;
    address owner;
    address recipient;

    /// @dev Contracts
    XERC20 xerc20_A;
    ERC20Test erc20_A;
    Adapter adapter_A;
    XERC20Lockbox lockbox_A;
    FeesManager feesManager_A;
    XERC20Registry registry_A;

    /// @dev Variables
    uint256 erc20Supply;
    uint256 userBalance;
    bytes32 erc20Bytes_A;
    uint256 mintingLimit;
    uint256 burningLimit;
    address factoryAddress;
    bool native;
    bool notNative;

    constructor() {
        owner = vm.addr(1);
        user = vm.addr(2);
        recipient = vm.addr(3);

        native = true;
        notNative = false;
        userBalance = 50000;
        erc20Supply = 1000000;
        mintingLimit = 2000000;
        burningLimit = 2000000;
        factoryAddress = address(0);
    }

    function setUp() public {
        vm.chainId(CHAIN_A);
        vm.startPrank(owner);

        registry_A = new XERC20Registry();
        adapter_A = new Adapter(address(registry_A));
        erc20_A = new ERC20Test("Token A", "TKA", erc20Supply);
        xerc20_A = new XERC20("pToken A", "pTKA", factoryAddress);
        lockbox_A = new XERC20Lockbox(
            address(xerc20_A),
            address(erc20_A),
            notNative
        );
        feesManager_A = new FeesManager();
        feesManager_A.setFee(address(xerc20_A), 0);

        xerc20_A.setLockbox(address(lockbox_A));
        xerc20_A.setLimits(address(adapter_A), mintingLimit, burningLimit);
        xerc20_A.setFeesManager(address(feesManager_A));

        vm.stopPrank();

        erc20Bytes_A = bytes32(abi.encode(address(erc20_A)));
        _registerPair(
            owner,
            owner,
            registry_A,
            erc20Bytes_A,
            address(xerc20_A)
        );
        _transferToken(address(erc20_A), owner, user, userBalance);
    }

    function test_AdapterEmitsSwapWithERC20() public {
        uint256 amount = 10000;
        bytes memory data = "";
        bytes32 sourceChainId = bytes32(CHAIN_A);
        bytes32 destinationChainId = bytes32(CHAIN_B);
        string memory recipientStr = vm.toString(recipient);
        vm.startPrank(user);

        erc20_A.approve(address(adapter_A), amount);

        vm.expectEmit(address(adapter_A));

        emit IAdapter.Swap(
            IAdapter.Operation(
                address(xerc20_A),
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
}
