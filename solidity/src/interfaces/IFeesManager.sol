// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

/**
 * @title IFeesManager
 * @author pNetwork
 *
 * @notice
 */
interface IFeesManager {
    /**
     * @dev Emitted when the max total supply changes
     *
     * @param maxTotalSupply The maximun total supply
     */
    event MaxTotalSupplyChanged(uint256 maxTotalSupply);

    /**
     * @dev Emitted when the token changes
     *
     * @param previousToken the previous token
     * @param newToken the new token
     */
    event TokenChanged(address previousToken, address newToken);

    /*
     * Get expected fee for a swap.
     * @param {address} token - The token address that will be swapped.
     * @param {uint256} amount - The token amount that will be swapped.
     * @param {bytes4} destinationChainId - The swap destination chain ID.
     */
    function calculateFee(address token, uint256 amount, bytes4 destinationChainId) external view returns (uint256);

    /*
     * Allows a staker to claim protocol fees for a specific token and epoch.
     * @param {address} token - The token address for which fees are being claimed.
     * @param {uint16} epoch - The epoch number for which fees are being claimed.
     */
    function claimFeeByEpoch(address token, uint16 epoch) external;

    /*
     * Allows to deposit protocol fees for the native currency that will be distributed for the current epoch.
     */
    function depositFee() external payable;

    /*
     * Allows to deposit protocol fees for the native currency that will be distributed for a specific epoch.
     * @param {uint16} epoch - The epoch number for which fees are being deposited.
     */
    function depositFeeForEpoch(uint16 epoch) external payable;

    /*
     * Allows to deposit protocol fees for a certain token that will be distributed for the current epoch.
     * @param {address} token - The token address for which fees are being deposited.
     * @param {uint256} amount - The amount of fees being deposited for the specified token.
     */
    function depositFee(address token, uint256 amount) external;

    /*
     * Allows to deposit protocol fees for a certain token that will be distributed for a specific epoch.
     * @param {address} token - The token address for which fees are being deposited.
     * @param {uint256} amount - The amount of fees being deposited for the specified token.
     * * @param {uint16} epoch - The epoch number for which fees are being deposited.
     */
    function depositFeeForEpoch(address token, uint256 amount, uint16 epoch) external;
}
