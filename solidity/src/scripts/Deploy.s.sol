// // SPDX-License-Identifier: UNLICENSED
// pragma solidity ^0.8.13;

// import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// import "forge-std/Script.sol";
// import "forge-std/console.sol";
// import "../contracts/PAM.sol";
// import "../contracts/Adapter.sol";
// import "../src/FeesManager.sol";
// import "../contracts/XERC20.sol";
// import "../contracts/XERC20Lockbox.sol";

// contract Deploy is Script {
//     uint256 immutable mintingLimit = 100 ether;
//     uint256 immutable burningLimit = 50 ether;
//     bytes signerPublicKey =
//         vm.parseBytes(vm.envString("DEPLOY_SIGNER_PUB_KEY"));
//     bytes signerAttestation =
//         vm.parseBytes(vm.envString("DEPLOY_SIGNER_ATTESTATION"));

//     function run(
//         address erc20,
//         string memory erc20Name,
//         string memory erc20Symbol,
//         bool local
//     ) external {
//         vm.startBroadcast();

//         XERC20 xerc20 = new XERC20(erc20Name, erc20Symbol, msg.sender);

//         PAM pam = new PAM();
//         XERC20Lockbox lockbox;
//         // FIXME: factor out into a separate script
//         // and pass as argument
//         FeesManager feesManager = new FeesManager(msg.sender);

//         if (local) {
//             address[] memory nodes = new address[](1);
//             nodes[0] = vm.addr(111);
//             uint256[] memory stakedAmounts = new uint256[](1);
//             stakedAmounts[0] = 1 ether;
//             lockbox = new XERC20Lockbox(address(xerc20), erc20, false);
//             xerc20.setLockbox(address(lockbox));
//         }

//         Adapter adapter = new Adapter(
//             address(xerc20),
//             erc20,
//             address(feesManager),
//             address(pam)
//         );

//         adapter.setPAM(address(pam));
//         xerc20.setLimits(address(adapter), mintingLimit, burningLimit);
//         pam.setTeeSigner(signerPublicKey, signerAttestation);

//         console.log("ERC20 @", erc20);
//         console.log("PAM @", address(pam));
//         console.log("XERC20 @", address(xerc20));
//         console.log("Lockbox @", address(lockbox));
//         console.log("FeesManager @", address(feesManager));
//         console.log("Adapter @", address(adapter));
//         console.log("Owner:", msg.sender);
//         console.log("Chain id:", block.chainid);
//         console.log("");
//         console.log("REMINDER: manually set the emitter on the PAM address!");

//         vm.stopBroadcast();
//     }
// }
