// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/PAM.sol";
import "../src/Adapter.sol";
import "../src/FeesManager.sol";
import "../src/xerc20/XERC20.sol";
import "../src/xerc20/XERC20Lockbox.sol";

contract Deploy is Script {
    uint256 immutable mintingLimit = 100 ether;
    uint256 immutable burningLimit = 50 ether;
    address immutable factory = address(0);
    bytes signerPublicKey =
        vm.parseBytes(vm.envString("DEPLOY_SIGNER_PUB_KEY"));
    bytes signerAttestation =
        vm.parseBytes(vm.envString("DEPLOY_SIGNER_ATTESTATION"));

    function run(
        address erc20,
        string memory erc20Name,
        string memory erc20Symbol,
        bool local
    ) external {
        vm.startBroadcast();

        XERC20 xerc20 = new XERC20(erc20Name, erc20Symbol, factory);

        PAM pam = new PAM();
        XERC20Lockbox lockbox;
        FeesManager feesManager;
        Adapter adapter = new Adapter(address(xerc20), erc20);

        if (local) {
            address[] memory nodes = new address[](1);
            nodes[0] = vm.addr(111);
            uint256[] memory stakedAmounts = new uint256[](1);
            stakedAmounts[0] = 1 ether;
            feesManager = new FeesManager(0, nodes, stakedAmounts);
            feesManager.setFee(address(xerc20), 0, 2000);
            lockbox = new XERC20Lockbox(address(xerc20), erc20, false);
            xerc20.setLockbox(address(lockbox));
            xerc20.setFeesManager(address(feesManager));
        }

        xerc20.setPAM(address(adapter), address(pam));
        xerc20.setLimits(address(adapter), mintingLimit, burningLimit);
        pam.setTeeSigner(signerPublicKey, signerAttestation);

        console.log("ERC20 @", erc20);
        console.log("PAM @", address(pam));
        console.log("XERC20 @", address(xerc20));
        console.log("Lockbox @", address(lockbox));
        console.log("FeesManager @", address(feesManager));
        console.log("Adapter @", address(adapter));
        console.log("Owner:", msg.sender);
        console.log("Chain id:", block.chainid);
        console.log("");
        console.log("REMINDER: manually set the emitter on the PAM address!");

        vm.stopBroadcast();
    }
}
