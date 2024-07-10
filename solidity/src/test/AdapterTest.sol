// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IAdapter} from "../interfaces/IAdapter.sol";

contract AdapterTest {
    function swap(
        uint256 nonce,
        address erc20,
        uint256 destination,
        uint256 amount,
        address sender,
        string memory recipient,
        bytes memory data
    ) public {
        emit IAdapter.Swap(
            nonce,
            IAdapter.EventContent(
                nonce,
                bytes32(uint256(uint160(erc20))),
                bytes32(destination),
                amount,
                sender,
                recipient,
                data
            )
        );
    }
}
