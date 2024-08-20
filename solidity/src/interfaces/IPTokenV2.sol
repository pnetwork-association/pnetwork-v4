// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

interface IPTokenV2 {
    /**
     * @notice Returns if this token is local or not
     */
    function isLocal() external returns (bool);

    /**
     * @notice Returns the fees manager address
     */
    function getLockbox() external returns (address);

    /**
     * @notice Returns the PAM address
     *
     * @param adapter the relative adapter
     */
    function getPAM(address adapter) external returns (address);

    /**
     * @notice Returns the fees manager address
     */
    function getFeesManager() external returns (address);

    /**
     * @notice Set the fees manager address
     * @param newAddress new fees manager address
     */
    function setFeesManager(address newAddress) external;

    /**
     * @notice Set the new PAM address
     * @dev Be sure the API called by the adapter is respected
     *
     * @param adapterAddress  the adapter address
     * @param pamAddress  the new PAM address
     */
    function setPAM(address adapterAddress, address pamAddress) external;
}
