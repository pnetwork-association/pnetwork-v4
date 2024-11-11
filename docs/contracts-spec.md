## Contracts specification

Regardless of the language being used, each contract implements the same features and, wherever possible, the naming
conventions for the properties and the methods have been kept very similar if not the same.

Please note that few contracts may not be available on a specific chain's implementation (for instance the pToken contract on EOSIO)
since the given design of the underlying chain permitted to avoid implementing it.

The architecture has been kept modular and very contrained to one single purpose on the entire protocol.

For each contract all the methods and relevant properties are enlisted with a concise description along with some useful notes
that can make the reader understand the reasons behind the design choices.

When reading would worth keeping in mind the following definitions:

- origin chain: where any operation has been performed by the user-agent
- destination chain: where the bridged asset/message is destined to
- local chain: where the unwrapped asset is deployed
- native asset: the chain's currency
- freezing an asset: the asset can't be moved by the owner (this may be due to malicious activity detected)

And finally, it is assumed that the reader has prior knowledge of the xERC20 standard and how it works however we'll spend
few words describing the standard's components and how they relate to each other.

### Adapter

#### Purpose:

- Facilitates user/dApp interaction with the xERC20 token.
- It's the actual bridge that an xERC20 can support and sets the relative mint/burn limits
- Given a token and its wrapped representation, there is single Adapter contract that manages their wrapping/unwrapping
  operation
- In order for the protocol to work, there must be an Adapter on the origin chain and the destination chain of where the
  token is supposed to be bridge to/from.

#### Properties

- `erc20` or `token`: erc20 address or account (the token to be wrapped)
- `xerc20`: the wrapped representation of the underlying token
- `nonce`: keeps track of the number of operations the current adapter has processed
- `feesManager`: the account receiving the fees (fees are taken always when the swap operation is called)
- `pam`: the account used for authorizing the operation when calling settle
- `minFee`: the minimum amount of fees that will be taken
- `pastEvents`: the past event that have been processed (this is to prevent replay attacks)
- `isNative`: this flag marks if the erc20 token is the native currenct (i.e. ETH)

#### Methods

- `swap()`: initiate a cross chain transfer of an ERC20/xERC20 token to another chain. The event emitted includes an indexed nonce plus the event bytes including important information which are going to be verified upon authorization in the settle function.
- `settle()`: finalise the operation created by the swap event on the destination, it may result in an unwrap operation of the asset if the settlement is done on the home chain (where the lockbox contract has been deployed) or just a mint operation on the destination chain.

#### Notes:

- The approach taken here overcomes the need of a registry keeping tracks of assets pairs (see Connext's approach) deployed on each supported chain

### Lockbox

#### Purpose

- Store the collateral of the wrapped token

#### Properties

- `erc20` or `token`: erc20 address or account (the token to be wrapped)
- `xerc20`: the wrapped representation of the underlying token
- `isNative`: if the underlying token is the native asset (not such thing on EOSIO)

#### Methods

- `deposit()`: lock the ERC20 into the contract and mint the relative xERC20 amount to the caller
- `depositTo()`: lock the ERC20 and transfer the wrapped xERC20 to the specified account (only EVM)
- `withdraw()`: unlock the ERC20 from the contract and transfer them to the caller by burning the given xERC20
- `withdrawTo(): unlock the ERC20 from the contract and transfer them to the specified recipient by burning the given xERC20 (only EVM)

#### Notes

- Other than the method above there is the "native" version on the EVM implementation
- On EOSIO the deposit is kicked after a transfer to the contract, this is because a contract isn't allowed to move
  tokens on third party behalf

### XERC20

#### Purpose

- Represents the wrapped representation of an ERC20 (or a token on EOSIO)
- If the freezing capabilities are enabled, an priviledged account is able to freeze/unfreeze
  other accounts if a malicious activity has been detected (this feature has been requested by EOS Network Foundation)

#### Properties

- `FACTORY`: the factory contract(only EVM)
- `lockbox`: the lockbox contract reference
- `bridges`: a list of supported adapters and each relative minting/burning limit
- `freezingAddress`: an administrator account allowed to freeze another account owning the underlying xERC20
- `freezingEnabled`: a flag that disables/enables the freezing contract capabilities (when disabled the contract is 1:1 to the origin xERC20 implementation) (only EVM)
- `frozen`: a list of frozen addresses

#### Methods:

- `freezeAddress`: freeze the specified address (the address won't be able to send/receive the underlying xERC20)
- `unfreezeAddress`: unfreeze the specified address
- `withdrawFrozenAssets`: send the asset frozen to the specified recipient
- `setFreezingAddress`: set the priviledged address allowed to freeze/unfreeze assets
- `mint`: mint the xERC20 by checking the current daily minting limit set is satisfied
- `burn`: burn the xERC20 by checking the current daily minting limit set is satisfied
- `setLockbox`: the vault storing the collateral
- `mintingMaxLimitOf`: return the max minting limit for the given bridge
- `burningMaxLimitOf`: return the max burning limit for the given bridge
- `mintingCurrentLimitOf`: return the current minting limit based on the daily rate
- `burningCurrentLimitOf`: return the current burning limit based on the daily rate

#### Other xERC20 based contracts (only EVM)

The pToken based contracts placed in the EVM implementation are necessary for the upgrading the current pTokens
that needs to be supported by pNetwork v4. Each one of them implement the xERC20 standard without inheritance (meaning each
inerithed method found on the original xERC20 has to be implemented in place) this is to avoid the the upgradability clashes
that would have occurred otherwise.

The original pToken version are the following:

- **PToken:** First version of the PToken contract, which is not xERC20 based.
- **PTokenNoGSN:** First version of the PToken contract, which is not xERC20 based and does not include the Gas Station Network logic.

Follows the new xERC20 based version:

- **PTokenStorage:** Inherited by the `PTokenV2` contract in order to reflect the previous storage layout.
- **PTokenNoGSNStorage:** Inherited by the `XERC20PTokenNoGSNCompat` contract in order to reflect the previous storage layout.
- **XERC20PTokenCompat:** Newer version of the PToken contract which implements the xERC20 interface (the slightly changed version described above).
  All the parents contracts inherited by the pToken V1 version have been removed, in order to have a version free from any
  problems caused by the ERC777 standard. The newer version (V2) presents the same inheritance structure of the XERC20 standard
  with the exception of the `PTokenStorage` contract defined as a first entry in the list of parents which resembles the
  previous version storage layout.

Also, in order to not have duplicate storage locations for the same variable name (i.e. `_balance` of the v1 version plus
`_balance` of the parent `ERC20Upgradeable` contract), it was necessary to just implement the interfaces of the parent
contracts, hence why all the parents are all interfaces implemented in the V2 contract itself. All the implementation
has been mirrored from the official Openzeppelin v4.9.6 upgradeable contracts library.

- **XERC20PTokenNoGSNCompat:** Same as PTokenV2 but inheriting the `PTokenNoGSNStorage` contract storage layout.
