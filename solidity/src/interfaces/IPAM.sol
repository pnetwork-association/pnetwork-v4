// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IAdapter} from "./IAdapter.sol";

interface IPAM {
    struct Metadata {
        bytes preimage;
        bytes signature;
    }

    function isAuthorized(
        IAdapter.Operation memory operation,
        Metadata calldata metadata
    ) external returns (bool, bytes32);
}
