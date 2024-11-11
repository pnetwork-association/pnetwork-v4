## pNetwork Authorization System

The new architecture expects each **pNetwork node operator to run an off-chain system, called Event Attestator, that detects a swap event** from the originating chain
and **delivers a proof** related to the event emitted via an HTTP API.

The UI will be responsible for picking this data and submitting it to the pNetwork authorization module to finalise the swap on the destination chain.

## Event Attestator for tests

This is just a possible implementation of the event attestator compatible with the PAM (pNetwork Authorization Module) contract.

### Test

Please run

```
yarn install
yarn test
```

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

![auth-diagram](../../docs/imgs/auth-01.png)
