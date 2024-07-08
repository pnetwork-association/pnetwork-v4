// SPDX-License-Identifier: MIT

pragma solidity ^0.8.25;

import {IFeesManager} from "../interfaces/IFeesManager.sol";
import {IXERC20} from "../interfaces/IXERC20.sol";

contract FeesManagerTest {
    function calculateFee(
        address xerc20,
        uint256 amount
    ) public view returns (uint256) {
        return 0;
    }

    function depositFeeFrom(
        address from,
        address xerc20,
        uint256 amount
    ) public view {}

    function setFeesManagerForXERC20(
        address xerc20,
        address newFeesManager
    ) public {
        IXERC20(xerc20).setFeesManager(newFeesManager);
    }
}
