// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

interface IXERC20Registry {
    function getAssets(
        address xerc20
    ) external view returns (bytes32, address, bool);

    function getAssets(
        bytes32 erc20
    ) external view returns (bytes32, address, bool);

    // function getLockbox(address erc20) external view returns (address xerc20);
}
