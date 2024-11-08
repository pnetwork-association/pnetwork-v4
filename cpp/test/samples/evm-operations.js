const { toBeHex, zeroPadValue, parseUnits } = require('ethers')
const { no } = require('../utils/bytes-utils')

const evmTopicZero =
  '66756e6473206172652073616675207361667520736166752073616675202e2e'
const evmAdapter =
  '000000000000000000000000bcf063a9eb18bc3c6eb005791c61801b7cb16fe4'

const evmOperationSamples = {
  pegin: {
    blockId: '7e21ba208ea2a072bad2d011dbc3a9f870c574a66203d84bde926fcf85756d78',
    txId: '2e3704b180feda25af9dfe50793e292fd99d644aa505c3d170fa69407091dbd3',
    nonce: 0,
    token: '000000000000000000000000810090f35dfa6b18b5eb59d298e2a2443a2811e2',
    originChainId:
      '0000000000000000000000000000000000000000000000000000000000000001', // EVM mainnet chain id
    destinationChainId:
      'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906', // EOS chain id
    amount: '5871906150000000000',
    sender: '000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb92266',
    recipient: 'eosrecipient',
    data: '',
  },
  peginWithUserData: {
    blockId: '8111e4e5e8ce115304d00d3947de97fb4ab73e0e3a3348cc86bae22d36f3572f',
    txId: 'f48d3b1b5ffe7149db8edf667ffc90c5b0035ab143fb2031156a4326f1c00049',
    nonce: 1,
    token: '000000000000000000000000810090f35dfa6b18b5eb59d298e2a2443a2811e2',
    originChainId:
      '0000000000000000000000000000000000000000000000000000000000000001', // ETH chain id
    destinationChainId:
      'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906', // EOS chain id
    amount: '997499560000000000',
    sender: '000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb92266',
    recipient: 'eosrecipient',
    data: '12345abcdefc0de1337f',
  },
  peginLargePrecision: {
    blockId: '9c6d1358f426fe23fc7cf0e67aa422ff27c4e5ec7899297a10f036e6cf6643da',
    txId: '96d4d6885f072cb3f734d1b4add1d78d46487692cf9d912a6a91cfc6c65bc7d6',
    nonce: 0,
    token: '000000000000000000000000810090f35dfa6b18b5eb59d298e2a2443a2811e2',
    originChainId:
      '0000000000000000000000000000000000000000000000000000000000000001', // ETH chain id
    destinationChainId:
      'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906', // EOS chain id
    amount: '1189215224969292133',
    sender: '000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb92266',
    recipient: 'eosrecipient',
    data: '',
  },
}

module.exports = {
  evmOperationSamples,
  evmTopicZero,
  evmAdapter,
}
