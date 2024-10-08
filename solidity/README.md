# Solidity contracts

## Important notes:

### Crosschain tradeoffs

- Recipient of the tokens are string, in order to manage other chains destinations
- The bytes32 type has been used on those entities (sender, chain ids) where there is no a standard representation crosschains. For instance on the EOS the sender can be an account name `'x.ptokens'`. As a general rule if the value is more than 32 bytes, w use the relative sha256 hash (this will be included into the pre-image when the signature of the event is generated).

### Fees

- Fees are taken when the asset is wrapped and unwrapped in order to not take them twice
- Consequently, fees are deposited to a contract called `FeesManager` which is supposed to be deployed on the home(local) chain only

## Contracts

### Adapter

Note: we use the name Adapter instead of Bridge in order to be consistent with the xERC20 standard jargon.
This component facilitates user/dApp interaction with the xERC20 token. It exposes two functions and relative variations depending on the asset being swapped (native or not native):

- swap(): initiate a cross chain transfer of an ERC20/xERC20 token to another chain. The event emitted includes an indexed nonce plus the event bytes including important information which are going to be verified upon authorization in the settle function.

- settle(): finalise the operation created by the swap event on the destination, it may result in an unwrap operation of the asset if the settlement is done on the home chain (where the lockbox contract has been deployed) or just a mint operation on the destination chain.

This is the actual component used to bridge asset crosschains and it will have the minting/burning limits set in the pTokenV2/XERC20 contract.

Note: the approach taken here requires an Adapter contract deployed for each pair of ERC20/pToken, this is to overcome the need of a registry keeping tracks of assets pairs (see Connext's approach) deployed on each supported chain.

### XERC20Lockbox

Vault where the collateral is being kept safe. Exposes the following functions and relative variations depending on the asset being deposited or withdrawn:

- deposit(): lock the ERC20 into the contract and mint the relative amount of XERC20 to msg.sender
- withdraw(): unlock the ERC20 from the contract and transfer them to the msg.sender

Other variations of the function handles when the asset in the native chain currency or if the asset is being deposited/withdrawn by a third party (`depositTo`/`withdrawTo`).

### XERC20

This reflect the XERC20 standard with modifications on the `_burnWithCaller` function, which
includes the logic to take the fees on the local chain. In addition the the adapter to PAM mapping has been added in order to give the token owner a way to change it.

### PToken

First version of the PToken contract, which is not xERC20 based.

### PTokenNoGSN

First version of the PToken contract, which is not xERC20 based and does not include the Gas Station Network logic.

### PTokenStorage

Inherited by the `PTokenV2` contract in order to reflect the previous storage layout.

### PTokenNoGSNStorage

Inherited by the `XERC20PTokenNoGSNCompat` contract in order to reflect the previous storage layout.

### XERC20PTokenCompat

Newer version of the PToken contract which implements the xERC20 interface (the slightly changed version described above).
All the parents contracts inherited by the pToken V1 version have been removed, in order to have a version free from any
problems caused by the ERC777 standard. The newer version (V2) presents the same inheritance structure of the XERC20 standard
with the exception of the `PTokenStorage` contract defined as a first entry in the list of parents which resembles the
previous version storage layout.

Also, in order to not have duplicate storage locations for the same variable name (i.e. `_balance` of the v1 version plus
`_balance` of the parent `ERC20Upgradeable` contract), it was necessary to just implement the interfaces of the parent
contracts, hence why all the parents are all interfaces implemented in the V2 contract itself. All the implementation
has been mirrored from the official Openzeppelin v4.9.6 upgradeable contracts library.

### XERC20PTokenNoGSNCompat

Same as PTokenV2 but inheriting the `PTokenNoGSNStorage` contract storage layout.

### Data flow diagram

In order to give a high level overview of the main flow, we provide the following diagrams:

![data-flow](../docs/imgs/data-flow-01.png)

### Authorization system overview

The authorization system is deployed off-chain and is composed of

- A light client running on the pertinent blockchain which scans each transaction for the events of interest
- A decoding layer, which algorithm depends on the origin chain where the event was emitted (i.e. `abi.decode` for EVM like chains)
- A logic which extracts the event bytes of interest (a concatenation of the token being swapped, the sender, recipinet etc...)
- A logic which signs a series of data:
  - context: where is defined the protocol id and the version of the current event format
  - block and transaction hash containing the event
  - the event bytes extracted after decoding the event

Please see the following diagram as a reference:

![auth-diagram](../docs/imgs/auth-01.png)

### Run the tests

Tests suites are divided into

- `hardhat/`: which includes units and forked environment tests
- `forge/`: which includes integration and e2e tests

In order to run them you need to have `yarn` installed and then run:

```
yarn install
yarn test
```

### Generate the coverage report

```
yarn coverage
```

To see each score, open the `lcov/index.html` file.
