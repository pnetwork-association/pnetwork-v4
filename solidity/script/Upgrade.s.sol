// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script} from "forge-std/Script.sol";
import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Options} from "openzeppelin-foundry-upgrades/Options.sol";
import {Upgrades} from "openzeppelin-foundry-upgrades/LegacyUpgrades.sol"; // OpenZeppelin v4
import {PTokenV2} from "../src/ptoken-v2/PTokenV2.sol";
import {PTokenV2NoGSN} from "../src/ptoken-v2/PTokenV2NoGSN.sol";

import "forge-std/console.sol";

interface IERC777GSNUpgradeable {
    function setTrustedSigner(address trustedSigner) external;
}

contract UpgradeScript is Script, Test {
    function run(address proxy, address owner) public {
        address proxyAdmin = Upgrades.getAdminAddress(proxy);
        address implementation = Upgrades.getImplementationAddress(proxy);
        address proxyAdminOwner = Ownable(proxyAdmin).owner();

        // bool useGSN = false;
        string memory contractName = "PTokenV2.sol";
        try IERC777GSNUpgradeable(proxyAdmin).setTrustedSigner(vm.addr(1)) {
            // useGSN = true;
            contractName = "PTokenV2NoGSN.sol";
        } catch {}

        console.log("proxyAdmin", proxyAdmin);
        console.log("proxyAdminOwner", proxyAdminOwner);
        console.log("implementation", implementation);
        console.log("contractName", contractName);

        Options memory opts;
        Upgrades.validateUpgrade(contractName, opts);

        bytes memory data = abi.encodeCall(PTokenV2.initializeV2, (owner));

        vm.startPrank(proxyAdminOwner);
        Upgrades.upgradeProxy(proxy, contractName, data);
    }
}
