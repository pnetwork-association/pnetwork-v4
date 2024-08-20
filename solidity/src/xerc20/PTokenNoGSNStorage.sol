// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.4 <0.9.0;

/**
 * @title PTokenNoGSN.sol storage layout
 * @author pNetwork Team
 *
 * @dev Provides the same storage layout of the PTokenNoGSN.sol
 * contract. This way we are able to keep the new version
 * upgrades clean concise.
 */
contract PTokenNoGSNStorage {
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
    /////// ERC777WithAdminOperatorUpgradeable
    mapping(address => uint256) internal _balances;
    uint256 internal _totalSupply;
    string internal _name;
    string internal _symbol;
    address[] private _defaultOperatorsArray;
    mapping(address => bool) private _defaultOperators;
    mapping(address => mapping(address => bool)) private _operators;
    mapping(address => mapping(address => bool))
        private _revokedDefaultOperators;
    mapping(address => mapping(address => uint256)) internal _allowances;
    uint256[41] private __gap4;
    address private adminOperator;
    /////// PToken (dropped)
    bytes4 private ORIGIN_CHAIN_ID;
    // This wasn't on the original PTokenNoGSN version.
    // We expect to initialize this value properly in
    // the initializeV2 function
    address internal _owner;
}
