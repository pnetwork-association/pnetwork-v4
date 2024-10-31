// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IAdapter} from "../../interfaces/IAdapter.sol";

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
        bytes32 topic0 = bytes32(
            0x66756E6473206172652073616675207361667520736166752073616675202E2E
        );
        bytes memory eventBytes = bytes.concat(
            bytes32(nonce),
            bytes32(abi.encode(erc20)),
            bytes32(destination),
            bytes32(amount),
            bytes32(uint256(uint160(sender))),
            bytes32(bytes(recipient).length),
            bytes(recipient),
            data
        );
        assembly {
            // For memory bytes, skip the length prefix (32 bytes)
            let dataStart := add(eventBytes, 32)
            let length := mload(eventBytes)

            log2(dataStart, length, topic0, nonce)
        }
    }
}
