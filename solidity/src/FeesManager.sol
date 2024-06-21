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

    bytes32 public WITHDRAW_ROLE;
    bytes32 public UPGRADE_ROLE;
    bytes32 public SET_FEE_ROLE;

    struct Fee {
        uint256 minFee;
        uint16 basisPoints; // 4 decimals representation i.e. 2500 => 25 basis points => 0.25%
        bool defined;
    }

    mapping(uint16 => mapping(address => uint256))
        public depositedAmountByEpoch;
    mapping(uint16 => mapping(address => mapping(address => uint256)))
        public claimedAmountByEpoch;
    mapping(uint16 => mapping(address => uint256)) public stakedAmountByEpoch;
    mapping(uint16 => uint256) public totalStakedAmountByEpoch;
    mapping(address => Fee) public feeInfoByAsset;

    bool public initialized;

    event FeeUpdated(address token, uint256 minFee, uint256 basisPoints);

    error InvalidFromAddress();
    error InvalidEpoch();
    error NothingToClaim();
    error TooEarly();
    error AlreadyClaimed();
    error AlreadyInitialized();
    error UnsupportedToken(address xerc20);

    modifier onlyOnce() {
        if (initialized) revert AlreadyInitialized();
        _;
        initialized = true;
    }

    constructor() Ownable(msg.sender) {}

    function intialize(
        uint16 firstEpoch,
        address[] calldata nodes,
        uint256[] calldata amounts
    ) public onlyOnce {
        currentEpoch = firstEpoch;
        for (uint i = 0; i < nodes.length; i++) {
            stakedAmountByEpoch[currentEpoch][nodes[i]] = amounts[i];
            totalStakedAmountByEpoch[currentEpoch] += amounts[i];
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
        address xerc20,
        uint256 amount
    ) public view returns (uint256) {
        // We take the fees only when wrapping/unwrapping
        // the token. Host2host pegouts won't take any
        // fees, otherwise they would be taken twice when
        // pegging-out
        bool isLocal = IXERC20(xerc20).isLocal();

        if (isLocal) {
            Fee memory info = feeInfoByAsset[xerc20];
            if (!info.defined) revert UnsupportedToken(xerc20);
            uint256 fee = (amount * info.basisPoints) / 1000000;

            return
                fee < feeInfoByAsset[xerc20].minFee
                    ? feeInfoByAsset[xerc20].minFee
                    : fee;
        }

        return 0;
    }

    /// @inheritdoc IFeesManager
    function depositFeeForEpoch(uint16 epoch) public payable {
        if (epoch < currentEpoch) revert InvalidEpoch();
        depositedAmountByEpoch[epoch][address(0)] += msg.value;
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

    function setFee(
        address xerc20,
        uint256 minAmount,
        uint16 basisPoints
    ) external onlyOwner {
        feeInfoByAsset[xerc20] = Fee(minAmount, basisPoints, true);
        emit FeeUpdated(xerc20, minAmount, basisPoints);
    }
}
