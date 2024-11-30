# Deploy pnetwork v4

## Deploy on Antelope chains
In order to deploy an xtoken on an Antelope chain two requirements must be fulfilled:
- prepare all the contract and the necessary resources
- configure a `.env` configuration file


##### Contracts
```
OWNER_NAME=<name> # token owner name
XTOKEN_NAME=<name>
ADAPTER_NAME=<name>
LOCKBOX_NAME=<name> # only if xtoken is local
FEESMANAGER_NAME=<name>
```

##### .env
The `.env` config file looks like:
```
NODEOSURL=<rpc url of the targeted chain>
OWNER_NAME=
OWNER_PK_O=
OWNER_PK_A=
USER_NAME=
USER_PK_O=
USER_PK_A=
XTOKEN_NAME=
XTOKEN_PK_O=
XTOKEN_PK_A=
ADAPTER_NAME=
ADAPTER_PK_O=
ADAPTER_PK_A=
LOCKBOX_NAME=pnetworkloc2
LOCKBOX_PK_O=
LOCKBOX_PK_A=
FEESMANAGER_NAME=pnetworkfee2
FEESMANAGER_PK_O=
FEESMANAGER_PK_A=

TST_TKN=<underlying token pk>

IS_LOCAL= # if the underlying token belongs to the targeted network

## token
UNDERLYING_NAME=<token contract name>
UNDERLYING_SYMBOL=<token contract symbol>
SYMBOL_BYTES=<token contract name in bytes padded to the left to 32 bytes>
MAX_SUPPLY=<xtoken max supply>
BURN_LIMIT=
MINT_LIMIT=
MIN_FEE=
```

The path for the `.env` in relation to this repo is `./cpp/.env` 

##### call deploy script
Once all of the previous steps are completed run:

```
./deploy-xtoken.sh
```

##### configure the deployment
In order to be able to settle swaps coming from other chains some tables need to be configured.

*setOrigin*
```
cleos -u <chain-rpc-url> push action <adapter_contract_name> setorigin '["<bytes32_origin_chainId>","<bytes32_origin_emitter>","<bytes32_origin_topic0>"]' --permission <adapter_contract_name>@active
```

`bytes32_origin_topic0` changes depending on the origin chain protocolId:
- Antelope netowork: `0000000000000000000000000000000000000000000000000000000073776170` 
- EVM network: `66756e6473206172652073616675207361667520736166752073616675202e2e`

*setChainId*
```
cleos -u <chain-rpc-url> push action <adapter_contract_name> setchainid '["<current_chain_chainID>"]' --permission <adapter_contract_name>@active
```
In Antelope networks it is not possible to get the current chainId directly form a contract on-chain. It is therefore necessary setting it up through a configuration command:
`current_chain_chainID` is the chainId of the chain on which the current deployment has been run.

*settee*
```
cleos -u <chain-rpc-url> push action <adapter_contract_name> settee '["<tee_publicKey>","<tee_attestation>"]' --permission <adapter_contract_name>@active
```
This command is necessary to set a tee public key.
At the first call the key will be set immideately. From the second onwards a 48 hours cooldown period is applyied.

## Deploy on EVM chains

In order to deploy an xtoken on a EVM chain it is necessary to have:
- a deployment account with sufficient funds for the deploy
- a token to be used as underlying

```
./Deploy.sh 'run(address,bytes32,string,string,bool,bool,bool)' 0xC24e5C634684aC1c9C45C7001d8e20A889972D40 0000000000000000000000000000000000000000656f73747374746f6b656e31 eoststtoken1 TSTA false false true
```

##### Add deploy account to forge wallet

follow forge instruction to add the deploy token to the local forge wallet.

Use a `.env` to be located int `./solidity/.env` to add the forge wallet account and password:
```
FORGE_ACCOUNT=<forge accout>
FORGE_KEYSTORE_PASSWORD=<>'password'>
```
##### Configure the .env

Use the same `.env` file as before to add a rpc_url for the target chain and the signer publick key and attestation:
```
CHAIN_NAME=XXX
XXX_RPC_URL=<xxx rpc url>
DEPLOY_SIGNER_PUB_KEY=<attestator public key>
DEPLOY_SIGNER_ATTESTAT=<attestation>
```

