// SPDX-License-Identifier: MIT
pragma solidity ^0.6.2;
pragma experimental ABIEncoderV2;

import {IXERC20_solc_0_6 as IXERC20} from "./IXERC20-solc-0.6.sol";
import {IFeesManager_solc_0_6 as IFeesManager} from "./IFeesManager-solc-0.6.sol";
import "../ptoken-v1/ERC777GSN.sol";
import "../ptoken-v1/ERC777WithAdminOperatorUpgradeable.sol";
import "../ptoken-v1/ERC777Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

contract PTokenV2 is
    Initializable,
    AccessControlUpgradeable,
    ERC777GSNUpgradeable,
    ERC777WithAdminOperatorUpgradeable,
    IXERC20
{
    // V1
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes4 public ORIGIN_CHAIN_ID;

    // V2
    uint256 private constant _DURATION = 1 days;
    address public lockbox;
    mapping(address => Bridge) public bridges;
    address public feesManager;
    mapping(address => address) public adapterToPAM;

    event PAMChanged(address newAddress);
    event FeesManagerChanged(address newAddress);

    function initialize(
        string memory tokenName,
        string memory tokenSymbol,
        address defaultAdmin,
        bytes4 originChainId
    ) public initializer {
        address[] memory defaultOperators;
        __Ownable_init();
        __AccessControl_init();
        __ERC777_init(tokenName, tokenSymbol, defaultOperators);
        __ERC777GSNUpgradeable_init(defaultAdmin, defaultAdmin);
        __ERC777WithAdminOperatorUpgradeable_init(defaultAdmin);
        _setupRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        ORIGIN_CHAIN_ID = originChainId;
    }

    function setFeesManager(address newAddress) external override {
        address msgSender = _msgSender();

        if (feesManager != address(0) && msgSender != feesManager)
            revert("OnlyFeesManager");

        feesManager = newAddress;

        emit FeesManagerChanged(newAddress);
    }

    /**
     * @notice Set the new PAM address
     * @dev Be sure the API called by the adapter is respected
     *
     * @param adapterAddress  the adapter address
     * @param pamAddress  the new PAM address
     */
    function setPAM(
        address adapterAddress,
        address pamAddress
    ) external onlyOwner {
        adapterToPAM[adapterAddress] = pamAddress;
        emit PAMChanged(pamAddress);
    }

    function isLocal() external view override returns (bool) {
        return (lockbox != address(0));
    }

    function getPAM(address adapter) external view override returns (address) {
        return adapterToPAM[adapter];
    }

    function getFeesManager() external view override returns (address) {
        return feesManager;
    }

    function getLockbox() external view override returns (address) {
        return lockbox;
    }

    /**
     * @notice Mints tokens for a user
     * @dev Can only be called by a bridge
     * @param _user The address of the user who needs tokens minted
     * @param _amount The amount of tokens being minted
     */

    function mint(address _user, uint256 _amount) external override {
        _mintWithCaller(msg.sender, _user, _amount);
    }

    /**
     * @notice Burns tokens for a user
     * @dev Can only be called by a bridge
     * @param _user The address of the user who needs tokens burned
     * @param _amount The amount of tokens being burned
     */

    function burn(address _user, uint256 _amount) external override {
        if (msg.sender != _user) {
            _spendAllowance(_user, msg.sender, _amount);
        }

        _burnWithCaller(msg.sender, _user, _amount);
    }

    function burn(uint256, bytes memory) public override {
        revert("Not implemented");
    }

    /**
     * @notice Sets the lockbox address
     *
     * @param _lockbox The address of the lockbox
     */

    function setLockbox(address _lockbox) external override onlyOwner {
        // if (msg.sender != FACTORY) revert IXERC20_NotFactory();
        lockbox = _lockbox;

        emit LockboxSet(_lockbox);
    }

    /**
     * @notice Updates the limits of any bridge
     * @dev Can only be called by the owner
     * @param _mintingLimit The updated minting limit we are setting to the bridge
     * @param _burningLimit The updated burning limit we are setting to the bridge
     * @param _bridge The address of the bridge we are setting the limits too
     */
    function setLimits(
        address _bridge,
        uint256 _mintingLimit,
        uint256 _burningLimit
    ) external override onlyOwner {
        _changeMinterLimit(_bridge, _mintingLimit);
        _changeBurnerLimit(_bridge, _burningLimit);
        emit BridgeLimitsSet(_mintingLimit, _burningLimit, _bridge);
    }

    /**
     * @notice Returns the max limit of a bridge
     *
     * @param _bridge the bridge we are viewing the limits of
     * @return _limit The limit the bridge has
     */

    function mintingMaxLimitOf(
        address _bridge
    ) public view override returns (uint256 _limit) {
        _limit = bridges[_bridge].minterParams.maxLimit;
    }

    /**
     * @notice Returns the max limit of a bridge
     *
     * @param _bridge the bridge we are viewing the limits of
     * @return _limit The limit the bridge has
     */

    function burningMaxLimitOf(
        address _bridge
    ) public view override returns (uint256 _limit) {
        _limit = bridges[_bridge].burnerParams.maxLimit;
    }

    /**
     * @notice Returns the current limit of a bridge
     *
     * @param _bridge the bridge we are viewing the limits of
     * @return _limit The limit the bridge has
     */

    function mintingCurrentLimitOf(
        address _bridge
    ) public view override returns (uint256 _limit) {
        _limit = _getCurrentLimit(
            bridges[_bridge].minterParams.currentLimit,
            bridges[_bridge].minterParams.maxLimit,
            bridges[_bridge].minterParams.timestamp,
            bridges[_bridge].minterParams.ratePerSecond
        );
    }

    /**
     * @notice Returns the current limit of a bridge
     *
     * @param _bridge the bridge we are viewing the limits of
     * @return _limit The limit the bridge has
     */

    function burningCurrentLimitOf(
        address _bridge
    ) public view override returns (uint256 _limit) {
        _limit = _getCurrentLimit(
            bridges[_bridge].burnerParams.currentLimit,
            bridges[_bridge].burnerParams.maxLimit,
            bridges[_bridge].burnerParams.timestamp,
            bridges[_bridge].burnerParams.ratePerSecond
        );
    }

    /**
     * @notice Uses the limit of any bridge
     * @param _bridge The address of the bridge who is being changed
     * @param _change The change in the limit
     */

    function _useMinterLimits(address _bridge, uint256 _change) internal {
        uint256 _currentLimit = mintingCurrentLimitOf(_bridge);
        bridges[_bridge].minterParams.timestamp = block.timestamp;
        bridges[_bridge].minterParams.currentLimit = _currentLimit - _change;
    }

    /**
     * @notice Uses the limit of any bridge
     * @param _bridge The address of the bridge who is being changed
     * @param _change The change in the limit
     */

    function _useBurnerLimits(address _bridge, uint256 _change) internal {
        uint256 _currentLimit = burningCurrentLimitOf(_bridge);
        bridges[_bridge].burnerParams.timestamp = block.timestamp;
        bridges[_bridge].burnerParams.currentLimit = _currentLimit - _change;
    }

    /**
     * @notice Updates the limit of any bridge
     * @dev Can only be called by the owner
     * @param _bridge The address of the bridge we are setting the limit too
     * @param _limit The updated limit we are setting to the bridge
     */

    function _changeMinterLimit(address _bridge, uint256 _limit) internal {
        uint256 _oldLimit = bridges[_bridge].minterParams.maxLimit;
        uint256 _currentLimit = mintingCurrentLimitOf(_bridge);
        bridges[_bridge].minterParams.maxLimit = _limit;

        bridges[_bridge].minterParams.currentLimit = _calculateNewCurrentLimit(
            _limit,
            _oldLimit,
            _currentLimit
        );

        bridges[_bridge].minterParams.ratePerSecond = _limit / _DURATION;
        bridges[_bridge].minterParams.timestamp = block.timestamp;
    }

    /**
     * @notice Updates the limit of any bridge
     * @dev Can only be called by the owner
     * @param _bridge The address of the bridge we are setting the limit too
     * @param _limit The updated limit we are setting to the bridge
     */

    function _changeBurnerLimit(address _bridge, uint256 _limit) internal {
        uint256 _oldLimit = bridges[_bridge].burnerParams.maxLimit;
        uint256 _currentLimit = burningCurrentLimitOf(_bridge);
        bridges[_bridge].burnerParams.maxLimit = _limit;

        bridges[_bridge].burnerParams.currentLimit = _calculateNewCurrentLimit(
            _limit,
            _oldLimit,
            _currentLimit
        );

        bridges[_bridge].burnerParams.ratePerSecond = _limit / _DURATION;
        bridges[_bridge].burnerParams.timestamp = block.timestamp;
    }

    /**
     * @notice Updates the current limit
     *
     * @param _limit The new limit
     * @param _oldLimit The old limit
     * @param _currentLimit The current limit
     * @return _newCurrentLimit The new current limit
     */

    function _calculateNewCurrentLimit(
        uint256 _limit,
        uint256 _oldLimit,
        uint256 _currentLimit
    ) internal pure returns (uint256 _newCurrentLimit) {
        uint256 _difference;

        if (_oldLimit > _limit) {
            _difference = _oldLimit - _limit;
            _newCurrentLimit = _currentLimit > _difference
                ? _currentLimit - _difference
                : 0;
        } else {
            _difference = _limit - _oldLimit;
            _newCurrentLimit = _currentLimit + _difference;
        }
    }

    /**
     * @notice Gets the current limit
     *
     * @param _currentLimit The current limit
     * @param _maxLimit The max limit
     * @param _timestamp The timestamp of the last update
     * @param _ratePerSecond The rate per second
     * @return _limit The current limit
     */

    function _getCurrentLimit(
        uint256 _currentLimit,
        uint256 _maxLimit,
        uint256 _timestamp,
        uint256 _ratePerSecond
    ) internal view returns (uint256 _limit) {
        _limit = _currentLimit;
        if (_limit == _maxLimit) {
            return _limit;
        } else if (_timestamp + _DURATION <= block.timestamp) {
            _limit = _maxLimit;
        } else if (_timestamp + _DURATION > block.timestamp) {
            uint256 _timePassed = block.timestamp - _timestamp;
            uint256 _calculatedLimit = _limit + (_timePassed * _ratePerSecond);
            _limit = _calculatedLimit > _maxLimit
                ? _maxLimit
                : _calculatedLimit;
        }
    }

    /**
     * @notice Internal function for burning tokens
     *
     * @param _caller The caller address
     * @param _user The user address
     * @param _amount The amount to burn
     */

    function _burnWithCaller(
        address _caller,
        address _user,
        uint256 _amount
    ) internal {
        uint256 fees;
        // is local?
        if (lockbox != address(0) && feesManager != address(0)) {
            fees = IFeesManager(feesManager).calculateFee(
                address(this),
                _amount
            );
        }

        if (fees > _amount) revert("InsufficientAmount");

        uint256 netAmount = _amount - fees;

        if (_caller != lockbox) {
            uint256 _currentLimit = burningCurrentLimitOf(_caller);
            if (_currentLimit < netAmount)
                revert("IXERC20_NotHighEnoughLimits");
            _useBurnerLimits(_caller, netAmount);
        }

        if (fees > 0) {
            IFeesManager(feesManager).depositFeeFrom(
                msg.sender,
                address(this),
                fees
            );
        }

        _burn(_user, netAmount, "", "");
    }

    /**
     * @notice Internal function for minting tokens
     *
     * @param _caller The caller address
     * @param _user The user address
     * @param _amount The amount to mint
     */

    function _mintWithCaller(
        address _caller,
        address _user,
        uint256 _amount
    ) internal {
        if (_caller != lockbox) {
            uint256 _currentLimit = mintingCurrentLimitOf(_caller);
            if (_currentLimit < _amount) revert("IXERC20_NotHighEnoughLimits");
            _useMinterLimits(_caller, _amount);
        }
        _mint(_user, _amount, "", "");
    }

    // V1
    function grantMinterRole(address _account) external {
        grantRole(MINTER_ROLE, _account);
    }

    function revokeMinterRole(address _account) external {
        revokeRole(MINTER_ROLE, _account);
    }

    function hasMinterRole(address _account) external view returns (bool) {
        return hasRole(MINTER_ROLE, _account);
    }

    function _msgSender()
        internal
        view
        override(ContextUpgradeable, ERC777GSNUpgradeable)
        returns (address payable)
    {
        return GSNRecipientUpgradeable._msgSender();
    }

    function _msgData()
        internal
        view
        override(ContextUpgradeable, ERC777GSNUpgradeable)
        returns (bytes memory)
    {
        return GSNRecipientUpgradeable._msgData();
    }
}
