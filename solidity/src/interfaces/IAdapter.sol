// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

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

    event ReceiveUserDataFailed();

    event Swap(Operation operation);

    event Settled();
}
