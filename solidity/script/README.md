## Scripts

Before running scripts, you need to setup the forge keystores for deployments/contract management:

```bash
cast wallet import testnet --interactive
```

Import the testnet and production private keys (they will be placed into `~/.foundry/keystores` by default).

Create an `.env` file like the following:

```bash
CHAIN=sepolia

SEPOLIA_RPC_URL=https://glory-rattish-sun.ethereum-sepolia.quiknode.pro/.../
ETHERSCAN_API_KEY=B7F...UURG

ETH_KEYSTORE_ACCOUNT=testnet
```

Then the testnet account will be used throughout the scripts execution if no others are specified.

### Run

First deployment:

```bash
source .env
forge script --chain sepolia --rpc-url $SEPOLIA_RPC_URL  script/Deploy.sol:Deploy --password <keystore-password> --broadcast
```
