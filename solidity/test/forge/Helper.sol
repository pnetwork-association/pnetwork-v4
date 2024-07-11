// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Vm} from "forge-std/Vm.sol";
import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import {PAM} from "../../src/PAM.sol";
import {Adapter} from "../../src/Adapter.sol";
import {XERC20} from "../../src/xerc20/XERC20.sol";
import {FeesManager} from "../../src/FeesManager.sol";
import {XERC20Registry} from "../../src/XERC20Registry.sol";

import {IPAM} from "../../src/interfaces/IPAM.sol";
import {ERC20Test} from "../../src/test/ERC20Test.sol";
import {IAdapter} from "../../src/interfaces/IAdapter.sol";
import {XERC20Lockbox} from "../../src/xerc20/XERC20Lockbox.sol";

import "forge-std/console.sol";

abstract contract Helper is Test {
    bytes signerPublicKey =
        vm.parseBytes(
            "0x0480472f799469d9af8790307a022802785c2b1e2f9c0930bdf9bafe193245e7a37cf43c720edc0892a2a97050005207e412f2227b1d92a78b8ee366fe4fea5ac9"
        );
    bytes signerAttestation = vm.parseBytes("0x");
    address factoryAddress = address(0);
    uint256 erc20Supply = 1000000;
    uint256 mintingLimit = 2000000;
    uint256 burningLimit = 2000000;
    bool native = true;
    bool notNative = false;

    function _registerPair(
        uint256 chain,
        address owner,
        address registrar,
        XERC20Registry registry,
        address erc20,
        address xerc20
    ) public {
        uint256 prevChain = block.chainid;
        vm.chainId(chain);
        vm.prank(owner);
        registry.grantRole(keccak256("REGISTRAR"), registrar);
        vm.prank(registrar);
        registry.registerXERC20(bytes32(abi.encode(erc20)), xerc20);
        vm.chainId(prevChain);
    }

    function _transferToken(
        address token,
        address from,
        address to,
        uint256 amount
    ) internal {
        vm.startPrank(from);
        ERC20(token).transfer(to, amount);
        vm.stopPrank();
    }

    function _sendXERC20To(
        address owner,
        address xerc20,
        address to,
        uint256 amount
    ) internal {
        vm.startPrank(owner);
        XERC20(xerc20).setLimits(owner, mintingLimit, burningLimit);
        XERC20(xerc20).mint(to, amount);
        vm.stopPrank();
    }

    function _setupChain(
        uint256 chain,
        address owner,
        address erc20Native
    )
        internal
        returns (
            XERC20Registry registry,
            Adapter adapter,
            ERC20 erc20,
            XERC20 xerc20,
            XERC20Lockbox lockbox,
            FeesManager feesManager,
            PAM pam
        )
    {
        uint256 prevChain = block.chainid;
        vm.chainId(chain);
        vm.startPrank(owner);

        registry = new XERC20Registry();
        adapter = new Adapter(address(registry));
        xerc20 = new XERC20("pToken A", "pTKA", factoryAddress);

        if (erc20Native == address(0)) {
            erc20 = ERC20(new ERC20Test("Token A", "TKA", erc20Supply));
            lockbox = new XERC20Lockbox(
                address(xerc20),
                address(erc20),
                notNative
            );
            feesManager = new FeesManager();
            feesManager.setFee(address(xerc20), 0, 2000);
            xerc20.setLockbox(address(lockbox));
            xerc20.setFeesManager(address(feesManager));
        } else {
            erc20 = ERC20(erc20Native);
        }
        pam = new PAM();
        pam.setTeeSigner(signerPublicKey, signerAttestation);
        xerc20.setPAM(address(adapter), address(pam));
        xerc20.setLimits(address(adapter), mintingLimit, burningLimit);

        vm.stopPrank();
        vm.chainId(prevChain);
    }

    function _performERC20Swap(
        uint256 sourceChainId,
        address erc20,
        address from,
        address adapter,
        uint256 destinationChainId,
        address destinationAddress,
        uint256 amount,
        bytes memory data
    ) internal {
        vm.chainId(sourceChainId);
        vm.startPrank(from);

        ERC20(erc20).approve(address(adapter), amount);

        Adapter(adapter).swap(
            erc20,
            amount,
            destinationChainId,
            vm.toString(destinationAddress),
            data
        );

        vm.stopPrank();
    }

    function _hexStringToAddress(
        string memory addr
    ) internal pure returns (address) {
        bytes memory tmp = bytes(addr);
        uint160 iaddr = 0;
        uint160 b1;
        uint160 b2;
        for (uint256 i = 2; i < 2 + 2 * 20; i += 2) {
            iaddr *= 256;
            b1 = uint160(uint8(tmp[i]));
            b2 = uint160(uint8(tmp[i + 1]));
            if ((b1 >= 97) && (b1 <= 102)) {
                b1 -= 87;
            } else if ((b1 >= 65) && (b1 <= 70)) {
                b1 -= 55;
            } else if ((b1 >= 48) && (b1 <= 57)) {
                b1 -= 48;
            }
            if ((b2 >= 97) && (b2 <= 102)) {
                b2 -= 87;
            } else if ((b2 >= 65) && (b2 <= 70)) {
                b2 -= 55;
            } else if ((b2 >= 48) && (b2 <= 57)) {
                b2 -= 48;
            }
            iaddr += (b1 * 16 + b2);
        }
        return address(iaddr);
    }

    function _getOperationFromRecordedLogs(
        bytes32 originChainId,
        bytes32 blockHash,
        bytes32 txHash
    ) internal returns (IAdapter.Operation memory operation) {
        Vm.Log[] memory entries = vm.getRecordedLogs();
        uint256 last = entries.length - 1;
        // console.log("////////////////////////////////");
        // console.log(entries[last].emitter); // address
        // console.log(vm.toString(entries[last].data)); // data
        // console.log(vm.toString(entries[last].topics[0])); // topic0
        // console.log(vm.toString(entries[last].topics[1])); // topic1

        IAdapter.EventContent memory content = abi.decode(
            entries[last].data,
            (IAdapter.EventContent)
        );

        operation = IAdapter.Operation(
            blockHash,
            txHash,
            uint256(entries[last].topics[1]),
            content.erc20,
            originChainId,
            content.destinationChainId,
            content.amount,
            bytes32(uint256(uint160(content.sender))),
            _hexStringToAddress(content.recipient),
            content.data
        );
    }
}
