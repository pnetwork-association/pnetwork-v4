const R = require('ramda')
const { toBeHex, zeroPad, zeroPadValue, parseUnits } = require('ethers')
const { getSymbolCodeRaw } = require('./eos-ext')
const { no0x, utf8HexString } = require('./wharfkit-ext')

const getOperationSample = _injectedOperation =>
  R.mergeDeepRight(_injectedOperation, {
    blockId: no0x(zeroPadValue('0x00', 32)),
    txId: no0x(zeroPadValue('0x00', 32)),
    nonce: 0,
    token: no0x(
      zeroPadValue(toBeHex(getSymbolCodeRaw('0.0000 TKN').toString()), 32),
    ),
    originChainId: no0x(
      zeroPadValue(
        '0xaca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906',
        32,
      ),
    ), // EOS chain id
    destinationChainId: no0x(zeroPadValue('0x01', 32)), // ETH chain id
    amount: parseUnits('10', 18).toString(),
    sender: no0x(zeroPadValue(utf8HexString('user'), 32)),
    recipient: 'recipient',
    data: '',
  })

module.exports = {
  getOperationSample,
}
