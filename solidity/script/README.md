## Scripts

Before running scripts, you need to setup the forge keystores for deployments/contract management:

```bash
cast wallet import testnet --interactive
```

Import the testnet and production private keys (they will be placed into `~/.foundry/keystores` by default).

Create an `.env` file like the following:

```bash
# This is used for Script.sh
FORGE_KEYSTORE_PASSWORD=password

# This is used for foundry.toml
SEPOLIA_RPC_URL=https://url-here.quicknode.io/
OTHER_CHAIN_RPC_URL=...
ETHERSCAN_API_KEY=B7FH..G
FORGE_ACCOUNT=testnet

CHAIN_NAME=sepolia
```

Go into the `script` folder and then interact with the relevant contract like follows:

```
./ERC20.sh 'approve(address,address,uint256)' 0xf6652f1db7a7b48d9a6c515ad759c0464e16559c 0x87415715056da7a5eb1a30e53c4f4d20b44db71d  100000000000000000 --broadcast

./Adapter.sh 'swap(address,address,uint256,uint256,string memory,bytes memory)' 0x87415715056da7a5eb1a30e53c4f4d20b44db71d 0xf6652f1db7a7b48d9a6c515ad759c0464e16559c 100000000000000000 56 "0xADA2de876567a06eD79b0B29ae6aB2e142129E51" "0x"  --broadcast
```

Check each `*.s.sol` contract to see the available scripts to run (i.e. each `external` function).

## Single contract deployment

```bash
forge create --chain sepolia --rpc-url "$RPC_URL" --password "$FORGE_KEYSTORE_PASSWORD" --account "$FORGE_ACCOUNT" './src/xerc20/XERC20Lockbox.sol:XERC20Lockbox' --constructor-args  0xab4142adBF12c4403012D413945Be641e12237b5 0xf6652f1db7a7b48d9a6c515ad759c0464e16559c false
```

## Single contract verification

**Note:** You may need to set the Etherscan api-key correctly in your `foundry.toml` file first.

```bash
forge verify-contract --chain sepolia --rpc-url "$RPC_URL"  --guess-constructor-args 0xb9a85A932432B19c1959aa29Fb50DBc5957751AF
```

## One-go deploy

Use the `Deploy.sh` script in order to deploy all the required contract with a default setup on the chain of interest.

1. Prepare the .env file

```env
# This is used for Script.sh
FORGE_ACCOUNT=<account>
FORGE_KEYSTORE_PASSWORD=<password>

CHAIN_NAME=bsc # One of the following RPC_URL will be selected based on this value here, in this case the deploy will be performed on bsc

SEPOLIA_RPC_URL=<sepolia-url>
MAINNET_RPC_URL=<mainnet-url>
BSC_RPC_URL=<bsc-url>

DEPLOY_SIGNER_PUB_KEY=<pam-signer-pub-key>
DEPLOY_SIGNER_ATTESTATION=<pam-signer-attestation>
```

2. Deploy the ERC20 contract if not available (usually on a test environment):

```bash
./ERC20.sh 'deploy(string,string,uint256)' <erc20-name> <erc20-symbol> 100000000000000000000
```

**Note:** the above just run a local simulation, if you want to broadcast everything on chain, append the `--broadcast` option.
Same logic applies for the following commands.

3. Run the script like following (NOTE: you may want to customize it properly when executing it for a production deployment):

```bash
# On the origin chain
./Deploy.sh 'run(address,string,string,bool)' <erc20-address> <erc20-name> <erc20-symbol> true

# Swich chain on the .env file

# On the host chain
./Deploy.sh 'run(address,string,string,bool)' <erc20-address> <erc20-name> <erc20-symbol> false
```

4. Set the emitter address on the PAMs for both chains:

```bash
# Origin chain
./PAM.sh 'setEmitter(address,uint256,address)' <origin-pam-address> <host-chain-id> <host-emitter-address>

# Switch chain on the .env file

# Host chain
./PAM.sh 'setEmitter(address,uint256,address)' <origin-pam-address> <origin-chain-id> <origin-emitter-address>
```
