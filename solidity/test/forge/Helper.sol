// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Vm} from "forge-std/Vm.sol";
import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {DeployHelper} from "./DeployHelper.sol";
import {PAM} from "../../src/contracts/PAM.sol";
import {Adapter} from "../../src/contracts/Adapter.sol";
import {XERC20} from "../../src/contracts/XERC20.sol";
import {FeesManager} from "../../src/contracts/FeesManager.sol";

import {IPAM} from "../../src/interfaces/IPAM.sol";
import {ERC20Test} from "../../src/contracts/test/ERC20Test.sol";
import {IAdapter} from "../../src/interfaces/IAdapter.sol";
import {XERC20Lockbox} from "../../src/contracts/XERC20Lockbox.sol";
import {XERC20Factory} from "../../src/contracts/XERC20Factory.sol";
import {BytesLib} from "solidity-bytes-utils/contracts/BytesLib.sol";

import "forge-std/console.sol";

abstract contract Helper is Test, DeployHelper {
    address user = vm.addr(1);
    address owner = vm.addr(2);
    address evil = vm.addr(3);
    address recipient = vm.addr(4);

    bytes signerPublicKey =
        vm.parseBytes(
            "0x0480472f799469d9af8790307a022802785c2b1e2f9c0930bdf9bafe193245e7a37cf43c720edc0892a2a97050005207e412f2227b1d92a78b8ee366fe4fea5ac9"
        );
    bytes signerAttestation = vm.parseBytes("0x");
    address securityCouncil = vm.addr(201);
    string erc20Name = "Token A";
    string erc20Symbol = "TKNA";
    uint256 erc20Supply = 1000000;
    uint256 mintingLimit = 2000000;
    uint256 burningLimit = 2000000;

    bytes32 SWAP_TOPIC = bytes32(0x66756E6473206172652073616675207361667520736166752073616675202E2E);

    bool native = true;
    bool notNative = false;

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
        address owner_,
        address xerc20,
        address to,
        uint256 amount
    ) internal {
        vm.startPrank(owner_);
        XERC20(xerc20).setLimits(owner_, mintingLimit, burningLimit);
        XERC20(xerc20).mint(to, amount);
        vm.stopPrank();
    }

    function _setupChain(
        uint256 chain,
        address owner_,
        address erc20,
        bool local
    )
        internal
        returns (
            XERC20 xerc20,
            XERC20Lockbox lockbox,
            Adapter adapter,
            FeesManager feesManager,
            PAM pam
        )
    {
        uint256 prevChain = block.chainid;
        vm.chainId(chain);
        vm.startPrank(owner_);

        (xerc20, lockbox, ) = _setupXERC20(
            address(0),
            erc20,
            string.concat("p", erc20Name),
            string.concat("p", erc20Symbol),
            local
        );

        pam = new PAM();
        pam.setTeeSigner(signerPublicKey, signerAttestation);
        feesManager = new FeesManager(securityCouncil);
        adapter = new Adapter(
            address(xerc20),
            address(erc20),
            address(feesManager),
            address(pam)
        );
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

    function _findLogWithTopic(
        Vm.Log[] memory logs,
        bytes32 topic
    ) internal pure returns (Vm.Log memory) {
        uint256 i;
        for (i = 0; i < logs.length; i++) {
            if (logs[i].topics[0] == topic) break;
        }

        assert(i < logs.length);

        return logs[i];
    }

    function _getOperationFromLogs(
        Vm.Log[] memory logs,
        bytes32 topic,
        bool print
    ) internal returns (IAdapter.Operation memory) {
        Vm.Log memory log = _findLogWithTopic(logs, topic);
        vm.roll(4);
        bytes32 blockHash = blockhash(block.number - 2);
        bytes32 txHash = blockhash(block.number - 1);

        if (print) {
            console.log(
                string.concat(
                    "./attestator.js ",
                    "metadata ",
                    " -b ",
                    vm.toString(blockHash),
                    " -t ",
                    vm.toString(txHash),
                    " ",
                    vm.toString(log.emitter),
                    " ",
                    vm.toString(log.data),
                    " ",
                    vm.toString(log.topics[0]),
                    " ",
                    vm.toString(log.topics[1])
                )
            );
            console.log("");
        }

        bytes memory eventBytes = log.data;

        uint256 recipientLen = uint256(bytes32(BytesLib.slice(eventBytes, 128, 32)));

        uint256 dataLen = eventBytes.length - recipientLen - 160;
        return
            IAdapter.Operation(
                blockHash,
                txHash,
                uint256(log.topics[1]), // nonce
                bytes32(BytesLib.slice(eventBytes, 0, 32)), // erc20
                bytes32(block.chainid),
                bytes32(BytesLib.slice(eventBytes, 32, 32)), // destination chain id
                uint256(bytes32(BytesLib.slice(eventBytes, 64, 32))), // amount
                bytes32(BytesLib.slice(eventBytes, 96, 32)), //  sender
                _hexStringToAddress(
                    string(BytesLib.slice(eventBytes, 160, recipientLen)) // recipient
                ),
                BytesLib.slice(eventBytes, 160 + recipientLen, dataLen) // data
            );
    }

    function _getOperationFromLogs(
        Vm.Log[] memory logs,
        bytes32 topic
    ) internal returns (IAdapter.Operation memory) {
        return _getOperationFromLogs(logs, topic, false);
    }

    function _getMetadataFromLogs(
        Vm.Log[] memory logs,
        bytes32 topic,
        IAdapter.Operation memory operation,
        string memory privateKey
    ) internal view returns (IPAM.Metadata memory) {
        Vm.Log memory log = _findLogWithTopic(logs, topic);

        bytes1 version = 0x01;
        bytes1 protocolId = 0x01;
        bytes memory context = bytes.concat(
            version,
            protocolId,
            bytes32(block.chainid)
        );

        bytes memory eventPayload = bytes.concat(
            bytes32(abi.encode(log.emitter)),
            log.topics[0],
            log.topics[1],
            bytes32(0),
            bytes32(0),
            log.data
        );

        bytes memory preimage = bytes.concat(
            context,
            operation.blockId,
            operation.txId,
            eventPayload
        );
        uint256 pk = uint256(vm.parseBytes32(privateKey));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, sha256(preimage));
        bytes memory signature = abi.encodePacked(r, s, v);
        return IPAM.Metadata(preimage, signature);
    }

    function _getEventId(
        bytes memory metadataPreImage
    ) internal pure returns (bytes32) {
        bytes memory context = BytesLib.slice(metadataPreImage, 0, 34);
        bytes32 blockId = bytes32(BytesLib.slice(metadataPreImage, 34, 32));
        bytes32 txId = bytes32(BytesLib.slice(metadataPreImage, 66, 32));
        uint256 payloadlen = metadataPreImage.length - 98;
        bytes memory eventPayload = BytesLib.slice(
            metadataPreImage,
            98,
            payloadlen
        );

        return sha256(bytes.concat(context, blockId, txId, eventPayload));
    }

    function _expectOwnableUnauthorizedAccountRevert(address anAddress) public {
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                anAddress
            )
        );
    }
}
