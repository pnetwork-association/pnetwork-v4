// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";

import {Helper} from "./Helper.sol";
import {XERC20} from "../../src/xerc20/XERC20.sol";
import {ERC20Test} from "../../src/test/ERC20Test.sol";
import {XERC20Registry} from "../../src/XERC20Registry.sol";

contract XERC20RegistryTest is Test, Helper {
    bytes32 constant REGISTRAR_ROLE = keccak256("REGISTRAR");

    address immutable OWNER;
    address immutable USER;
    address immutable REGISTRAR;

    XERC20 public xerc20;
    ERC20Test public erc20;
    XERC20Registry public registry;

    bytes32 public erc20Bytes;

    constructor() {
        OWNER = vm.addr(1);
        USER = vm.addr(2);
        REGISTRAR = vm.addr(3);
    }

    function setUp() public {
        vm.prank(OWNER);
        registry = new XERC20Registry();
        address factoryAddress = address(0);
        erc20 = new ERC20Test("Token A", "TKA", 10000);
        erc20Bytes = bytes32(abi.encode(address(erc20)));
        xerc20 = new XERC20("pToken A", "pTKA", factoryAddress);
    }

    function _expectOnlyRegistrarRevert() internal {
        vm.expectRevert(
            abi.encodeWithSelector(
                XERC20Registry.NotRegistrarRole.selector,
                address(OWNER)
            )
        );
    }

    function _expectNotRegisteredRevert(address token) internal {
        vm.expectRevert(
            abi.encodeWithSelector(XERC20Registry.NotRegistered.selector, token)
        );
    }

    function _grantRegistrarRole(address registrar) internal {
        vm.prank(OWNER);
        vm.expectEmit(address(registry));
        emit IAccessControl.RoleGranted(REGISTRAR_ROLE, registrar, OWNER);
        registry.grantRole(REGISTRAR_ROLE, registrar);
    }

    function test_registerXERC20_RevertWhen_CallerIsNotARegistrar() public {
        vm.prank(OWNER);
        _expectOnlyRegistrarRevert();
        registry.registerXERC20(erc20Bytes, address(xerc20));
    }

    function test_registerXERC20_EmitXERC20Registered() public {
        _grantRegistrarRole(REGISTRAR);
        vm.prank(REGISTRAR);
        vm.expectEmit(address(registry));
        emit XERC20Registry.XERC20Registered(erc20Bytes, address(xerc20));
        registry.registerXERC20(erc20Bytes, address(xerc20));
    }

    function test_deregisterXERC20_EmitXERC20Deregistered() public {
        _registerPair(
            block.chainid,
            OWNER,
            REGISTRAR,
            registry,
            address(erc20),
            address(xerc20)
        );

        vm.prank(REGISTRAR);
        vm.expectEmit(address(registry));
        emit XERC20Registry.XERC20Deregistered(erc20Bytes, address(xerc20));
        registry.deregisterXERC20(address(xerc20));

        _expectNotRegisteredRevert(address(erc20));
        registry.getAssets(erc20Bytes);
        _expectNotRegisteredRevert(address(xerc20));
        registry.getAssets(address(xerc20));
    }

    function test_getAssets_GetTheCorrectPair() public {
        _registerPair(
            block.chainid,
            OWNER,
            REGISTRAR,
            registry,
            address(erc20),
            address(xerc20)
        );

        vm.startPrank(USER);
        (bytes32 a, address b) = registry.getAssets(address(erc20));
        (bytes32 c, address d) = registry.getAssets(address(xerc20));

        assertEq(a, erc20Bytes);
        assertEq(b, address(xerc20));
        assertEq(c, erc20Bytes);
        assertEq(d, address(xerc20));

        vm.stopPrank();
    }
}