##### Deploy the contract
Use `./Deploy.sh` in `./solidity/scripts` to deploy the first xtoken:

```
./Deploy.sh 'run(bytes32,string,string,bool,bool,bool)' <bytes32 underlying token address or name> <string underlying token address or name> <symbol of underlying token address or name> <isLocal?> <isNative?> <canFreeze?>
```

where 
- `isLocal` is `true` if the underlying token belongs to the current chain
- `isNative` is `true` if the underlying token is a native currency of the chain where it belongs (.ex ETH, BNB, MATIC etc)
- `canFreeze` is used to enable the freezing ability of the protocol

Important -> this is valid only for the first deployment in the target chain. From the second on the command to use is:
```
./Deploy.sh 'run(address,bytes32,string,string,bool,bool,bool)' <XERC20Factory address> <bytes32 underlying token address or name> <string underlying token address or name> <symbol of underlying token address or name> <isLocal?> <isNative?> <canFreeze?>
```
where the factory address contract has been deployed with the first token deployement on the target chain.

##### Configure the deployment

It is necessary to configure the newly deployed contracts in order to be able to settle a swap coming from another chain.

*setEmitter*
```
./PAM.sh 'setEmitter(address,uint256,bytes32)' <PAM address> <chain ID of the chain where the emitter is deployed> <emitter address or name in bytes32 format> --broadcast
```
the emitter is basically the adapter from which we expect a swap coming from a specific chain (which chainId is the second argument of the script)
This script MUST be called for each chain from which a swap can be expected.

*setTopicZero*
```
./PAM.sh 'setTopicZero(address,uint256,bytes32)' <PAM address> <chain ID of the chain where the emitter is deployed> <expected topic zero> --broadcast
setTopicZero sets the topic0 expected for each supported chain. For EOS chain it is a bytes32 representation of the string `swap` -> `0x0000000000000000000000000000000000000000000000000000000073776170`
```

It is also possible to update the tee signer (attestator) public key with a cool down period of 48 hours (this is not necessary, just a feature that can be used in case the tee is changed)

*setTeeSigner*
```
./PAM.sh 'setTeeSigner(address,bytes,bytes)' <PAM address> <new signer public key> <new signer attestation> --broadcast
```
The key can be actually applied only 48 hours after this command is called.

## Example: round trip between jungle4 and sepolia

In this example we deploy the pnetwork v4 bridge for a token native on jungle4 EOS testnet.
The token is
```
name=eoststtoken1
symbol=TSTA
```
issued by `pnetworkown2` which is also considered the owner of the bridge.
An amount of `100.0000 TSTA` has been made available to `pnetworkusr2` which will be considered the user of the bridge.

The signer public key used is:
`0x04397db47d49685dfef7dd2d7da91c59a2551d6ea069f58d3e3318b70d34a0f3c7f39d5bd2a92b41f4eddd88caec85d74c39062f6e9abde9da7feef510a4c0b762`

Using `ether.js` and `wharfkit` it is possible to convert the previous key into a EOS compatible public key:
`PUB_K1_5KotHK1uRocaESqQaGZxzPbdprNumJpKUXpz66Mds8ScbtmzuW`


###### Deploy of XTSTA on Jungle4

First of all a `.env` configuration file is prepared:
```
NODEOSURL=https://jungle4.cryptolions.io:443

OWNER_NAME=pnetworkown2
USER_NAME=pnetworkusr2
XTOKEN_NAME=pnetworkxtk2
ADAPTER_NAME=pnetworkadp2
LOCKBOX_NAME=pnetworkloc2
FEESMANAGER_NAME=pnetworkfee2

UNDERLYING_NAME=eoststtoken1
UNDERLYING_SYMBOL=TSTA
SYMBOL_BYTES=0000000000000000000000000000000000000000656f73747374746f6b656e31
MAX_SUPPLY=500000000.0000
BURN_LIMIT=2000.0000
MINT_LIMIT=1500.0000
MIN_FEE=0.0000
```
then `./deploy-xtoken.sh` in `./cpp/scripts` is called and the bridge is deployed


###### Deploy of XTSTA on Sepolia

