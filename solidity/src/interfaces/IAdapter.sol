// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IPAM} from "../interfaces/IPAM.sol";

interface IAdapter {
    struct Operation {
        bytes32 blockId;
        bytes32 txId;
        uint256 nonce;
        bytes32 erc20;
        bytes32 originChainId;
        bytes32 destinationChainId;
        uint256 amount;
        address sender;
        string recipient;
        bytes data;
    }

    event Swap(
        uint256 indexed nonce,
        bytes32 erc20,
        uint256 originChainId,
        uint256 destinationChainId,
        uint256 amount,
        address sender,
        string recipient,
        bytes data
    );

    event ReceiveUserDataFailed();

    event Settled();

    function settle(
        Operation memory operation,
        IPAM.Metadata calldata metadata
    ) external;

    function swap(
        address token,
        uint256 amount,
        uint256 destinationChainId,
        string calldata recipient
    ) external payable;

    function swap(
        address token,
        uint256 amount,
        uint256 destinationChainId,
        string memory recipient,
        bytes memory data
    ) external payable;
}
