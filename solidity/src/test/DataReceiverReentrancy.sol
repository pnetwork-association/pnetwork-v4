// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Adapter} from "../Adapter.sol";
import {IPAM} from "../interfaces/IPAM.sol";
import {IAdapter} from "../interfaces/IAdapter.sol";
import {IPReceiver} from "../interfaces/IPReceiver.sol";

contract DataReceiverReentrancy is IPReceiver {
    event DataReceived(bytes userdata);
    function receiveUserData(bytes calldata userdata) external {
        (
            IAdapter.Operation memory operation,
            IPAM.Metadata memory metadata
        ) = abi.decode(userdata, (IAdapter.Operation, IPAM.Metadata));

        Adapter(msg.sender).settle(operation, metadata);

        emit DataReceived(userdata);
    }
}
