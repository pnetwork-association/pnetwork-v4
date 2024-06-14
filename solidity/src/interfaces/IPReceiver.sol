// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

/**
 * @title IPReceiver
 * @author pNetwork
 *
 * @dev Interface for contracts excpecting cross-chain data
 */
interface IPReceiver {
    /*
     * @dev Function called when userData.length > 0 when minting the pToken
     *
     * @param amount
     * @param userData
     */
    function receiveUserData(uint256 amount, bytes calldata userData) external;
}
