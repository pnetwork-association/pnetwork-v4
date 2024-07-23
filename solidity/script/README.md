## Scripts

Before running scripts, you need to setup the forge keystores for deployments/contract management:

```bash
cast wallet import testnet --interactive
```

Import the testnet and production private keys (they will be placed into `~/.foundry/keystores` by default).

Create an `.env` file like the following:

```bash
# This is used for Script.sh
RPC_URL=https://url-here.quicknode.io/
FORGE_KEYSTORE_PASSWORD=password

# This is used for foundry.toml
SEPOLIA_RPC_URL=https://url-here.quicknode.io/
ETHERSCAN_API_KEY=B7FH..G
ETH_KEYSTORE_ACCOUNT=testnet
```

Go into the `script` folder and then interact with the relevant contract like follows:

```
./XERC20Registry.sh 'grantRegistrarRole(address,address)' 0x2ebc8a27ece2203c9d413a5c655fac7fb7d83262 0xADA2de876567a06eD79b0B29ae6aB2e142129E51

./ERC20.sh 'approve(address,address,uint256)' 0xf6652f1db7a7b48d9a6c515ad759c0464e16559c 0x87415715056da7a5eb1a30e53c4f4d20b44db71d  100000000000000000 --broadcast

./XERC20Registry.sh 'registerPair(address,address,address)' 0x2ebc8a27ece2203c9d413a5c655fac7fb7d83262 0xf6652f1db7a7b48d9a6c515ad759c0464e16559c 0xab4142adBF12c4403012D413945Be641e12237b5 --broadcast

./Adapter.sh 'swap(address,address,uint256,uint256,string memory,bytes memory)' 0x87415715056da7a5eb1a30e53c4f4d20b44db71d 0xf6652f1db7a7b48d9a6c515ad759c0464e16559c 100000000000000000 56 "0xADA2de876567a06eD79b0B29ae6aB2e142129E51" "0x"  --broadcast
```

Check each `*.s.sol` contract to see the available scripts to run.

## Single contract deployment

```bash
forge create --chain sepolia --rpc-url "$RPC_URL" --password "$FORGE_KEYSTORE_PASSWORD" './src/xerc20/XERC20Lockbox.sol:XERC20Lockbox' --constructor-args  0xab4142adBF12c4403012D413945Be641e12237b5 0xf6652f1db7a7b48d9a6c515ad759c0464e16559c false
```

## Single contract verification

```bash
forge verify-contract --chain sepolia --rpc-url "$RPC_URL"  --guess-constructor-args 0xb9a85A932432B19c1959aa29Fb50DBc5957751AF
```
