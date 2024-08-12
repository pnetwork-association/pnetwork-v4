// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.4 <0.9.0;

/**
 * @title PToken.sol storage layout
 * @author pNetwork Team
 * @notice Should be the first to inherit from on the v2 pToken contract version.
 */
contract PTokenV1Storage {
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

    bool internal _initialized;
    bool internal _initializing;
    uint256[50] private __gap0;
    mapping(bytes32 => RoleData) private _roles;
    uint256[49] private __gap1;
    address internal _owner;
    uint256[49] private __gap2;
    address private _relayHub;
    uint256[49] private __gap3;
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
    address private gsnTrustedSigner;
    address private gsnFeeTarget;
    uint256 private gsnExtraGas;
    address private adminOperator;
    bytes4 private ORIGIN_CHAIN_ID;
}
