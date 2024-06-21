// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import {IPAM} from "../interfaces/IPAM.sol";

interface IAdapter {
    struct Operation {
        bytes32 erc20;
        address sender;
        string recipient;
        bytes32 originChainId;
        bytes32 destinationChainId;
        uint256 amount;
        bytes data;
    }

    function settle(
        Operation memory operation,
        IPAM.Metadata calldata metadata
    ) external;

    function swap(
        address token,
        uint256 amount,
        string calldata recipient,
        bytes32 destinationChainId
    ) external payable;

    function swap(
        address token,
        uint256 amount,
        string memory recipient,
        bytes32 destinationChainId,
        bytes memory data
    ) external payable;

    event ReceiveUserDataFailed();

    event Swap(Operation operation);

    event Settled();
}
