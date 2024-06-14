// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {IFeesManager} from "./interfaces/IFeesManager.sol";

contract FeesManager is
    IFeesManager,
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable
{
    using SafeERC20 for IERC20;
    uint16 public currentEpoch;

    bytes32 public WITHDRAW_ROLE;
    bytes32 public UPGRADE_ROLE;
    bytes32 public SET_FEE_ROLE;

    struct Fee {
        uint256 minFee;
        bytes4 originChainId;
    }

    mapping(uint16 => mapping(address => uint256))
        public depositedAmountByEpoch;
    mapping(uint16 => mapping(address => mapping(address => uint256)))
        public claimedAmountByEpoch;
    mapping(uint16 => mapping(address => uint256)) public stakedAmountByEpoch;
    mapping(uint16 => uint256) public totalStakedAmountByEpoch;
    mapping(address => Fee) public feeInfoByAsset;

    event FeeUpdated(address token, uint256 minFee, bytes4 originChainId);

    error InvalidEpoch();
    error NothingToClaim();
    error TooEarly();
    error AlreadyClaimed();
    error UnsupportedToken();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        uint16 firstEpoch,
        address[] calldata nodes,
        uint256[] calldata amounts
    ) public initializer {
        __UUPSUpgradeable_init();
        __Ownable_init();

        currentEpoch = firstEpoch;
        for (uint i = 0; i < nodes.length; i++) {
            stakedAmountByEpoch[currentEpoch][nodes[i]] = amounts[i];
            totalStakedAmountByEpoch[currentEpoch] += amounts[i];
        }
    }

    /// @inheritdoc IFeesManager
    function claimFeeByEpoch(address token, uint16 epoch) external {
        address payable sender = payable(_msgSender());
        if (epoch >= currentEpoch) revert TooEarly();
        if (claimedAmountByEpoch[epoch][token][sender] > 0)
            revert AlreadyClaimed();
        uint256 amount = (depositedAmountByEpoch[epoch][token] *
            stakedAmountByEpoch[epoch][sender]) /
            totalStakedAmountByEpoch[epoch];
        if (amount == 0) revert NothingToClaim();
        claimedAmountByEpoch[epoch][token][sender] += amount;
        if (token == address(0)) sender.transfer(amount);
        else IERC20(token).safeTransfer(sender, amount);
    }

    function registerAndAdvanceEpoch(
        address[] calldata nodes,
        uint256[] calldata amounts
    ) external onlyOwner {
        currentEpoch += 1;
        for (uint i = 0; i < nodes.length; i++) {
            stakedAmountByEpoch[currentEpoch][nodes[i]] = amounts[i];
            totalStakedAmountByEpoch[currentEpoch] += amounts[i];
        }
    }

    /// @inheritdoc IFeesManager
    function calculateFee(
        address token,
        uint256 amount,
        bytes4 destinationChainId
    ) public view returns (uint256) {
        Fee memory info = feeInfoByAsset[token];
        if (info.minFee == 0 && info.originChainId == 0)
            revert UnsupportedToken();
        uint256 fee = (amount *
            (
                destinationChainId == feeInfoByAsset[token].originChainId
                    ? 2500
                    : 1000
            )) / 1000000;
        return
            fee < feeInfoByAsset[token].minFee
                ? feeInfoByAsset[token].minFee
                : fee;
    }

    /// @inheritdoc IFeesManager
    function depositFee() public payable {
        depositedAmountByEpoch[currentEpoch][address(0)] += msg.value;
    }

    /// @inheritdoc IFeesManager
    function depositFeeForEpoch(uint16 epoch) public payable {
        if (epoch < currentEpoch) revert InvalidEpoch();
        depositedAmountByEpoch[epoch][address(0)] += msg.value;
    }

    /// @inheritdoc IFeesManager
    function depositFee(address token, uint256 amount) external {
        depositFeeForEpoch(token, amount, currentEpoch);
    }

    /// @inheritdoc IFeesManager
    function depositFeeForEpoch(
        address token,
        uint256 amount,
        uint16 epoch
    ) public {
        if (epoch < currentEpoch) revert InvalidEpoch();
        depositedAmountByEpoch[epoch][token] += amount;
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
    }

    function setFee(
        address token,
        uint256 minAmount,
        bytes4 originChainId
    ) external onlyOwner {
        feeInfoByAsset[token] = Fee(minAmount, originChainId);
        emit FeeUpdated(token, minAmount, originChainId);
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
