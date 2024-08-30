// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IAdapter} from "./IAdapter.sol";

interface IPAM {
    struct Metadata {
        bytes preimage;
        bytes signature;
    }

    event EmitterSet(bytes32 chainid, bytes32 emitter);
    event EmitterUnset(bytes32 chainId);
    event TeeSignerChanged(address newAddress);
    event TeeSignerPendingChange(
        address newAddress,
        bytes attestation,
        uint256 gracePeriod
    );

    error UnsetTeeSigner();
    error GracePeriodNotElapsed();
    error InvalidNewTeeSigner();

    function isAuthorized(
        IAdapter.Operation memory operation,
        Metadata calldata metadata
    ) external returns (bool, bytes32);
}
