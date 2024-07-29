// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {Vm} from "forge-std/Vm.sol";
import {Helper} from "./Helper.sol";
import {Test, stdMath} from "forge-std/Test.sol";

import {XERC20} from "../../src/xerc20/XERC20.sol";
import {FeesManager} from "../../src/FeesManager.sol";
import {ERC20Test} from "../../src/test/ERC20Test.sol";

import {IXERC20} from "../../src/interfaces/IXERC20.sol";
import {IFeesManager} from "../../src/interfaces/IFeesManager.sol";

import "forge-std/console.sol";

contract FeesManagerTest is Test, Helper {
    address owner = vm.addr(1);
    address user = vm.addr(2);
    address evil = vm.addr(3);

    address node0 = vm.addr(4);
    address node1 = vm.addr(5);
    address node2 = vm.addr(6);
    address node3 = vm.addr(7);
    address node4 = vm.addr(8);
    address node5 = vm.addr(9);

    uint256 stakedAmount0 = 1 ether;
    uint256 stakedAmount1 = 2 ether;
    uint256 stakedAmount2 = 3 ether;
    uint256 stakedAmount3 = 4 ether;
    uint256 stakedAmount4 = 5 ether;
    uint256 stakedAmount5 = 6 ether;

    uint256 totalStaked =
        stakedAmount0 +
            stakedAmount1 +
            stakedAmount2 +
            stakedAmount3 +
            stakedAmount4 +
            stakedAmount5;

    address[] nodes = [node0, node1, node2, node3, node4, node5];

    uint256[] stakedAmounts = [
        stakedAmount0,
        stakedAmount1,
        stakedAmount2,
        stakedAmount3,
        stakedAmount4,
        stakedAmount5
    ];

    ERC20 erc20;
    XERC20 xerc20;
    FeesManager feesManager;

    function setUp() public {
        string memory name = "Token A";
        string memory symbol = "TKNA";
        uint256 supply = 100000 ether;
        vm.startPrank(owner);
        xerc20 = new XERC20(
            string.concat("p", name),
            string.concat("p", symbol),
            address(0)
        );
        xerc20.setLimits(owner, supply, supply);
        xerc20.mint(user, 1 ether);

        feesManager = new FeesManager(0, nodes, stakedAmounts);
        vm.stopPrank();
    }

    function test_constructor_nodesAndStakedAmountsSetCorrectly() public view {
        uint16 epoch = 0;
        for (uint i = 0; i < nodes.length; i++) {
            assertEq(
                feesManager.stakedAmountByEpoch(epoch, nodes[i]),
                stakedAmounts[i]
            );
        }

        assertEq(feesManager.totalStakedAmountByEpoch(epoch), totalStaked);
    }

    function test_constructor_RevertWhen_nodesAndAmountsHaveDifferentLength()
        public
    {
        uint16 epoch = 0;
        uint256 lenX = 2;
        uint256 lenY = 1;
        address[] memory x = new address[](lenX);
        uint256[] memory y = new uint256[](lenY);
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(
                FeesManager.DifferentLength.selector,
                lenX,
                lenY
            )
        );
        new FeesManager(epoch, x, y);
    }

    function test_setFees_EmitFeesUpdatedEvent() public {
        uint256 minAmount = 0;
        uint16 basisPoints = 2000;
        vm.startPrank(owner);
        vm.expectEmit(address(feesManager));
        emit FeesManager.FeeUpdated(address(xerc20), minAmount, basisPoints);
        feesManager.setFee(address(xerc20), minAmount, basisPoints);

        (
            uint256 actualMinFee,
            uint16 actualBasisPoints,
            bool defined
        ) = feesManager.feeInfoByAsset(address(xerc20));
        IFeesManager.Fee memory expected = IFeesManager.Fee(
            minAmount,
            basisPoints,
            true
        );
        assertEq(actualMinFee, expected.minFee);
        assertEq(actualBasisPoints, expected.basisPoints);
        assertEq(defined, expected.defined);
        assertEq(defined, true);
        vm.stopPrank();
    }

    function test_setFees_RevertWhen_CallerIsNotOwner() public {
        vm.prank(evil);
        _expectOwnableUnauthorizedAccountRevert(evil);
        feesManager.setFee(address(xerc20), 0, 0);
    }

    function test_setFees_RevertWhen_settingFeesForAddressZero() public {
        vm.prank(owner);
        vm.expectRevert(FeesManager.InvalidToken.selector);
        feesManager.setFee(address(0), 0, 0);
    }

    function test_depositFeeForEpochFrom_RevertWhen_FromIsZeroAddress() public {
        vm.prank(user);
        vm.expectRevert(FeesManager.InvalidFromAddress.selector);
        feesManager.depositFeeForEpochFrom(
            address(0),
            address(xerc20),
            0.1 ether,
            0
        );
    }

    function _advanceEpoch() internal {
        vm.prank(owner);
        feesManager.registerAndAdvanceEpoch(nodes, stakedAmounts);
    }

    function test_depositFeeForEpochFrom_RevertWhen_epochIsNotTheCurrentOne()
        public
    {
        _advanceEpoch();
        vm.prank(user);
        vm.expectRevert(FeesManager.InvalidEpoch.selector);
        feesManager.depositFeeForEpochFrom(
            address(user),
            address(xerc20),
            0.1 ether,
            0
        );
    }

    function test_depositFeeForEpochFrom_RevertWhen_AssetNotDefined() public {
        address unsupportedAsset = vm.addr(666);
        vm.prank(user);
        vm.expectRevert(
            abi.encodeWithSelector(
                FeesManager.UnsupportedToken.selector,
                unsupportedAsset
            )
        );
        feesManager.depositFeeForEpochFrom(
            address(user),
            unsupportedAsset,
            0.1 ether,
            0
        );
    }

    function test_depositFeeForEpochFrom_emitTransferEvent() public {
        uint16 epoch = 0;
        uint256 fees = 0.1 ether;
        vm.prank(owner);
        feesManager.setFee(address(xerc20), 0, 0);

        uint256 userBalancePre = xerc20.balanceOf(user);
        vm.prank(user);
        xerc20.approve(address(feesManager), fees);

        vm.prank(address(xerc20));
        vm.expectEmit(address(xerc20));
        emit IERC20.Transfer(user, address(feesManager), fees);
        feesManager.depositFeeForEpochFrom(user, address(xerc20), fees, epoch);

        uint256 userBalancePost = xerc20.balanceOf(user);

        assertEq(userBalancePre - userBalancePost, fees);
        assertEq(xerc20.balanceOf(address(feesManager)), fees);
        assertEq(xerc20.balanceOf(address(feesManager)), fees);
        assertEq(
            feesManager.depositedAmountByEpoch(epoch, address(xerc20)),
            fees
        );

        vm.startPrank(user);
        xerc20.approve(address(feesManager), fees);
        feesManager.depositFee(address(xerc20), fees);

        assertEq(
            feesManager.depositedAmountByEpoch(epoch, address(xerc20)),
            fees * 2
        );
    }

    function testFuzz_calculateFee_returnTheCorrectFees(
        uint256 amount,
        uint256 minAmount,
        uint16 bp
    ) public {
        vm.prank(owner);
        xerc20.setLockbox(vm.addr(222));

        uint256 maxAmount = 1 ether;
        vm.assume(bp < 10000);
        vm.assume(bp >= 0);
        vm.assume(amount < maxAmount);
        vm.assume(amount >= 0);
        vm.assume(minAmount < maxAmount);
        vm.assume(minAmount >= 0);

        vm.prank(owner);
        feesManager.setFee(address(xerc20), minAmount, bp);

        uint256 actual = feesManager.calculateFee(address(xerc20), amount);
        uint256 fees = (amount * bp) / 1000000;
        uint256 expected = fees >= minAmount ? fees : minAmount;

        assertEq(actual, expected);
    }

    function test_claimFeeByEpoch_RevertWhen_tokenIsNotSupported() public {
        uint16 epoch = 0;
        vm.expectRevert(FeesManager.InvalidToken.selector);
        feesManager.claimFeeByEpoch(address(xerc20), epoch);
    }

    function test_claimFeeByEpoch_RevertWhen_currentEpochHasNotEnded() public {
        uint16 epoch = 0;
        vm.prank(owner);
        feesManager.setFee(address(xerc20), 0, 0);

        vm.expectRevert(FeesManager.TooEarly.selector);
        feesManager.claimFeeByEpoch(address(xerc20), epoch + 1);
    }

    function _depositFees(
        address xerc20_,
        uint256 fees,
        uint16 epoch
    ) internal {
        vm.prank(user);
        ERC20(xerc20_).approve(address(feesManager), fees);
        vm.prank(xerc20_);
        feesManager.depositFeeForEpochFrom(user, xerc20_, fees, epoch);
    }

    function test_claimFeeByEpoch_emitTransferEvent() public {
        uint16 epoch = 0;
        uint256 fees = 1 ether;

        vm.prank(owner);
        feesManager.setFee(address(xerc20), 0, 0);

        _depositFees(address(xerc20), fees, epoch);

        _advanceEpoch();

        for (uint i = 0; i < nodes.length; i++) {
            uint256 expectedClaimedFees = (fees * stakedAmounts[i]) /
                totalStaked;

            vm.prank(nodes[i]);
            vm.expectEmit(address(xerc20));
            emit IERC20.Transfer(
                address(feesManager),
                nodes[i],
                expectedClaimedFees
            );
            feesManager.claimFeeByEpoch(address(xerc20), epoch);

            assertEq(
                feesManager.claimedAmountByEpoch(
                    epoch,
                    address(xerc20),
                    nodes[i]
                ),
                expectedClaimedFees
            );
        }
    }

    function test_claimFeeByEpoch_RevertWhen_claimAlreadyMade() public {
        uint16 epoch = 0;
        uint256 fees = 1 ether;

        vm.prank(owner);
        feesManager.setFee(address(xerc20), 0, 0);

        _depositFees(address(xerc20), fees, epoch);

        _advanceEpoch();

        vm.startPrank(node0);
        feesManager.claimFeeByEpoch(address(xerc20), epoch);

        vm.expectRevert(FeesManager.AlreadyClaimed.selector);
        feesManager.claimFeeByEpoch(address(xerc20), epoch);
        vm.stopPrank();
    }

    function test_registerAndAdvanceEpoch_RevertWhen_callerIsNotTheOwner()
        public
    {
        vm.prank(evil);
        _expectOwnableUnauthorizedAccountRevert(evil);
        feesManager.registerAndAdvanceEpoch(nodes, stakedAmounts);
    }

    function test_registerAndAdvanceEpoch_RevertWhen_nodesAndAmountsHaveDifferentLength()
        public
    {
        uint256 lenX = 2;
        uint256 lenY = 1;
        address[] memory x = new address[](lenX);
        uint256[] memory y = new uint256[](lenY);
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(
                FeesManager.DifferentLength.selector,
                lenX,
                lenY
            )
        );

        feesManager.registerAndAdvanceEpoch(x, y);
    }

    function test_registerAndAdvanceEpoch_EmitNewEpochStartedEvent() public {
        address[] memory newNodes = new address[](3);
        uint256[] memory newStakedAmounts = new uint256[](3);

        newNodes[0] = node2;
        newNodes[1] = node4;
        newNodes[2] = node5;
        newStakedAmounts[0] = stakedAmount2;
        newStakedAmounts[1] = stakedAmount4;
        newStakedAmounts[2] = stakedAmount5;

        address[] memory nodesWithoutStaking = new address[](3);
        nodesWithoutStaking[0] = node0;
        nodesWithoutStaking[1] = node1;
        nodesWithoutStaking[2] = node3;

        uint256 newTotalStakedAmount = stakedAmount2 +
            stakedAmount4 +
            stakedAmount5;
        uint16 expectedEpoch = feesManager.currentEpoch() + 1;

        vm.prank(owner);
        vm.expectEmit(address(feesManager));
        emit FeesManager.NewEpochStarted(expectedEpoch);
        feesManager.registerAndAdvanceEpoch(newNodes, newStakedAmounts);

        assertEq(feesManager.currentEpoch(), expectedEpoch);

        for (uint i = 0; i < newNodes.length; i++) {
            assertEq(
                feesManager.stakedAmountByEpoch(expectedEpoch, newNodes[i]),
                newStakedAmounts[i]
            );
        }

        for (uint i = 0; i < nodesWithoutStaking.length; i++) {
            assertEq(
                feesManager.stakedAmountByEpoch(
                    expectedEpoch,
                    nodesWithoutStaking[i]
                ),
                0
            );
        }

        assertEq(
            feesManager.totalStakedAmountByEpoch(expectedEpoch),
            newTotalStakedAmount
        );
    }

    function test_setFeesManagerForXERC20_onlyFeesManagerCanChangeTheAddress()
        public
    {
        vm.expectEmit(address(xerc20));
        emit XERC20.FeesManagerChanged(address(feesManager));
        xerc20.setFeesManager(address(feesManager));

        vm.startPrank(owner);
        vm.expectRevert(XERC20.OnlyFeesManager.selector);
        xerc20.setFeesManager(address(0));

        address notAContract = vm.addr(2222);
        vm.expectRevert(
            abi.encodeWithSelector(XERC20.NotAContract.selector, notAContract)
        );
        feesManager.setFeesManagerForXERC20(address(xerc20), notAContract);

        uint16 epoch = 0;
        FeesManager newFeesManager = new FeesManager(
            epoch,
            nodes,
            stakedAmounts
        );
        vm.expectEmit(address(xerc20));
        emit XERC20.FeesManagerChanged(address(newFeesManager));
        feesManager.setFeesManagerForXERC20(
            address(xerc20),
            address(newFeesManager)
        );

        // Try to reset the original fees manager
        vm.expectRevert(XERC20.OnlyFeesManager.selector);
        feesManager.setFeesManagerForXERC20(
            address(xerc20),
            address(feesManager)
        );
    }

    function test_setFeesManagerForXERC20_RevertWhen_callerIsNotOwner() public {
        xerc20.setFeesManager(address(feesManager));

        vm.prank(evil);
        _expectOwnableUnauthorizedAccountRevert(evil);
        feesManager.setFeesManagerForXERC20(address(xerc20), address(0));
    }

    function test_calculateFee_feesMustBe0WhenXERC20IsNotLocal() public {
        vm.prank(owner);
        xerc20.setLockbox(address(0));

        assertEq(feesManager.calculateFee(address(xerc20), 1 ether), 0);
    }
}
