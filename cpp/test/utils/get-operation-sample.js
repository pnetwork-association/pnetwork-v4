const R = require('ramda')
const { toBeHex, zeroPad, zeroPadValue, parseUnits } = require('ethers')
const { getSymbolCodeRaw } = require('./eos-ext')
const { no0x, utf8HexString } = require('./wharfkit-ext')

const getEvmPeginOperationSample = _injectedOperation =>
  R.mergeDeepLeft(_injectedOperation, {
    blockId: no0x(zeroPadValue('0x0e3595e678db71061a7fcba915f9ffc91f84cc0f5dee8e3cdfee83a68793d09b', 32)),
    txId: no0x(zeroPadValue('0xbe5c527a4c59a275b7493fab9984e26c445256dfbd328fcb928c6925baaf326c', 32)),
    nonce: 0,
    token: no0x(
      zeroPadValue(toBeHex('0xe58cBE144dD5556C84874deC1b3F2d0D6Ac45F1b'), 32),
    ),
    originChainId: no0x(
      zeroPadValue(
        '0x01',
        32,
      ),
    ), // ETH chain id
    destinationChainId: no0x(zeroPadValue('0xaca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906', 32)), // EOS chain id
    amount: parseUnits('25.87190615', 18).toString(),
    sender: no0x(zeroPadValue('0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266', 32)),
    recipient: 'eosrecipient',
    data: '',
  })

const getEvmPeginOperationSampleWithData = _injectedOperation =>
  R.mergeDeepLeft(_injectedOperation, {
    blockId: no0x(zeroPadValue('0x0a043735f42206d61a43d1b000c33e268f726469581eb2f19e8f56c2e8604890', 32)),
    txId: no0x(zeroPadValue('0x8c63a887ac3ac4f5e6cdafaf1c9af60b6cd2d1ba535c74f8dfdecb2af0028117', 32)),
    nonce: 0,
    token: no0x(
      zeroPadValue(toBeHex('0xe58cBE144dD5556C84874deC1b3F2d0D6Ac45F1b'), 32),
    ),
    originChainId: no0x(
      zeroPadValue(
        '0x01',
        32,
      ),
    ), // ETH chain id
    destinationChainId: no0x(zeroPadValue('0xaca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906', 32)), // EOS chain id
    amount: parseUnits('0.099924825', 18).toString(),
    sender: no0x(zeroPadValue('0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266', 32)),
    recipient: 'eosrecipient',
    data: '12345abcdefc0de1337f',
  })

module.exports = {
  getEvmPeginOperationSample,
  getEvmPeginOperationSampleWithData,
}
