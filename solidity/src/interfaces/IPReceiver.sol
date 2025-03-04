// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title IPReceiver
 * @author pNetwork
 *
 * @dev Interface for contracts excpecting cross-chain data
 */
interface IPReceiver {
    // Wraps up IAdapter.Operation data
    // providing the receiver more field
    // to validate
    struct UserData {
        bytes32 originAccount;
        bytes32 originChainId;
        bytes32 erc20;
        bytes data;
    }

    /*
     * @dev Function called when userData.length > 0 when minting the pToken
     *
     * @param userData
     */
    function receiveUserData(UserData memory userData) external;
}