The deploy address on sepolia is `0xa41657bf225F8Ec7E2010C89c3F084172948264D`.
After the setup of forge wallet the deploy script is called:
```
./Deploy.sh 'run(bytes32,string,string,bool,bool,bool)' 0000000000000000000000000000000000000000656f73747374746f6b656e31 eoststtoken1 TSTA false false true --broadcast
```
The result is the deployment of:
```
XERC20Factory @ 0xC24e5C634684aC1c9C45C7001d8e20A889972D40
ERC20 @ 0x0000000000000000656F73747374746f6B656e31
PAM @ 0xe373ec78F0Ba460e0b44c65F23888C9e16bda426
XERC20 @ 0x3B20F655F610002E70a37db285BF5166BC9bc529
Lockbox @ 0x0000000000000000000000000000000000000000
FeesManager @ 0x052f636784b84A7203Bd1abDBa1eBa5eEB93848C
Adapter @ 0x52eaeF9cC5fFaF6729eBC8504A9d80440BEE9211
Owner: 0x1804c8AB1F12E6bbf3894d4083f33e07309d1f38
Chain id: 11155111
```


###### Configuration of XTSTA Adapter on Jungle4

The following commands are used to set chainId, emitter, topicZero and tee pubKey:
```
cleos -u https://jungle4.cryptolions.io:443 push action pnetworkadp2 setorigin '["0000000000000000000000000000000000000000000000000
000000000aa36a7","00000000000000000000000052eaeF9cC5fFaF6729eBC8504A9d80440BEE9211","66756e6473206172652073616675207361667520736166752073616675202e2e"]' --permission pnetworkadp2@active
```
```
cleos -u https://jungle4.cryptolions.io:443 push action pnetworkadp2 setchainid '["73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d"]' --permission pnetworkadp2@active
```
```
cleos -u https://jungle4.cryptolions.io:443 push action pnetworkadp2 settee '["PUB_K1_5KotHK1uRocaESqQaGZxzPbdprNumJpKUXpz66Mds8ScbtmzuW",""]' --permission pnetworkadp2@active
```


###### Configuration of XTSTA Adapter on Sepolia
The following commands are used to set chainId, emitter, topicZero (the tee has already been set on the deploy phase):
```
./PAM.sh 'setEmitter(address,uint256,bytes32)' 0xe373ec78F0Ba460e0b44c65F23888C9e16bda426 0x73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d 0x0000000000000000000000000000000000000000706e6574776f726b61647032 --broadcast
```
```
./PAM.sh 'setTopicZero(address,uint256,bytes32)' 0xe373ec78F0Ba460e0b44c65F23888C9e16bda426 0x73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d 0x0000000000000000000000000000000000000000000000000000000073776170 --broadcast
```

#### SWAP from jungle4 to Sepolia

