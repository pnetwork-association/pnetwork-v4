// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

interface IOwnable {
    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );
    function owner() external returns (address);
    function renounceOwnership() external;
    function transferOwnership(address newOwner) external;
}
