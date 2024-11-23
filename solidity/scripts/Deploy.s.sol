// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/contracts/PAM.sol";
import "../src/contracts/Adapter.sol";
import "../src/contracts/FeesManager.sol";
import "../src/contracts/XERC20.sol";
import "../src/contracts/XERC20Lockbox.sol";
import "../test/forge/DeployHelper.sol";

contract Deploy is Script, DeployHelper {
    uint256 immutable supply = 100000 ether;
    uint256 immutable mintingLimit = 100 ether;
    uint256 immutable burningLimit = 50 ether;
    bytes signerPublicKey =
        vm.parseBytes(vm.envString("DEPLOY_SIGNER_PUB_KEY"));
    bytes signerAttestation =
        vm.parseBytes(vm.envString("DEPLOY_SIGNER_ATTESTATION"));

    function run(
        address factory_,
        bytes32 erc20,
        string memory name,
        string memory symbol,
        bool local,
        bool isNative,
        bool freezing
    ) public {
        vm.startBroadcast();

        (
            XERC20 xerc20,
            XERC20Lockbox lockbox,
            XERC20Factory factory
        ) = _setupXERC20(factory_, erc20, name, symbol, local, freezing);

        FeesManager feesManager = new FeesManager(msg.sender);
        PAM pam = new PAM();
        pam.setTeeSigner(signerPublicKey, signerAttestation);

        Adapter adapter = new Adapter(
            address(xerc20),
            erc20,
            isNative,
            address(feesManager),
            address(pam)
        );

        xerc20.setLimits(address(adapter), mintingLimit, burningLimit);

        console.log("XERC20Factory @", address(factory));
        console.log("ERC20 @", address(uint160(uint256(erc20))));
        console.log("PAM @", address(pam));
        console.log("XERC20 @", address(xerc20));
        console.log("Lockbox @", address(lockbox));
        console.log("FeesManager @", address(feesManager));
        console.log("Adapter @", address(adapter));
        console.log("Owner:", msg.sender);
        console.log("Chain id:", block.chainid);
        console.log("");
        console.log("REMINDER: set on this PAM @ (%s)", address(pam));
        console.log(" - the destination chain's emitter");
        console.log(" - the topic zero value for the destination chain");

        vm.stopBroadcast();
    }

    function run(
        bytes32 erc20,
        string memory name,
        string memory symbol,
        bool local,
        bool isNative,
        bool freezing
    ) public {
        run(address(0), erc20, name, symbol, local, isNative, freezing);
    }
}
