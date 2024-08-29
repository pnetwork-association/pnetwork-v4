// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {EnumerableMap} from "@openzeppelin/contracts/utils/structs/EnumerableMap.sol";

import {Vm} from "forge-std/Vm.sol";
import {Helper} from "./Helper.sol";
import {Test, stdMath} from "forge-std/Test.sol";

import {PAM} from "../../src/contracts/PAM.sol";
import {Adapter} from "../../src/contracts/Adapter.sol";
import {XERC20} from "../../src/contracts/XERC20.sol";
import {XERC20} from "../../src/contracts/XERC20.sol";
import {ERC20Test} from "../../src/contracts/test/ERC20Test.sol";
import {FeesManager} from "../../src/contracts/FeesManager.sol";

import "forge-std/console.sol";

contract AdapterTest is Test, Helper {
    Adapter adapter;

    function setUp() public {
        vm.startPrank(owner);
        string memory name = "Token A";
        string memory symbol = "TKNA";
        uint256 supply = 100 ether;
        bool local = true;
        ERC20 erc20 = ERC20(new ERC20Test(name, symbol, supply));
        (XERC20 xerc20, , ) = _setupXERC20(
            address(0),
            address(erc20),
            string.concat("p", name),
            string.concat("p", symbol),
            local
        );
        FeesManager feesManager = new FeesManager(securityCouncil);
        PAM pam = new PAM();
        adapter = new Adapter(
            address(xerc20),
            address(erc20),
            address(feesManager),
            address(pam)
        );

        vm.stopPrank();
    }

    function test_onlyOwnerAccess() public {
        vm.startPrank(evil);
        _expectOwnableUnauthorizedAccountRevert(evil);
        adapter.setPAM(address(0));
        _expectOwnableUnauthorizedAccountRevert(evil);
        adapter.setFeesManager(address(0));
        vm.stopPrank();
    }
}
