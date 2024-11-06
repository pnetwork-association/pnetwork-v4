const { toBeHex, zeroPadValue, parseUnits } = require('ethers')
const { no0x } = require('../utils/bytes-utils')

const evmTopicZero =
  '66756e6473206172652073616675207361667520736166752073616675202e2e'
const evmAdapter =
  '000000000000000000000000bcf063a9eb18bc3c6eb005791c61801b7cb16fe4'

const evmOperationSamples = {
  pegin: {
    blockId: no0x(
      zeroPadValue(
        '0x7e21ba208ea2a072bad2d011dbc3a9f870c574a66203d84bde926fcf85756d78',
        32,
      ),
    ),
    txId: no0x(
      zeroPadValue(
        '0x2e3704b180feda25af9dfe50793e292fd99d644aa505c3d170fa69407091dbd3',
        32,
      ),
    ),
    nonce: 0,
    token: no0x(
      zeroPadValue(toBeHex('0x810090f35dfa6b18b5eb59d298e2a2443a2811e2'), 32),
    ),
    originChainId: no0x(zeroPadValue('0x01', 32)), // EVM mainnet chain id
    destinationChainId: no0x(
      zeroPadValue(
        '0xaca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906',
        32,
      ),
    ), // EOS chain id
    amount: parseUnits('5.87190615', 18).toString(),
    sender: no0x(
      zeroPadValue('0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266', 32),
    ),
    recipient: 'eosrecipient',
    data: '',
  },
  peginWithUserData: {
    blockId: no0x(
      zeroPadValue(
        '0x8111e4e5e8ce115304d00d3947de97fb4ab73e0e3a3348cc86bae22d36f3572f',
        32,
      ),
    ),
    txId: no0x(
      zeroPadValue(
        '0xf48d3b1b5ffe7149db8edf667ffc90c5b0035ab143fb2031156a4326f1c00049',
        32,
      ),
    ),
    nonce: 1,
    token: no0x(
      zeroPadValue(toBeHex('0x810090f35DFA6B18b5EB59d298e2A2443a2811E2'), 32),
    ),
    originChainId: no0x(zeroPadValue('0x01', 32)), // ETH chain id
    destinationChainId: no0x(
      zeroPadValue(
        '0xaca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906',
        32,
      ),
    ), // EOS chain id
    amount: parseUnits('0.9974995655625', 18).toString(),
    sender: no0x(
      zeroPadValue('0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266', 32),
    ),
    recipient: 'eosrecipient',
    data: '12345abcdefc0de1337f',
  },
}

module.exports = {
  evmOperationSamples,
  evmTopicZero,
  evmAdapter,
}
