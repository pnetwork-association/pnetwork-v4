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
        bytes32 sender;
        address recipient;
        bytes data;
    }

    struct EventContent {
        uint256 nonce;
        bytes32 erc20;
        bytes32 destinationChainId;
        uint256 amount;
        address sender;
        string recipient;
        bytes data;
    }

    event Swap(uint256 indexed nonce, EventContent eventContent);

    event ReceiveUserDataFailed();

    event Settled();

    function settle(
        Operation memory operation,
        IPAM.Metadata calldata metadata
    ) external;

    /**
     * @notice Wraps a token to another chain
     *
     * @dev Be sure the pair is registered in the local XERC20 registry
     *
     * @param token ERC20 or xERC20 to move across chains
     * @param amount token quantity to move across chains
     * @param recipient whom will receive the token
     * @param destinationChainId chain id where the wrapped version is destined to
     * (it may be a sha256 hash of the relevant ID of the chain (i.e. sha256 of the chain id for EOS))
     */
    function swap(
        address token,
        uint256 amount,
        uint256 destinationChainId,
        string calldata recipient
    ) external;

    /**
     * @notice Wraps a token to another chain
     *
     * @dev Be sure the pair is registered in the local XERC20 registry
     *
     * @param token ERC20 or xERC20 to move across chains
     * @param amount token quantity to move across chains
     * @param recipient whom will receive the token
     * @param destinationChainId chain id where the wrapped version is destined to
     *
     * @dev If the destination chain id doesn't fit in 32 bytes or if there are collisions
     *      the options are one of the two:
     *        1) custom chain id (hardcoded on the PAM in the destination)
     *        2) sha256(chain id)
     *
     * @param data metadata
     */
    function swap(
        address token,
        uint256 amount,
        uint256 destinationChainId,
        string memory recipient,
        bytes memory data
    ) external;

    function swapNative(
        uint256 destinationChainId,
        string memory recipient,
        bytes memory data
    ) external payable;

    function swapNative(
        uint256 destinationChainId,
        string memory recipient
    ) external payable;
}
