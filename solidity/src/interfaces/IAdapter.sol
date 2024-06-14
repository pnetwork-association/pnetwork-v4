// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

interface IAdapter {
    event ReceiveUserDataFailed();

    event Swap(
        address erc20,
        address sender,
        string recipient,
        bytes32 sourceChainId,
        bytes32 destinationChainId,
        uint256 swapAmount,
        bytes data
    );
}
