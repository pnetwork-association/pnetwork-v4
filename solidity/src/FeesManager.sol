// SPDX-License-Identifier: MIT

pragma solidity ^0.8.25;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IXERC20} from "./interfaces/IXERC20.sol";
import {IFeesManager} from "./interfaces/IFeesManager.sol";

contract FeesManager is IFeesManager, Ownable {
    using SafeERC20 for IERC20;
    uint16 public currentEpoch;

    mapping(uint16 => mapping(address => uint256))
        public depositedAmountByEpoch;
    mapping(uint16 => mapping(address => mapping(address => uint256)))
        public claimedAmountByEpoch;
    mapping(uint16 => mapping(address => uint256)) public stakedAmountByEpoch;
    mapping(uint16 => uint256) public totalStakedAmountByEpoch;
    mapping(address => Fee) public feeInfoByAsset;

    event FeeUpdated(address token, uint256 minFee, uint16 basisPoints);
    event NewEpochStarted(uint16 epoch);

    error InvalidToken();
    error InvalidFromAddress();
    error InvalidEpoch();
    error NothingToClaim();
    error TooEarly();
    error AlreadyClaimed();
    error NotLocal(address xerc20);
    error UnsupportedToken(address xerc20);
    error DifferentLength(uint256 len1, uint256 len2);

    constructor(
        uint16 firstEpoch,
        address[] memory nodes,
        uint256[] memory stakedAmounts
    ) Ownable(msg.sender) {
        if (nodes.length != stakedAmounts.length)
            revert DifferentLength(nodes.length, stakedAmounts.length);

        currentEpoch = firstEpoch;
        for (uint i = 0; i < nodes.length; i++) {
            stakedAmountByEpoch[currentEpoch][nodes[i]] = stakedAmounts[i];
            totalStakedAmountByEpoch[currentEpoch] += stakedAmounts[i];
        }
    }

    function setFeesManagerForXERC20(
        address xerc20,
        address newFeesManager
    ) external onlyOwner {
        IXERC20(xerc20).setFeesManager(newFeesManager);
    }

    /// @inheritdoc IFeesManager
    function claimFeeByEpoch(address token, uint16 epoch) external {
        if (token == address(0) || !feeInfoByAsset[token].defined)
            revert InvalidToken();
        if (epoch >= currentEpoch) revert TooEarly();
        if (claimedAmountByEpoch[epoch][token][msg.sender] > 0)
            revert AlreadyClaimed();

        uint256 amount = (depositedAmountByEpoch[epoch][token] *
            stakedAmountByEpoch[epoch][msg.sender]) /
            totalStakedAmountByEpoch[epoch];

        if (amount == 0) revert NothingToClaim();

        claimedAmountByEpoch[epoch][token][msg.sender] += amount;

        IERC20(token).safeTransfer(msg.sender, amount);
    }

    function registerAndAdvanceEpoch(
        address[] calldata nodes,
        uint256[] calldata amounts
    ) external onlyOwner {
        if (nodes.length != amounts.length)
            revert DifferentLength(nodes.length, amounts.length);

        currentEpoch += 1;
        for (uint i = 0; i < nodes.length; i++) {
            stakedAmountByEpoch[currentEpoch][nodes[i]] = amounts[i];
            totalStakedAmountByEpoch[currentEpoch] += amounts[i];
        }

        emit NewEpochStarted(currentEpoch);
    }

    /// @inheritdoc IFeesManager
    function depositFee(address xerc20, uint256 amount) external {
        depositFeeForEpoch(xerc20, amount, currentEpoch);
    }

    /// @inheritdoc IFeesManager
    function depositFeeFrom(
        address from,
        address xerc20,
        uint256 amount
    ) external {
        depositFeeForEpochFrom(from, xerc20, amount, currentEpoch);
    }

    /// @inheritdoc IFeesManager
    function setFee(
        address xerc20,
        uint256 minAmount,
        uint16 basisPoints
    ) external onlyOwner {
        if (xerc20 == address(0)) revert InvalidToken();
        feeInfoByAsset[xerc20] = Fee(minAmount, basisPoints, true);
        emit FeeUpdated(xerc20, minAmount, basisPoints);
    }

    /// @inheritdoc IFeesManager
    function calculateFee(
        address xerc20,
        uint256 amount
    ) external returns (uint256) {
        // We take the fees only when wrapping/unwrapping
        // the token. Host2host pegouts won't take any
        // fees, otherwise this logic would taken them twice when
        // pegging-out
        if (!IXERC20(xerc20).isLocal()) return 0;

        Fee memory info = feeInfoByAsset[xerc20];

        if (!info.defined) return 0;

        uint256 fee = (amount * info.basisPoints) / 1000000;

        return
            fee < feeInfoByAsset[xerc20].minFee
                ? feeInfoByAsset[xerc20].minFee
                : fee;
    }

    /// @inheritdoc IFeesManager
    function depositFeeForEpoch(
        address xerc20,
        uint256 amount,
        uint16 epoch
    ) public {
        depositFeeForEpochFrom(msg.sender, xerc20, amount, epoch);
    }

    /// @inheritdoc IFeesManager
    function depositFeeForEpochFrom(
        address from,
        address xerc20,
        uint256 amount,
        uint16 epoch
    ) public {
        if (from == address(0)) revert InvalidFromAddress();

        if (epoch < currentEpoch) revert InvalidEpoch();

        if (!feeInfoByAsset[xerc20].defined) revert UnsupportedToken(xerc20);

        depositedAmountByEpoch[epoch][xerc20] += amount;
        IERC20(xerc20).safeTransferFrom(from, address(this), amount);
    }
}
