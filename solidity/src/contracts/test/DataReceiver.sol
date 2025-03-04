// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IPReceiver} from "../../interfaces/IPReceiver.sol";

contract DataReceiver is IPReceiver {
    event DataReceived(IPReceiver.UserData);

    function receiveUserData(IPReceiver.UserData memory userData) external {
        emit DataReceived(userData);
    }
}
