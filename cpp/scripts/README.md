# Scripts

Please enjoy these scripts facilitating the interaction with EOSIO chains.

## Premises:

- Every scripts loads the `constants.sh` module where globals and .env variables
  common to every scripts are sourced

- What you put into the .env file will be set as a global value available every time you source
  the `constants.sh` module

- Advice: create small scripts doing just one single thing and reuse functions in the `utils.sh`
  module as much as possible

- Use the `cleanup.sh` to stop nodeos and clean up everything created during the testnet environment
  (i.e. eos wallets, keys, data).

- You may find few scripts useless since they just wrap around a simple eos command (i.e. `get-table.sh`), BUT
  they are not, because globals variables (like `--url`) is supposed to be automatically read from the .env file and placed
  to the correct position so you don't have to remember that :D

## Common usage

- If you need to spin up a local node, you can either do it with `start-nodeos.sh` or `start-testnet.sh`

* `start-testnet.sh` will boostrap also the protocol features, setting up few basic wallets & accounts, perfect for a
  ready-to-go local testing environment

* `start-nodeos.sh` is supposed to be used when `start-testnet.sh` has already been executed once and somehow the
  nodeos background process has been stopped (maybe with `stop-nodeos.sh`)

- Create wallets through the `create-wallet.sh` script, this will create a keypair and assign it to a wallet under
  the specified name.

**Note:** every time you create a new wallet a new keypair is generated, if you want to assign more keypairs to a single
wallet you'll need to it manually through `cleos`.

**Note:** if you add a new keypair to a wallet, `create-account.sh` may not work as expected as it would consider the public
key of the first pair generated when the wallet was created.

- Create an account through the `create-account.sh` script. This will create an account assigning the public key relative to
  the specified wallet.

**Example:**

```bash
# Create the account eosio.token with the owner public key (you need to create the owner first)
./create-account.sh eosio.token owner
```

- Use the `deploy.sh` script to deploy a contract to a specified account (check the help for more info on the usage).

- If you want to interact with a contract, check if the relative scripts `<contract-name>.sh` exists, if not you would need
  to create a new one.

## Add a new contract script

1. Copy `eosio.token.sh` script to the one you need (name the file as the contract's).

2. Adjust the function name (i.e. `eosio.token`)

3. Wire up each function call by changing the `get_json_params` function

4. Create a new function for each contract's action you want to support (i.e. `get_create_params`)

5. You are able to send actions to the contract (remember to deploy it first, check `deploy.sh`), then the usage is as follows:

```
./<contract-name>.sh [permission] <action> [params]
```

**Example:**

```bash
./eosio.token.sh create owner "100000.0000 WRAM"
```

## Check contract's tables

Easy peasy:

```bash
./get-table.sh eosio.token WRAM stat
```

## Troubleshooting

1. Can't create an account because

```
Error 3090003: Provided keys, permissions, and delays do not satisfy declared authorizations
Ensure that you have the related private keys inside your wallet and your wallet is unlocked.
Error Details:
transaction declares authority '{"actor":"eosio","permission":"active"}', but does not have signatures for it.
```

You need to unlock the `local` wallet which has the `eosio@active` permissions.

2. `3090003 unsatisfied_authorization: Provided keys, permissions, and delays do not satisfy declared authorizations`

Check the contract has the `eosio.code` permission as it's needed to execute inline actions

3. eosio::history_api_plugin can't be used, you will get

```
3060005 bad_database_version_exception: Database is an unknown or unsupported version
state database version pre-dates versioning, please restore from a compatible snapshot or replay
```

when starting nodeos.
