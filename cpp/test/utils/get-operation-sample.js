const R = require('ramda')
const { toBeHex, concat, stripZerosLeft } = require('ethers')
const { Asset, UInt128 } = require('@wharfkit/antelope')
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
  const blockId = bytes32(_0x(_obj.blockId))
  const txId = bytes32(_0x(_obj.txId))
  const nonce = _obj.nonce
  const originChainId = bytes32(_0x(_obj.originChainId))
  const token = isEosChain(_obj.originChainId)
    ? bytes32(toBeHex(getSymbolCodeRaw(_obj.token)))
    : bytes32(_0x(_obj.token))
  const destinationChainId = bytes32(_0x(_obj.destinationChainId))

  const amount = UInt128.from(_obj.amount.toString())

  const sender = isEosChain(_obj.originChainId)
    ? bytes32(_0x(Buffer.from(_obj.sender, 'utf-8').toString('hex')))
    : bytes32(_obj.sender)
  const recipient = _obj.recipient
  const data = _0x(_obj.data)

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
