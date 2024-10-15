# Scripts

Please enjoy these scripts facilitating the interaction with EOSIO chains.

## Premise:

If you like to add more scripts consider the following:

- Every scripts imports a set of constants defined into the `constants.sh` module
  so you may want to add your globals there

- In order to keep each script as small as possible, make new scripts doing just one thing

- What you put into the .env file will be set as a global value available every time you source
  the `constants.sh` module.

- Use the `cleanup.sh` to stop nodeos and clean up everything created during the testnet environment
  (i.e. eos wallets, keys, data).

## Common usage

- You need to spin up a local node, you can either do it with `start-nodeos.sh` or `start-testnet.sh`

* `start-testnet.sh` will boostrap also the protocol features, setting up a perfect local testing environment

* `start-nodeos.sh` is supposed to be used when `start-testnet.sh` has already been executed once and somehow the
  nodeos background process has stopped (maybe with `stop-nodeos.sh`)

This part will start a nodeos process on the background and from now on other scripts like `create-account.sh` can
work.

- Create wallets through the `create-wallet.sh` script, this will create a keypair and assign it to a wallet under
  the specified name.

**Note:** every time you create a new wallet a new keypair is generated, if you want to assign more keypairs to a single
wallet you'll need to it manually through nodeos.

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

## Add a new contract script

1. Copy `eosio.token.sh` script to the one you need (name the file as the contract's).

2. Adjust the function name (i.e. `eosio.token`)

3. Wire up each function call by changing the `get_json_params` function

4. Create a new function for each contract's action you want to support (i.e. `get_create_params`)
