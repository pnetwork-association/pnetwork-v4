// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {XERC20Lockbox} from "../../src/contracts/XERC20Lockbox.sol";
import {XERC20Factory} from "../../src/contracts/XERC20Factory.sol";
import {XERC20} from "../../src/contracts/XERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract DeployHelper {
    string public constant SALT = "xERC20-v1.5";
    address[] emptyBridges;
    uint256[] emptyMintingLimits;
    uint256[] emptyBurningLimits;

    /// @dev Don't remove name and symbol from here
    /// since they cannot be deducted on destination
    /// chains.
    function _setupXERC20(
        address factory_,
        bytes32 erc20,
        string memory name,
        string memory symbol,
        bool local,
        bool freezingEnabled
    ) internal returns (XERC20, XERC20Lockbox, XERC20Factory) {
        bytes32 _salt = keccak256(abi.encodePacked(SALT, msg.sender));

        XERC20Factory factory = (factory_ == address(0))
            ? new XERC20Factory{salt: _salt}()
            : XERC20Factory(factory_);

        XERC20 xerc20 = XERC20(
            factory.deployXERC20(
                name,
                symbol,
                emptyMintingLimits,
                emptyBurningLimits,
                emptyBridges,
                freezingEnabled
            )
        );

        bool isNative = address(uint160(uint256(erc20))) == address(0);
        XERC20Lockbox lockbox;
        if (local) {
            lockbox = XERC20Lockbox(
                factory.deployLockbox(address(xerc20), address(uint160(uint256(erc20))), isNative)
            );
        }

        return (xerc20, lockbox, factory);
    }
}
