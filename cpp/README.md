## XERC20 standard EOS implementation

### Requirements

- [Eosio CDT 4.1.0](https://github.com/AntelopeIO/cdt/releases/download/v4.1.0/cdt_4.1.0-1_amd64.deb)
- Make (`apt install -y build-essential`)

If you want to spin up a local testnet:

- [Spring v1.0.2](https://github.com/AntelopeIO/spring/releases/tag/v1.0.2)

### Spin up a local testnet and try it out

```bash
cd scripts
./start-testnet.sh

# Swap
./eosio.token.sh user@active transfer user adapter "1.0000 WRAM" "user,0x0000000000000000000000000000000000000000000000000000000000000001,0xeb10e80D99655B51E3a981E888a73D0B21e21A6C,0"
```

**Note:** check out the scripts' README for further infos.
