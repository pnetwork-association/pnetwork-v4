// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";

import {Helper} from "./Helper.sol";
import {XERC20} from "../src/test/XERC20.sol";
import {ERC20Test} from "../src/test/ERC20Test.sol";
import {XERC20Registry} from "../src/XERC20Registry.sol";

contract XERC20RegistryTest is Test, Helper {
    bytes32 constant REGISTRAR_ROLE = keccak256("REGISTRAR");

    address immutable OWNER;
    address immutable USER;
    address immutable REGISTRAR;

    XERC20 public xerc20_A;
    ERC20Test public erc20_A;
    XERC20Registry public registry;

    bytes32 public erc20Bytes_A;

    constructor() {
        OWNER = vm.addr(1);
        USER = vm.addr(2);
        REGISTRAR = vm.addr(3);
    }

    function setUp() public {
        vm.prank(OWNER);
        registry = new XERC20Registry();
        address factoryAddress = address(0);
        erc20_A = new ERC20Test("Token A", "TKA", 10000);
        erc20Bytes_A = bytes32(abi.encode(address(erc20_A)));
        xerc20_A = new XERC20("pToken A", "pTKA", factoryAddress);
    }

    function test_registerXERC20_RevertWhen_CallerIsNotARegistrar() public {
        vm.prank(OWNER);
        vm.expectRevert(
            abi.encodeWithSelector(
                XERC20Registry.NotRegistrarRole.selector,
                address(OWNER)
            )
        );

        registry.registerXERC20(erc20Bytes_A, address(xerc20_A));
    }

    function test_registerXERC20_EmitXERC20Registered() public {
        vm.prank(OWNER);
        vm.expectEmit(address(registry));
        emit IAccessControl.RoleGranted(REGISTRAR_ROLE, REGISTRAR, OWNER);
        registry.grantRole(REGISTRAR_ROLE, REGISTRAR);

        vm.prank(REGISTRAR);
        vm.expectEmit(address(registry));
        emit XERC20Registry.XERC20Registered(erc20Bytes_A, address(xerc20_A));
        registry.registerXERC20(erc20Bytes_A, address(xerc20_A));
    }


    function test_getAssets_GetTheCorrectPair() public {
        _registerPair(OWNER, REGISTRAR, registry, erc20Bytes_A, address(xerc20_A));

        vm.startPrank(USER);
        (bytes32 a, address b) = registry.getAssets(address(erc20_A));

        assertEq(a, erc20Bytes_A);
        assertEq(b, address(xerc20_A));

        (bytes32 c, address d) = registry.getAssets(address(xerc20_A));

        assertEq(c, erc20Bytes_A);
        assertEq(d, address(xerc20_A));

        vm.stopPrank();
    }
}
