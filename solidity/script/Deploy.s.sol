// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Script.sol";
import "../src/Adapter.sol";
import "../src/xerc20/XERC20.sol";
import "../src/XERC20Registry.sol";
import "../src/xerc20/XERC20Lockbox.sol";
import "../src/test/ERC20Test.sol";

contract Deploy is Script {
    function run() external {
        // uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast();
        string memory name = "Token A";
        string memory symbol = "TKN A";
        uint256 mintingLimit = 1 ether;
        uint256 burningLimit = 1 ether;
        address factory = address(0);

        ERC20Test erc20 = new ERC20Test(name, symbol, 1000 ether);
        XERC20 xerc20 = new XERC20(
            string.concat("p", name),
            string.concat("p", symbol),
            factory
        );
        XERC20Lockbox lockbox = new XERC20Lockbox(
            address(xerc20),
            address(erc20),
            false
        );
        Adapter adapter = new Adapter(address(xerc20), address(erc20));

        xerc20.setLockbox(address(lockbox));
        xerc20.setLimits(address(adapter), mintingLimit, burningLimit);

        vm.stopBroadcast();
    }
}
