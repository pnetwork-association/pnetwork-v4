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

    // Wraps the event content
    struct EventBytes {
        bytes content;
    }

    event ReceiveUserDataFailed();
    event PAMChanged(address pamAddress);
    event Settled(bytes32 indexed eventId);
    event FeesManagerChanged(address newAddress);
    event Swap(uint256 indexed nonce, EventBytes eventBytes);

    error NotAContract(address addr);
    error OnlyFeesManager();
    error NotAllowed();
    error InvalidSwap();
    error InvalidAmount();
    error InvalidSender();
    error RLPInputTooLong();
    error InvalidOperation();
    error InvalidFeesManager();
    error Unauthorized(bytes32 eventId);
    error InvalidTokenAddress(address token);
    error UnsupportedChainId(uint256 chainId);
    error UnexpectedEventTopic(bytes32 topic);
    error AlreadyProcessed(bytes32 operationId);
    error UnsupportedProtocolId(bytes1 protocolId);
    error InvalidEventContentLength(uint256 length);
    error InsufficientAmount(uint256 amount, uint256 fees);
    error InvalidMessageId(uint256 actual, uint256 expected);
    error InvalidDestinationChainId(uint256 destinationChainId);

    /**
     * Finalise the swap operation on the destination chain
     *
     * @param operation struct with all the required properties to finalise the swap
     * @param metadata struct needed for the PAM in order to verify the operation is legit
     */
    function settle(
        Operation memory operation,
        IPAM.Metadata calldata metadata
    ) external;

    /**
     * @notice Wraps a token to another chain
     *
     * @param token ERC20 or xERC20 to move across chains (it must be supported by the Adapter)
     * @param amount token quantity to move across chains
     * @param recipient whom will receive the token
     * @param destinationChainId chain id where the wrapped version is destined to
     * @param data arbitrary message that would be sent at the end of the settle() function
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
    ) external payable;

    /**
     * @notice Should set the new PAM for this Adapter
     *
     * @param pam PAM address
     */
    function setPAM(address pam) external;

    /**
     * @notice Set the new fees manager for this adapter
     *
     * @dev Only the fees manager can set the new address
     * @param feesManager_ New fees manager address
     */
    function setFeesManager(address feesManager_) external;

    /**
     * @notice Calculate the amount of fees to substract from the given amount
     *
     * @param amount The amount from which the fees will be calculated
     */
    function calculateFee(uint256 amount) external returns (uint256);
}