In order to swap TSTA towards Sepolia it is simply needed to initiate a swap towards the jungle4 adapter:
```
cleos -u https://jungle4.cryptolions.io:443 push action eoststtoken1 transfer '["pnetworkown2", "pnetworkadp2", "1.0000 TSTA", "pnetworkown2,0000000000000000000000000000000000000000000000000000000000aa36a7,a41657bf225F8Ec7E2010C89c3F084172948264D,0"]' --permission pnetworkusr2@active
```
[JUNGLE4 SWAP onchain tx](https://jungle4.cryptolions.io/v2/explore/transaction/ce2dceaa55b5cb2e88d31d8e1334335268930c0c665362760a9c833083c5789d)

##### SETTLE in Sepolia

###### get signature and preimage
For this example `attestator.js` have been used to generate signature and preimage relative to the previously described public key:

```
./attestator.js eos-metadata --eos -b 0x0a4ef77ece31426591abdae2d7ac1931ecd355af21107455bb6d1273a8974933 -t 0xce2dceaa55b5cb2e88d31d8e1334335268930c0c665362760a9c833083c5789d -c 0x73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d pnetworkadp2 swap '{"event_bytes":"00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000656F73747374746F6B656E310000000000000000000000000000000000000000000000000000000000AA36A70000000000000000000000000000000000000000000000000DDAAC8F8F45C0000000000000000000000000000000000000000000706E6574776F726B75737232000000000000000000000000000000000000000000000000000000000000002A307861343136353762663232354638456337453230313043383963334630383431373239343832363444"}'
```

which returns:
```
preimage: 0x010273e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d0a4ef77ece31426591abdae2d7ac1931ecd355af21107455bb6d1273a8974933ce2dceaa55b5cb2e88d31d8e1334335268930c0c665362760a9c833083c5789d0000000000000000000000000000000000000000706e6574776f726b6164703200000000000000000000000000000000000000000000000000000000737761700000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000007b226576656e745f6279746573223a22303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303036353646373337343733373437343646364236353645333130303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030414133364137303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030304444414143384638463435433030303030303030303030303030303030303030303030303030303030303030303030303030303030303037303645363537343737364637323642373537333732333230303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303241333037383631333433313336333533373632363633323332333534363338343536333337343533323330333133303433333833393633333334363330333833343331333733323339333433383332333633343434227d
eventid: 0xd26f67df952d05e3a0e922cdb56dbd6061cebdf272d489f334f9ef15f1b377ac
signature: 0xa1bc2ddf739c5b2234ac795b287945ef717a516e299f313c59d68a32f36086fb6815e72d80e0b3a914bd4f4a2032677fec554bf3f1d7f7cc77a5be5236a185f11c
```

###### SETTLE

```
./Adapter.sh 'settle(address,tuple(bytes32,bytes32,uint256,bytes32,bytes32,bytes32,uint256,bytes32,address,bytes),tuple(bytes,bytes))' 0x52eaeF9cC5fFaF6729eBC8504A9d80440BEE9211 '(0x0a4ef77ece31426591abdae2d7ac1931ecd355af21107455bb6d1273a8974933,0xce2dceaa55b5cb2e88d31d8e1334335268930c0c665362760a9c833083c5789d,0,0x0000000000000000000000000000000000000000656f73747374746f6b656e31,0x73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d,0x0000000000000000000000000000000000000000000000000000000000aa36a7,998300000000000000,0x0000000000000000000000000000000000000000706e6574776f726b75737232,0xa41657bf225F8Ec7E2010C89c3F084172948264D,0x)' '(0x010273e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d0a4ef77ece31426591abdae2d7ac1931ecd355af21107455bb6d1273a8974933ce2dceaa55b5cb2e88d31d8e1334335268930c0c665362760a9c833083c5789d0000000000000000000000000000000000000000706e6574776f726b6164703200000000000000000000000000000000000000000000000000000000737761700000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000007b226576656e745f6279746573223a22303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303036353646373337343733373437343646364236353645333130303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030414133364137303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030304444414143384638463435433030303030303030303030303030303030303030303030303030303030303030303030303030303030303037303645363537343737364637323642373537333732333230303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303241333037383631333433313336333533373632363633323332333534363338343536333337343533323330333133303433333833393633333334363330333833343331333733323339333433383332333633343434227d,0xa1bc2ddf739c5b2234ac795b287945ef717a516e299f313c59d68a32f36086fb6815e72d80e0b3a914bd4f4a2032677fec554bf3f1d7f7cc77a5be5236a185f11c)'
```
[SEPOLIA SETTLE onchain tx](https://sepolia.etherscan.io/tx/0x33ba3db523be79937771e4958fc49713ce5433f9b8e7ca432da396b292208e73)


#### SWAP from Sepolia to jungle4

Approve the adapter in order to initiate the swap
```
./ERC20.sh 'approve(address,address,uint256)' 0x3B20F655F610002E70a37db285BF5166BC9bc529 0x52eaeF9cC5fFaF6729eBC8504A9d80440BEE9211 998300000000000000 --broadcast
```

```
./Adapter.sh 'swap(address,address,uint256,uint256,string memory,bytes memory)'  0x52eaeF9cC5fFaF6729eBC8504A9d80440BEE9211 0x3B20F655F610002E70a37db285BF5166BC9bc529 998300000000000000 0x73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d pnetworkusr2 0x --broadcast
```

[SEPOLIA SWAP onchain tx](https://sepolia.etherscan.io/tx/0x3dbfb9f01ba2ce3433c4a6a5e2a263f9b75b6d3219d9caf626585c73818f93c3)


##### SETTLE in Jungle4

###### get signature and preimage

Again the `eventattestator.js` is used for this example:
```
./attestator.js evm-metadata --evm -b 0xd3e61ca596185d6de60d24c73336cc3d1882b6a2d2881592f4fde64d85e37a56 -t 0x3dbfb9f01ba2ce3433c4a6a5e2a263f9b75b6d3219d9caf626585c73818f93c3 -c 0x0000000000000000000000000000000000000000000000000000000000aa36a7 0x52eaeF9cC5fFaF6729eBC8504A9d80440BEE9211 0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000656f73747374746f6b656e3173e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d0000000000000000000000000000000000000000000000000dd477a69abbd600000000000000000000000000a41657bf225f8ec7e2010c89c3f084172948264d000000000000000000000000000000000000000000000000000000000000000c706e6574776f726b75737232 0x66756e6473206172652073616675207361667520736166752073616675202e2e 0x0000000000000000000000000000000000000000000000000000000000000000
```

which returns:
```
preimage: 0x01010000000000000000000000000000000000000000000000000000000000aa36a7d3e61ca596185d6de60d24c73336cc3d1882b6a2d2881592f4fde64d85e37a563dbfb9f01ba2ce3433c4a6a5e2a263f9b75b6d3219d9caf626585c73818f93c300000000000000000000000052eaef9cc5ffaf6729ebc8504a9d80440bee921166756e6473206172652073616675207361667520736166752073616675202e2e00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000656f73747374746f6b656e3173e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d0000000000000000000000000000000000000000000000000dd477a69abbd600000000000000000000000000a41657bf225f8ec7e2010c89c3f084172948264d000000000000000000000000000000000000000000000000000000000000000c706e6574776f726b75737232
eventid: 0xaaa6d625ec46c9bf19d0b60067957b903a7b6253bd16166059d74a2daabc8fab
signature: 0xe9dd050b7b859edf4ca131b7773511150586d97b114692b520e26119d2af00942514a5893454c4ce003a3fd72b0ffdb6da4f3adab967491e0f4e5f5177cacbd31c
```

###### SETTLE

```
cleos -u https://jungle4.cryptolions.io:443 push action pnetworkadp2 settle '["pnetworkusr2",{ "blockId": "d3e61ca596185d6de60d24c73336cc3d1882b6a2d2881592f4fde64d85e37a56", "txId": "3dbfb9f01ba2ce3433c4a6a5e2a263f9b75b6d3219d9caf626585c73818f93c3", "nonce": 0, "token": "0000000000000000000000000000000000000000656f73747374746f6b656e31", "originChainId": "0000000000000000000000000000000000000000000000000000000000aa36a7", "destinationChainId": "73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d", "amount": "996552975000000000", "sender": "000000000000000000000000a41657bf225f8ec7e2010c89c3f084172948264d", "recipient": "pnetworkusr2", "data": "" },{ "preimage":"01010000000000000000000000000000000000000000000000000000000000aa36a7d3e61ca596185d6de60d24c73336cc3d1882b6a2d2881592f4fde64d85e37a563dbfb9f01ba2ce3433c4a6a5e2a263f9b75b6d3219d9caf626585c73818f93c300000000000000000000000052eaef9cc5ffaf6729ebc8504a9d80440bee921166756e6473206172652073616675207361667520736166752073616675202e2e00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000656f73747374746f6b656e3173e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d0000000000000000000000000000000000000000000000000dd477a69abbd600000000000000000000000000a41657bf225f8ec7e2010c89c3f084172948264d000000000000000000000000000000000000000000000000000000000000000c706e6574776f726b75737232", "signature": "1ce9dd050b7b859edf4ca131b7773511150586d97b114692b520e26119d2af00942514a5893454c4ce003a3fd72b0ffdb6da4f3adab967491e0f4e5f5177cacbd3"}]' --permission pnetworkusr2@active
```
[JUNGLE4 SETTLE onchain tx](https://jungle4.cryptolions.io/v2/explore/transaction/e682b079da56cf196b6a82ff65e019698089f1765dde6fa387d1da67e4a1a64a)