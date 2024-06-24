// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IAdapter} from "./IAdapter.sol";

interface IPAM {
    struct Metadata {
        bytes statement;
        bytes signature;
    }

    function isAuthorized(
        IAdapter.Operation memory operation,
        bytes calldata metadata
    ) external view returns (bool);
}
