// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IXERC20} from "./interfaces/IXERC20.sol";
import {IXERC20Registry} from "./interfaces/IXERC20Registry.sol";
import {IXERC20Lockbox} from "./interfaces/IXERC20Lockbox.sol";

import "forge-std/console.sol";
contract XERC20Registry is IXERC20Registry, Ownable {
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

    event XERC20Registered(bytes32 erc20, address xerc20);
    event XERC20Deregistered(bytes32 erc20, address xerc20);

    error NotAllowed();
    error NotOwnableCompatible();
    error NotRegistered(address token);
    error AlreadyRegistered(address token);

    /**
     * Only the owner or the token owner of the registry is
     * allowed to register/deregister an entry.
     *
     * NOTE: only ERC20 tokens implementing the Ownable interface are supported.
     *
     * @param token the ERC20 token
     */
    modifier onlyOwnerOrTokenOwner(address token) {
        address tokenOwner;
        address owner_ = owner();
        try Ownable(token).owner() returns (address tokenOwner_) {
            tokenOwner = tokenOwner_;
        } catch {
            // If ownership has been renounced there's nothing we can do
            if (owner_ == address(0)) revert NotOwnableCompatible();
        }

        if (tokenOwner != msg.sender && owner_ != msg.sender)
            revert NotAllowed();

        _;
    }

    /**
     * @notice Initializer function
     */
    constructor() Ownable(msg.sender) {}

    /**
     * @notice Adds an asset to the registry
     * @param erc20 Right-padded version of the ERC20 address or an hash if not local
     * @dev   If the xerc20 refers to the native currency (i.e. eth) then this value
     *        must be bytes32(0)
     * @param xerc20 The address of the xERC20
     *
     * @dev In order to support multiple chains, ERC20 could also be an hash of
     * a string (i.e. support EOS account, algorand addresses etc..)
     */
    function registerXERC20(
        address erc20,
        address xerc20
    ) external onlyOwnerOrTokenOwner(erc20) {
        bytes32 erc20Bytes = bytes32(abi.encode(erc20));

        if (erc20ToXERC20[erc20Bytes] != address(0))
            revert AlreadyRegistered(erc20);

        Entry memory entry = xerc20ToEntry[xerc20];
        if (entry.erc20 != bytes32(0) || entry.xerc20 != address(0))
            revert AlreadyRegistered(xerc20);

        erc20ToXERC20[erc20Bytes] = xerc20;
        xerc20ToEntry[xerc20] = Entry(erc20Bytes, xerc20);

        emit XERC20Registered(erc20Bytes, xerc20);
    }

    /**
     * @notice Removes an asset from the registry
     * @param erc20 The erc20 unwrapped asset
     */
    function deregisterXERC20(
        address erc20
    ) external onlyOwnerOrTokenOwner(erc20) {
        bytes32 erc20Bytes = bytes32(abi.encode(erc20));
        address xerc20 = erc20ToXERC20[erc20Bytes];

        if (xerc20 == address(0)) revert NotRegistered(xerc20);

        delete erc20ToXERC20[erc20Bytes];
        delete xerc20ToEntry[xerc20];

        emit XERC20Deregistered(erc20Bytes, xerc20);
    }

    function getAssets(address token) public view returns (bytes32, address) {
        Entry memory e = xerc20ToEntry[token];

        if (e.xerc20 != address(0) && e.erc20 != bytes32(0))
            return (e.erc20, e.xerc20);

        address xerc20 = erc20ToXERC20[bytes32(abi.encode(address(token)))];
        e = xerc20ToEntry[xerc20];

        if (e.xerc20 != address(0)) return (e.erc20, e.xerc20);

        revert NotRegistered(token);
    }

    function getAssets(bytes32 erc20) external view returns (bytes32, address) {
        address xerc20 = erc20ToXERC20[erc20];

        Entry memory e = xerc20ToEntry[xerc20];

        if (e.xerc20 == address(0))
            revert NotRegistered(address(uint160(uint256(erc20))));

        return (e.erc20, e.xerc20);
    }
}
