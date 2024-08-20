// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.4 <0.9.0;

/**
 * @title PToken.sol storage layout
 * @author pNetwork Team
 *
 * @dev Provides the same storage layout of the PToken.sol
 * contract. This way we are able to keep the new version
 * upgrades clean concise.
 */
contract PTokenStorage {
    struct Set {
        bytes32[] _values;
        mapping(bytes32 => uint256) _indexes;
    }
    struct AddressSet {
        Set _inner;
    }

    struct RoleData {
        AddressSet members;
        bytes32 adminRole;
    }

    ////////////// Initializable (dropped)
    bool private _initialized;
    bool private _initializing;
    uint256[50] private __gap0;
    //////////////////// AccessControlUpgradeable (dropped)
    mapping(bytes32 => RoleData) private _roles;
    uint256[49] private __gap1;
    /////// ERC777GSNUpgradeable -> OwnableUpgradeable (reused)
    address internal _owner;
    uint256[49] private __gap2;
    /////// ERC777GSNUpgradeable -> GSNRecipientUpgradeable (dropped)
    address private _relayHub;
    uint256[49] private __gap3;
    /////// ERC777GSNUpgradeable -> ERC777Upgradeable
    mapping(address => uint256) internal _balances; // reused
    uint256 internal _totalSupply; // reused
    string internal _name; // reused
    string internal _symbol; // reused
    address[] private _defaultOperatorsArray; // dropped
    mapping(address => bool) private _defaultOperators; // dropped
    mapping(address => mapping(address => bool)) private _operators; // dropped
    mapping(address => mapping(address => bool)) // dropped
        private _revokedDefaultOperators; // dropped
    mapping(address => mapping(address => uint256)) internal _allowances; // dropped
    uint256[41] private __gap4; // dropped
    /////// ERC777GSNUpgradeable -> GSNRecipientUpgradeable (dropped)
    address private gsnTrustedSigner;
    address private gsnFeeTarget;
    uint256 private gsnExtraGas;
    /////// ERC777WithAdminOperatorUpgradeable (dropped)
    address private adminOperator;
    /////// PToken (dropped)
    bytes4 private ORIGIN_CHAIN_ID;
}
