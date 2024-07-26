// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IPReceiver} from "../interfaces/IPReceiver.sol";

contract DataReceiver is IPReceiver {
    event DataReceived(bytes userdata);
    function receiveUserData(bytes calldata userdata) external {
        emit DataReceived(userdata);
    }
}
