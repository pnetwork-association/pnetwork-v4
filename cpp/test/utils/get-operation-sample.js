const R = require('ramda')
const { UInt128 } = require('@wharfkit/antelope')
const { toBeHex, concat, stripZerosLeft, parseEther } = require('ethers')
const { _0x, no0x, bytes32 } = require('./bytes-utils')
const { Protocols, Chains } = require('@pnetwork/event-attestator')
const { getSymbolCodeRaw } = require('./eos-ext')

const getOperationSample = _injectedOperation =>
  R.mergeDeepLeft(_injectedOperation, {
    blockId: '21d41bf94358b9252115aee1eb250ef5a644e7fae776b3de508aacda5f4c26fc',
    txId: '6be2de7375ad7c18fd5ca3ecc8b70e60c535750b042200070dc36f84175a16d6',
    nonce: 0,
    token: '0x000000000000000000000000e58cbe144dd5556c84874dec1b3f2d0d6ac45f1b',
    originChainId:
      '0000000000000000000000000000000000000000000000000000000000000001', // ETH chain id
    destinationChainId:
      'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906', // EOS chain id
    amount: '5889675000000000000',
    sender:
      '0x000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb92266',
    recipient: 'destinatieos',
    data: '',
  })

const isEosChain = _chainId =>
  R.values(Chains(Protocols.Eos)).includes(stripZerosLeft(_chainId))

const getOperation = _obj => {
  const defaultBlockId =
    '0x7e21ba208ea2a072bad2d011dbc3a9f870c574a66203d84bde926fcf85756d78'
  const defaultTxId =
    '0x2e3704b180feda25af9dfe50793e292fd99d644aa505c3d170fa69407091dbd3'
  const blockId = bytes32(_0x(_obj.blockId || defaultBlockId))
  const txId = bytes32(_0x(_obj.txId || defaultTxId))
  const nonce = _obj.nonce
  const originChainId = bytes32(_0x(_obj.originChainId))
  const token = isEosChain(_obj.originChainId)
    ? bytes32(toBeHex(_0x(String(getSymbolCodeRaw(_obj.token)))))
    : bytes32(_0x(_obj.token))
  const destinationChainId = bytes32(_0x(_obj.destinationChainId))

  const amount = UInt128.from(String(parseEther(String(_obj.amount))))

  const sender = isEosChain(_obj.originChainId)
    ? bytes32(_0x(Buffer.from(_obj.sender, 'utf-8').toString('hex')))
    : bytes32(_obj.sender)
  const recipient = _obj.recipient
  const data = _0x(_obj.data || '')

  return {
    blockId,
    txId,
    nonce,
    token,
    originChainId,
    destinationChainId,
    amount,
    sender,
    recipient,
    data,
  }
}

const serializeOperation = _operation => {
  const amount = bytes32(toBeHex(BigInt(_operation.amount.toString())))
  const recipientLen = bytes32(
    toBeHex(BigInt(no0x(_operation.recipient).length)),
  )

  const recipient = _0x(Buffer.from(_operation.recipient, 'utf-8'))

  return concat([
    bytes32(toBeHex(BigInt(_operation.nonce))),
    _operation.token,
    _operation.destinationChainId,
    amount,
    _operation.sender,
    recipientLen,
    recipient,
    _operation.data,
  ])
}

module.exports = {
  getOperation,
  getOperationSample,
  serializeOperation,
}
