// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IXERC20Registry {
    /**
     * @notice Return the xERC20/ERC20 pair given a token address if extant.
     *
     * @param xerc20 a possible xERC20 address
     * @return the xERC20 address
     * @return the relative ERC20 address
     */
    function getAssets(address xerc20) external view returns (bytes32, address);

    /**
     * @notice Return the xERC20/ERC20 pair given a token address if extant.
     *
     * @param erc20 a possible ERC20 address
     * @return the xERC20 address
     * @return the relative ERC20 address
     */
    function getAssets(bytes32 erc20) external view returns (bytes32, address);
}
