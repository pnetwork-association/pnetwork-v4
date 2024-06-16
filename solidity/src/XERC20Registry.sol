// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IXERC20} from "./interfaces/IXERC20.sol";
import {IXERC20Registry} from "./interfaces/IXERC20Registry.sol";
import {IXERC20Lockbox} from "./interfaces/IXERC20Lockbox.sol";

contract XERC20Registry is IXERC20Registry, AccessControl {
    struct Entry {
        bytes32 erc20; // sha256 of token utf-8 string if on different chains (i.e. EOS, algorand)
        address xerc20; // type compatible with the underlying chain (would be an account for EOS)
    }

    /**
     * @notice Maps ERC20 to XERC20, if registered
     * @dev You can access the corresponding Entry by
     * using the resulting xERC20 address
     */
    mapping(bytes32 => address) public erc20ToXERC20;
    /**
     * @notice Maps xERC20 to Entry, if registered
     */
    mapping(address => Entry) public xerc20ToEntry;

    /**
     * @notice Role allowed to register/deregister XERC20s
     * @dev Role: 0xd6b769dbdbf190871759edfb79bd17eda0005e1b8c3b6b3f5b480b5604ad5014
     */
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR");

    event XERC20Registered(bytes32 erc20, address xerc20);
    event XERC20Deregistered(bytes32 erc20, address xerc20);

    error NotRegistered(address token);
    error NotRegistrarRole(address sender);

    /**
     * @notice Initializer function
     */
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    modifier onlyRegistrar() {
        if (!hasRole(REGISTRAR_ROLE, _msgSender()))
            revert NotRegistrarRole(_msgSender());
        _;
    }

    /**
     * @notice Adds an asset to the registry
     * @param erc20 Right-padded version of the ERC20 address or an hash if not local
     * @param xerc20 The address of the xERC20
     *
     * @dev In order to support multiple chains, ERC20 could also be an hash of
     * a string (i.e. support EOS account, algorand addresses etc..)
     */
    function registerXERC20(
        bytes32 erc20,
        address xerc20
    ) external onlyRegistrar {
        require(erc20ToXERC20[erc20] == address(0), "AlreadyRegistered");

        erc20ToXERC20[erc20] = xerc20;
        xerc20ToEntry[xerc20] = Entry(erc20, xerc20);

        emit XERC20Registered(erc20, xerc20);
    }

    /**
     * @notice Removes an asset from the registry
     * @param xerc20 The id of the registered asset
     */
    function deregisterXERC20(address xerc20) external onlyRegistrar {
        Entry memory e = xerc20ToEntry[xerc20];
        require(e.xerc20 != address(0), "NotRegistered");

        delete erc20ToXERC20[e.erc20];
        delete xerc20ToEntry[e.xerc20];

        emit XERC20Deregistered(e.erc20, e.xerc20);
    }

    function getAssets(address token) public view returns (bytes32, address) {
        Entry memory e = xerc20ToEntry[token];

        if (e.xerc20 != address(0) && e.erc20 != bytes32(0))
            return (e.erc20, e.xerc20);

        address xerc20 = erc20ToXERC20[bytes32(abi.encode(address(token)))];
        e = xerc20ToEntry[xerc20];

        if (e.xerc20 != address(0) && e.erc20 != bytes32(0))
            return (e.erc20, e.xerc20);

        revert NotRegistered(token);
    }

    function getAssets(bytes32 erc20) external view returns (bytes32, address) {
        address xerc20 = erc20ToXERC20[erc20];
        Entry memory e = xerc20ToEntry[xerc20];

        if (e.xerc20 == address(0) || e.erc20 == bytes32(0))
            revert NotRegistered(address(uint160(uint256(erc20))));

        return (e.erc20, e.xerc20);
    }
}
