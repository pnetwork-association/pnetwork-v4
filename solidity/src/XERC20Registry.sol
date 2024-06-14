// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

// import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IXERC20} from "./interfaces/IXERC20.sol";
import {IXERC20Registry} from "./interfaces/IXERC20Registry.sol";
import {IXERC20Lockbox} from "./interfaces/IXERC20Lockbox.sol";

contract XERC20Registry is IXERC20Registry, AccessControl {
    struct Entry {
        bytes32 erc20; // sha256 of token utf-8 string if on different chains (i.e. EOS, algorand)
        address xerc20; // type compatible with the underlying chain (would be an account for EOS)
        bool isLocal; // true if this is the home chain (where the erc20 token has been created)
    }

    /**
     * @notice Maps ERC20 to XERC20, if registered
     * @dev You can access the corresponding Entry by
     * using the resulting xERC20 address
     */
    mapping(bytes32 => address) public erc20ToXERC20;
    /**
     * @notice Maps xERC20 to Entry, if registered
     */
    mapping(address => Entry) public xerc20ToEntry;

    /**
     * @notice Role allowed to register/deregister XERC20s
     * @dev Role: 0xd6b769dbdbf190871759edfb79bd17eda0005e1b8c3b6b3f5b480b5604ad5014
     */
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR");

    event XERC20Registered(bytes32 erc20, address xerc20, bool isLocal);
    event XERC20Deregistered(bytes32 erc20, address xerc20, bool isLocal);

    /**
     * @notice Initializer function
     */
    constructor() {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    modifier onlyRegistrar() {
        require(
            hasRole(REGISTRAR_ROLE, _msgSender()),
            "Caller is not a registrar"
        );
        _;
    }

    /**
     * @notice Adds an asset to the registry
     * @param erc20 Right-padded version of the ERC20 address or an hash if not local
     * @param xerc20 The address of the xERC20
     * @param isLocal If the underlying asset has been created on this blockchain
     *
     * @dev In order to support multiple chains, ERC20 could also be an hash of
     * a string (i.e. support EOS account, algorand addresses etc..)
     */
    function registerXERC20(
        bytes32 erc20,
        address xerc20,
        bool isLocal
    ) external onlyRegistrar {
        require(erc20ToXERC20[erc20] == address(0), "AlreadyRegistered");

        if (isLocal) {
            address lockbox = IXERC20(xerc20).lockbox();
            require(lockbox != address(0), "No lockbox found");
        }

        erc20ToXERC20[erc20] = xerc20;
        xerc20ToEntry[xerc20] = Entry(erc20, xerc20, isLocal);

        emit XERC20Registered(erc20, xerc20, isLocal);
    }

    /**
     * @notice Removes an asset from the registry
     * @param xerc20 The id of the registered asset
     */
    function deregisterXERC20(address xerc20) external onlyRegistrar {
        Entry memory e = xerc20ToEntry[xerc20];
        require(e.xerc20 != address(0), "NotRegistered");

        delete erc20ToXERC20[e.erc20];
        delete xerc20ToEntry[e.xerc20];

        emit XERC20Deregistered(e.erc20, e.xerc20, e.isLocal);
    }

    function getAssets(
        address xerc20
    ) public view returns (bytes32, address, bool) {
        Entry memory e = xerc20ToEntry[xerc20];

        require(
            e.xerc20 != address(0) && e.erc20 != bytes32(0),
            "Not registered"
        );

        return (e.erc20, e.xerc20, e.isLocal);
    }

    function getAssets(
        bytes32 erc20
    ) external view returns (bytes32, address, bool) {
        address xerc20 = erc20ToXERC20[erc20];
        Entry memory e = xerc20ToEntry[xerc20];

        require(
            e.xerc20 != address(0) && e.erc20 != bytes32(0),
            "Not registered"
        );

        return (e.erc20, e.xerc20, e.isLocal);
    }

    // /**
    //  * @notice Checks if a given asset is an xERC20
    //  * @param _XERC20 The address of the asset to look up
    //  */
    // function isXERC20(address _XERC20) public view returns (bool) {
    //     return XERC20ToID[_XERC20] != bytes32(0);
    // }

    // function _getLockbox(address _XERC20) private view returns (address) {
    //     bytes memory data = abi.encodeWithSelector(IXERC20.lockbox.selector, msg.sender);
    //     (bool success, ) = _XERC20.staticcall(data);
    //     if (success) return IXERC20(_XERC20).lockbox();
    //     return address(0);
    // }
}
