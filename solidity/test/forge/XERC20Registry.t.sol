// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";

import {Helper} from "./Helper.sol";
import {XERC20} from "../../src/xerc20/XERC20.sol";
import {ERC20Test} from "../../src/test/ERC20Test.sol";
import {XERC20Registry} from "../../src/XERC20Registry.sol";
import {ERC20NotOwnableTest} from "../../src/test/ERC20NotOwnableTest.sol";

contract XERC20RegistryTest is Test, Helper {
    bytes32 constant REGISTRAR_ROLE = keccak256("REGISTRAR");

    address immutable OWNER;
    address immutable USER;
    address immutable TOKEN_OWNER;
    address immutable EVIL;

    XERC20 public xerc20;
    ERC20Test public erc20;
    XERC20Registry public registry;

    bytes32 public erc20Bytes;

    constructor() {
        OWNER = vm.addr(1);
        USER = vm.addr(2);
        TOKEN_OWNER = vm.addr(3);
        EVIL = vm.addr(4);
    }

    function setUp() public {
        vm.prank(OWNER);
        registry = new XERC20Registry();
        address factoryAddress = address(0);
        vm.prank(TOKEN_OWNER);
        erc20 = new ERC20Test("Token A", "TKA", 10000);
        erc20Bytes = bytes32(abi.encode(address(erc20)));
        xerc20 = new XERC20("pToken A", "pTKA", factoryAddress);
    }

    function _expectNotRegisteredRevert(address token) internal {
        vm.expectRevert(
            abi.encodeWithSelector(XERC20Registry.NotRegistered.selector, token)
        );
    }

    function _expectNotAllowedRevert() internal {
        vm.expectRevert(
            abi.encodeWithSelector(XERC20Registry.NotAllowed.selector)
        );
    }

    function _expectNotOwnableCompatibleRevert() internal {
        vm.expectRevert(
            abi.encodeWithSelector(XERC20Registry.NotOwnableCompatible.selector)
        );
    }

    function _expectAlreadyRegisteredRevert(address token) internal {
        vm.expectRevert(
            abi.encodeWithSelector(
                XERC20Registry.AlreadyRegistered.selector,
                token
            )
        );
    }

    function test_registerXERC20_RevertWhen_CallerIsNeitherOwnerNotTokenOwner()
        public
    {
        vm.startPrank(USER);
        _expectNotAllowedRevert();
        registry.registerXERC20(address(erc20), address(xerc20));
        vm.stopPrank();
    }

    function test_registerXERC20_RevertWhen_CallerIsOldOwner() public {
        vm.startPrank(OWNER);
        registry.renounceOwnership();
        _expectNotAllowedRevert();
        registry.registerXERC20(address(erc20), address(xerc20));
        vm.stopPrank();
    }

    function test_registerXERC20_RevertWhen_ERC20DoesNotImplementOwnable()
        public
    {
        ERC20NotOwnableTest erc20NotOwnable = new ERC20NotOwnableTest(
            "Token B",
            "TKNB",
            100 ether
        );
        vm.startPrank(OWNER);
        registry.renounceOwnership();
        _expectNotOwnableCompatibleRevert();
        registry.registerXERC20(address(erc20NotOwnable), address(xerc20));
        vm.stopPrank();
    }

    function test_registerXERC20_When_ERC20DoesNotImplementOwnableButCallerIsOwner()
        public
    {
        ERC20NotOwnableTest erc20NotOwnable = new ERC20NotOwnableTest(
            "Token B",
            "TKNB",
            100 ether
        );
        vm.startPrank(OWNER);
        vm.expectEmit(address(registry));
        emit XERC20Registry.XERC20Registered(
            bytes32(abi.encode(address(erc20NotOwnable))),
            address(xerc20)
        );
        registry.registerXERC20(address(erc20NotOwnable), address(xerc20));
        vm.stopPrank();
    }

    function test_registerXERC20_When_ERC20IsOwnableAndCallerIsTokenOwner()
        public
    {
        vm.prank(OWNER);
        registry.renounceOwnership();
        vm.startPrank(TOKEN_OWNER);
        vm.expectEmit(address(registry));
        emit XERC20Registry.XERC20Registered(erc20Bytes, address(xerc20));
        registry.registerXERC20(address(erc20), address(xerc20));
        vm.stopPrank();
    }

    function test_registerXERC20_EmitXERC20Registered() public {
        vm.prank(OWNER);
        vm.expectEmit(address(registry));
        emit XERC20Registry.XERC20Registered(erc20Bytes, address(xerc20));
        registry.registerXERC20(address(erc20), address(xerc20));
    }

    function test_deregisterXERC20_EmitXERC20Deregistered() public {
        _registerPair(
            block.chainid,
            OWNER,
            registry,
            address(erc20),
            address(xerc20)
        );

        vm.prank(OWNER);
        vm.expectEmit(address(registry));
        emit XERC20Registry.XERC20Deregistered(erc20Bytes, address(xerc20));
        registry.deregisterXERC20(address(erc20));

        _expectNotRegisteredRevert(address(erc20));
        registry.getAssets(erc20Bytes);
        _expectNotRegisteredRevert(address(xerc20));
        registry.getAssets(address(xerc20));
    }

    function test_getAssets_GetTheCorrectPair() public {
        _registerPair(
            block.chainid,
            OWNER,
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

    function test_registerXERC20_RevertWhen_XERC20IsAlreadyMappedToERC20()
        public
    {
        _registerPair(
            block.chainid,
            OWNER,
            registry,
            address(erc20),
            address(xerc20)
        );

        vm.startPrank(EVIL);
        ERC20Test otherERC20 = new ERC20Test("Token C", "TKNC", 100 ether);
        _expectAlreadyRegisteredRevert(address(xerc20));
        registry.registerXERC20(address(otherERC20), address(xerc20));
        vm.stopPrank();
    }

    function test_registerXERC20_OnlyTheOwnerCanAddTheNativeXERC20() public {
        vm.startPrank(OWNER);
        vm.expectEmit(address(registry));
        emit XERC20Registry.XERC20Registered(bytes32(0), address(xerc20));
        registry.registerXERC20(address(0), address(xerc20));
        vm.stopPrank();
    }

    function test_registerXERC20_RevertWhen_NativeAssetIsNotRegisteredByOwner()
        public
    {
        vm.prank(EVIL);
        _expectNotAllowedRevert();
        registry.registerXERC20(address(0), address(xerc20));
        vm.startPrank(OWNER);
        registry.renounceOwnership();
        _expectNotAllowedRevert();
        registry.registerXERC20(address(0), address(xerc20));
        vm.stopPrank();
    }
}
