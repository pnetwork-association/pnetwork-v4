// SPDX-License-Identifier: MIT

pragma solidity ^0.8.25;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract FeesManager is Ownable {
    using SafeERC20 for IERC20;

    /// @dev node =>token => balance
    mapping(address => mapping(address => uint256)) public allowances;

    event UnsufficientBalance(address token);
    event UnsufficientAllowance(address token);
    event AllowanceSet(address node, address token, uint256 amount);
    event AllowanceIncreased(address node, address token, uint256 amount);

    constructor(address securityCouncil) Ownable(securityCouncil) {}

    /**
     * @notice Increase the withdrawal allowance for the given node
     * in order to claim the accrued fees.
     * @param node    node for which the allowance will be increased
     * @param token   token for which the allowance will be increased
     * @param amount  amount of allowance to increase
     */
    function increaseAllowance(
        address node,
        address token,
        uint256 amount
    ) external onlyOwner {
        allowances[node][token] += amount;
        emit AllowanceIncreased(node, token, amount);
    }

    /**
     * @notice Set the withdrawal allowance for the given node
     * in order to claim the accrued fees.
     * @param node    node for which the allowance will be set
     * @param token   token for which the allowance will be set
     * @param amount  amount of allowance to set
     */
    function setAllowance(
        address node,
        address token,
        uint256 amount
    ) external onlyOwner {
        allowances[node][token] = amount;
        emit AllowanceSet(node, token, amount);
    }

    /**
     * @notice Withdraws the specified ERC20 token (or native currency if the zero address)
     * is given. The withdrawal will be performed only if the sender has sufficient
     * allowance otherwise it will revert.
     *
     * @param token  token to transfer
     */
    function withdraw(address token) external {
        withdrawTo(payable(msg.sender), token);
    }

    /**
     * @notice Withdraws the specified set of ERC20 tokens (including the native currency
     * if the zero address is included in the given set). The withdrawal will be performed
     * only if the sender has sufficient allowance otherwise it will revert.
     *
     * @param tokens  tokens to transfer to the specified address
     */
    function withdraw(address[] memory tokens) external {
        withdrawTo(payable(msg.sender), tokens);
    }

    /**
     * @notice Withdraws the specified ERC20 token or native currency if the zero address
     * is given. The withdrawal will be performed only if the sender has sufficient
     * allowance otherwise it will revert.
     *
     * @param to     address to sends the funds to
     * @param token  token to transfer
     */
    function withdrawTo(address payable to, address token) public {
        if (
            (token == address(0) && address(this).balance == 0) ||
            (token != address(0) && IERC20(token).balanceOf(address(this)) == 0)
        ) {
            emit UnsufficientBalance(token);
            return;
        }

        uint256 senderAllowance = allowances[msg.sender][token];
        if (senderAllowance == 0) {
            emit UnsufficientAllowance(token);
            return;
        }

        allowances[msg.sender][token] = 0;

        if (token == address(0)) {
            (bool success, ) = to.call{value: senderAllowance}("");
            require(success, "Failed to send Ether");
        } else {
            IERC20(token).transfer(to, senderAllowance);
        }
    }

    /**
     * @notice Withdraws the specified set of ERC20 tokens (including the native currency
     * if the zero address is included in the given set). The withdrawal will be performed
     * only if the sender has sufficient allowance otherwise it will revert.
     *
     * @param to      address to sends the funds to
     * @param tokens  tokens to transfer to the specified address
     */
    function withdrawTo(address payable to, address[] memory tokens) public {
        for (uint256 i = 0; i < tokens.length; ) {
            withdrawTo(to, tokens[i]);
            unchecked {
                ++i;
            }
        }
    }
}
