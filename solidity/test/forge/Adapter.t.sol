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

contract AdapterTest is Test, Helper {}
