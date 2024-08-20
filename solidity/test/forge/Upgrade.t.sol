// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script} from "forge-std/Script.sol";
import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Options} from "openzeppelin-foundry-upgrades/Options.sol";
import {Upgrades} from "openzeppelin-foundry-upgrades/LegacyUpgrades.sol"; // OpenZeppelin v4
import {PTokenV2} from "../../src/ptoken-v2/PTokenV2.sol";
import {PTokenV2NoGSN} from "../../src/ptoken-v2/PTokenV2NoGSN.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "forge-std/console.sol";

interface IERC777GSNUpgradeable {
    function setTrustedSigner(address trustedSigner) external;
}

contract Upgrade is Test {
    string MAINNET_RPC_URL = vm.rpcUrl("mainnet");
    string BSC_RPC_URL = vm.rpcUrl("bsc");
    uint256 bsc;
    uint256 eth;
    address proxy =
        vm.parseAddress("0x1613957159e9b0ac6c80e824f7eea748a32a0ae2");
    address owner =
        vm.parseAddress("0x1613957159e9b0ac6c80e824f7eea748a32a0ae2");
    address[5] holders = [
        vm.parseAddress("0x816a99530B0f272Bb6ba4913b8952249f8d2E21b"),
        vm.parseAddress("0xdd90E5E87A2081Dcf0391920868eBc2FFB81a1aF"),
        vm.parseAddress("0xE4a4A90Cd7366A0712d6f3D1c10764959Eae1356"),
        vm.parseAddress("0x03627B2fcd48570157EceC6559C04Cf5618d3e44"),
        vm.parseAddress("0x69D740c30745C4c04cfAa5b6d78B0727ab4fA753")
    ];

    function setUp() public {
        // Keep this otherwise will fail the setup
        try vm.envInt("FORK") returns (int forkEnabled) {
            if (forkEnabled != 1) return;
        } catch {
            return;
        }
        bsc = vm.createFork(BSC_RPC_URL, 40_729_521);
    }

    function test_upgrade_StorageInvariance_check() public {
        _skipIfForkUndefined();

        vm.selectFork(bsc);
        address proxyAdmin = Upgrades.getAdminAddress(proxy);
        address proxyAdminOwner = Ownable(proxyAdmin).owner();

        // bool useGSN = false;
        string memory contractName = "PTokenV2.sol";
        try IERC777GSNUpgradeable(proxyAdmin).setTrustedSigner(vm.addr(1)) {
            // useGSN = true;
            contractName = "PTokenV2NoGSN.sol";
        } catch {}

        Options memory opts;
        Upgrades.validateUpgrade(contractName, opts);

        bytes memory data = abi.encodeCall(PTokenV2.initializeV2, (owner));

        uint256[] memory balances = new uint256[](holders.length);
        for (uint i = 0; i < holders.length; i++) {
            balances[i] = ERC20(proxy).balanceOf(holders[i]);
        }

        uint256 totalSupply = ERC20(proxy).totalSupply();
        string memory name = ERC20(proxy).name();
        string memory symbol = ERC20(proxy).symbol();

        vm.startPrank(proxyAdminOwner);
        Upgrades.upgradeProxy(proxy, contractName, data);

        for (uint i = 0; i < holders.length; i++) {
            assertEq(ERC20(proxy).balanceOf(holders[i]), balances[i]);
        }

        assertEq(Ownable(proxy).owner(), owner);
        assertEq(ERC20(proxy).totalSupply(), totalSupply);
        assertEq(ERC20(proxy).name(), name);
        assertEq(ERC20(proxy).symbol(), symbol);
    }

    function _skipIfForkUndefined() internal {
        try vm.envInt("FORK") returns (int forkEnabled) {
            if (forkEnabled != 1) vm.skip(true);
        } catch {
            vm.skip(true);
        }
    }
}
