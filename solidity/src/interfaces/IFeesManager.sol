// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

/**
 * @title IFeesManager
 * @author pNetwork
 *
 */
interface IFeesManager {
    struct Fee {
        uint256 minFee;
        uint16 basisPoints; // 4 decimals representation i.e. 2500 => 25 basis points => 0.25%
        bool defined;
    }

    /**
     * @dev Emitted when the max total supply changes
     *
     * @param maxTotalSupply The maximun total supply
     */
    event MaxTotalSupplyChanged(uint256 maxTotalSupply);

    /**
     * @dev Emitted when the token changes
     *
     * @param previousXERC20 the previous token
     * @param newXERC20 the new token
     */
    event TokenChanged(address previousXERC20, address newXERC20);

    /*
     * Get expected fee for a swap.
     * @param {address} xerc20 - The token address that will be swapped.
     * @param {uint256} amount - The token amount that will be swapped.
     * @param {bytes4} destinationChainId - The swap destination chain ID.
     */
    function calculateFee(
        address xerc20,
        uint256 amount
    ) external view returns (uint256);

    /*
     * Allows a staker to claim protocol fees for a specific token and epoch.
     * @param {address} xerc20 - The token address for which fees are being claimed.
     * @param {uint16} epoch - The epoch number for which fees are being claimed.
     */
    function claimFeeByEpoch(address xerc20, uint16 epoch) external;

    /*
     * Allows to deposit protocol fees for the native currency that will be distributed for a specific epoch.
     * @param {uint16} epoch - The epoch number for which fees are being deposited.
     */
    function depositFeeForEpoch(uint16 epoch) external payable;

    /*
     * Allows to deposit protocol fees for a certain token that will be distributed for the current epoch.
     * @param {address} xerc20 - The token address for which fees are being deposited.
     * @param {uint256} amount - The amount of fees being deposited for the specified token.
     */
    function depositFee(address xerc20, uint256 amount) external;

    /*
     * Allows to deposit protocol fees for a certain token that will be distributed for the current epoch.
     * @from {address} from - The address where the tokens will be transfered from.
     * @param {address} xerc20 - The token address for which fees are being deposited.
     * @param {uint256} amount - The amount of fees being deposited for the specified token.
     */
    function depositFeeFrom(
        address from,
        address xerc20,
        uint256 amount
    ) external;

    /*
     * Allows to deposit protocol fees for a certain token that will be distributed for a specific epoch.
     * @param {address} xerc20 - The token address for which fees are being deposited.
     * @param {uint256} amount - The amount of fees being deposited for the specified token.
     * * @param {uint16} epoch - The epoch number for which fees are being deposited.
     */
    function depositFeeForEpoch(
        address xerc20,
        uint256 amount,
        uint16 epoch
    ) external;

    /*
     * Allows to deposit protocol fees for a certain token that will be distributed for a specific epoch.
     * @from {address} from - The address where the tokens will be transfered from.
     * @param {address} xerc20 - The token address for which fees are being deposited.
     * @param {uint256} amount - The amount of fees being deposited for the specified token.
     * * @param {uint16} epoch - The epoch number for which fees are being deposited.
     */
    function depositFeeForEpochFrom(
        address from,
        address xerc20,
        uint256 amount,
        uint16 epoch
    ) external;
}
