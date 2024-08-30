// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import {Vm} from "forge-std/Vm.sol";
import {Helper} from "./Helper.sol";
import {Test, stdMath} from "forge-std/Test.sol";

import {PAM} from "../../src/contracts/PAM.sol";
import {Adapter} from "../../src/contracts/Adapter.sol";
import {XERC20} from "../../src/contracts/XERC20.sol";
import {FeesManager} from "../../src/contracts/FeesManager.sol";
import {ERC20Test} from "../../src/contracts/test/ERC20Test.sol";
import {XERC20Lockbox} from "../../src/contracts/XERC20Lockbox.sol";

import {IPAM} from "../../src/interfaces/IPAM.sol";
import {IAdapter} from "../../src/interfaces/IAdapter.sol";

import "forge-std/console.sol";

contract PAMTest is Test, Helper {
    uint256 constant originChainId = 1;
    uint256 constant destinationChainId = 56;
    string attestatorPrivateKey =
        "0xdfcc79a57e91c42d7eea05f82a08bd1b7e77f30236bb7c56fe98d3366a1929c4";
    string attestatorPublicKey =
        "0x0480472f799469d9af8790307a022802785c2b1e2f9c0930bdf9bafe193245e7a37cf43c720edc0892a2a97050005207e412f2227b1d92a78b8ee366fe4fea5ac9";
    address attestatorAddress = 0x3Da392a1403440087cA765E20B7c442b8129392b;
    bytes32 expectedEventId =
        0xf705b751c2ae9f32bcf35e3c491f49e3d565f6cbef0a39b38ea7c2da1c299588;
    bytes attestation = "";
    string otherAttestatorPrivateKey =
        "26afc93b5991435ad245f16001499892403be22a5a1225b48fa64effa58fba19";
    string otherAttestatorPublicKey =
        "0x04eb70384c33c68e77480302499cd30af9adc2dde7b9214bed46c5c17cefd7b49a345e8527a41a4dbf1f7b124d9c0a4393509e7d315c2ee85552b6586a39fe2421";
    address otherAttestatorAddress = 0xaeDa15984062138a3ABAa7FF1771E8167d529bec;

    PAM pam;
    ERC20 erc20;
    Adapter adapter;

    IAdapter.Operation operation;
    IPAM.Metadata metadata;
    bytes32 eventId;

    uint256 amount = 10000;
    bytes data = "";

    function setUp() public {
        vm.prank(owner);
        erc20 = ERC20(new ERC20Test(erc20Name, erc20Symbol, erc20Supply));

        (, , adapter, , ) = _setupChain(
            originChainId,
            owner,
            address(erc20),
            true
        );

        _transferToken(address(erc20), owner, user, 50000);

        vm.recordLogs();
        _performERC20Swap(
            originChainId,
            address(erc20),
            user,
            address(adapter),
            destinationChainId,
            recipient,
            amount,
            data
        );
        Vm.Log[] memory logs = vm.getRecordedLogs();
        bytes32 topic = IAdapter.Swap.selector;
        operation = _getOperationFromLogs(logs, topic);
        metadata = _getMetadataFromLogs(
            logs,
            topic,
            operation,
            attestatorPrivateKey
        );
        eventId = _getEventId(metadata.preimage);

        vm.chainId(destinationChainId);
    }

    function test_setTeeSigner_RevertWhen_callerIsNotOwner() public {
        vm.prank(owner);
        pam = new PAM();

        vm.prank(evil);
        _expectOwnableUnauthorizedAccountRevert(evil);
        pam.setTeeSigner(vm.parseBytes(attestatorPublicKey), attestation);
    }

    function test_setTeeSigner_emitTeeSignerChangedEvent() public {
        vm.startPrank(owner);
        pam = new PAM();

        vm.expectEmit(address(pam));
        emit IPAM.TeeSignerPendingChange(
            attestatorAddress,
            attestation,
            block.timestamp
        );
        vm.expectEmit(address(pam));
        emit IPAM.TeeSignerChanged(attestatorAddress);

        pam.setTeeSigner(vm.parseBytes(attestatorPublicKey), attestation);

        assertEq(pam.teeAddress(), attestatorAddress);

        // Grace period testing
        uint256 gracePeriod = pam.TEE_ADDRESS_CHANGE_GRACE_PERIOD();
        vm.roll(100);

        vm.expectEmit(address(pam));
        emit IPAM.TeeSignerPendingChange(
            otherAttestatorAddress,
            attestation,
            block.timestamp + gracePeriod
        );

        pam.setTeeSigner(vm.parseBytes(otherAttestatorPublicKey), attestation);

        assertEq(pam.teeAddress(), attestatorAddress);
        assertEq(pam.teeAddressNew(), otherAttestatorAddress);

        vm.expectRevert(IPAM.GracePeriodNotElapsed.selector);
        pam.applyNewTeeSigner();

        skip(gracePeriod);

        vm.expectEmit(address(pam));
        emit IPAM.TeeSignerChanged(otherAttestatorAddress);
        pam.applyNewTeeSigner();

        assertEq(pam.teeAddress(), otherAttestatorAddress);
        assertEq(pam.teeAddressNew(), address(0));

        vm.stopPrank();
    }

    function test_setEmitter_RevertWhen_callerIsNotOwner() public {
        vm.prank(owner);
        pam = new PAM();

        vm.prank(evil);
        _expectOwnableUnauthorizedAccountRevert(evil);
        pam.setEmitter(bytes32(originChainId), bytes32(abi.encode(adapter)));
    }

    function test_unsetEmitter_RevertWhen_callerIsNotOwner() public {
        vm.startPrank(owner);
        pam = new PAM();
        pam.setEmitter(bytes32(originChainId), bytes32(abi.encode(adapter)));
        vm.stopPrank();

        vm.prank(evil);
        _expectOwnableUnauthorizedAccountRevert(evil);
        pam.unsetEmitter(bytes32(originChainId));
    }

    function test_setEmitter_emitEmitterSetEvent() public {
        vm.startPrank(owner);
        pam = new PAM();

        vm.expectEmit(address(pam));
        emit IPAM.EmitterSet(
            bytes32(originChainId),
            bytes32(abi.encode(adapter))
        );
        pam.setEmitter(bytes32(originChainId), bytes32(abi.encode(adapter)));

        assertEq(
            pam.emitters(bytes32(originChainId)),
            bytes32(abi.encode(adapter))
        );
        vm.stopPrank();
    }

    function test_unsetEmitter_emitEmitterUnsetEvent() public {
        vm.startPrank(owner);
        pam = new PAM();

        pam.setEmitter(bytes32(originChainId), bytes32(abi.encode(adapter)));

        pam.unsetEmitter(bytes32(originChainId));

        assertEq(pam.emitters(bytes32(originChainId)), bytes32(0));
        vm.stopPrank();
    }

    function test_isAuthorized_revertWhen_teeSignerIsNotSet() public {
        pam = new PAM();
        pam.setEmitter(bytes32(originChainId), bytes32(abi.encode(adapter)));

        vm.expectRevert(IPAM.UnsetTeeSigner.selector);
        pam.isAuthorized(operation, metadata);
    }

    function testFuzz_isAuthorized_FalseWhen_PAMDestinationChainIdDoesNotMatch(
        uint64 chainId
    ) public {
        vm.assume(chainId != destinationChainId);
        vm.chainId(chainId);
        pam = new PAM();
        pam.setEmitter(bytes32(originChainId), bytes32(abi.encode(adapter)));
        pam.setTeeSigner(vm.parseBytes(attestatorPublicKey), attestation);

        (bool authorized, ) = pam.isAuthorized(operation, metadata);

        assertFalse(authorized);
    }

    function _assertAuthFalseAndRevertToSnapshot(
        IPAM pam_,
        IAdapter.Operation memory operation_,
        IPAM.Metadata memory metadata_,
        uint256 snapshot
    ) internal {
        (bool isAuthorized, ) = pam_.isAuthorized(operation_, metadata_);
        assertFalse(isAuthorized);
        vm.revertTo(snapshot);
    }

    function test_isAuthorized_FalseWhen_OperationAndEventDontMatch() public {
        pam = new PAM();
        pam.setEmitter(bytes32(originChainId), bytes32(abi.encode(adapter)));
        pam.setTeeSigner(vm.parseBytes(attestatorPublicKey), attestation);
        pam.setTopicZero(bytes32(originChainId), IAdapter.Swap.selector);

        (bool authorized, ) = pam.isAuthorized(operation, metadata);

        assertTrue(authorized);

        uint256 snapshot = vm.snapshot();

        operation.erc20 = bytes32(0);
        _assertAuthFalseAndRevertToSnapshot(pam, operation, metadata, snapshot);

        operation.blockId = bytes32(0);
        _assertAuthFalseAndRevertToSnapshot(pam, operation, metadata, snapshot);

        operation.txId = bytes32(0);
        _assertAuthFalseAndRevertToSnapshot(pam, operation, metadata, snapshot);

        operation.nonce = 0xC0FFEE;
        _assertAuthFalseAndRevertToSnapshot(pam, operation, metadata, snapshot);

        operation.erc20 = bytes32(0);
        _assertAuthFalseAndRevertToSnapshot(pam, operation, metadata, snapshot);

        operation.originChainId = bytes32(0);
        _assertAuthFalseAndRevertToSnapshot(pam, operation, metadata, snapshot);

        operation.destinationChainId = bytes32(0);
        _assertAuthFalseAndRevertToSnapshot(pam, operation, metadata, snapshot);

        operation.amount = 1 ether;
        _assertAuthFalseAndRevertToSnapshot(pam, operation, metadata, snapshot);

        operation.sender = bytes32(0);
        _assertAuthFalseAndRevertToSnapshot(pam, operation, metadata, snapshot);

        operation.recipient = address(0);
        _assertAuthFalseAndRevertToSnapshot(pam, operation, metadata, snapshot);

        operation.data = vm.parseBytes("0xC0FFEE");
        _assertAuthFalseAndRevertToSnapshot(pam, operation, metadata, snapshot);
    }

    function test_isAuthorized_FalseWhen_DifferentEmitter() public {
        vm.chainId(destinationChainId);
        pam = new PAM();
        pam.setEmitter(
            bytes32(originChainId),
            bytes32(abi.encode(vm.addr(1010)))
        );
        pam.setTeeSigner(vm.parseBytes(attestatorPublicKey), attestation);

        (bool authorized, ) = pam.isAuthorized(operation, metadata);

        assertFalse(authorized);
    }

    function test_isAuthorized_FalseWhen_InvalidSignature() public {
        vm.chainId(destinationChainId);
        pam = new PAM();
        pam.setEmitter(bytes32(originChainId), bytes32(abi.encode(adapter)));
        pam.setTeeSigner(vm.parseBytes(attestatorPublicKey), attestation);

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(
            uint256(vm.parseBytes32(otherAttestatorPrivateKey)),
            eventId
        );

        metadata.signature = abi.encodePacked(r, s, v);

        (bool authorized, ) = pam.isAuthorized(operation, metadata);

        assertFalse(authorized);
    }
}
