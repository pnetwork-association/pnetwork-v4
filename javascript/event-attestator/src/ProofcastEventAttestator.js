const crypto = require('crypto')
const {
  SigningKey,
  computeAddress,
  concat,
  zeroPadValue,
  toBeHex,
  sha256,
} = require('ethers')
const R = require('ramda')

const { Chains } = require('./Chains.js')
const { Protocols } = require('./Protocols.js')
const { Versions } = require('./Versions.js')

class ProofcastEventAttestator {
  constructor(
    { version, protocolId, chainId, privateKey } = {
      version: Versions.V1,
      protocolId: Protocols.Evm,
      chainId: Chains(Protocols.Evm).Goerli,
      privateKey: undefined,
    },
  ) {
    /// Context
    this.version = toBeHex(version)
    this.protocolId = toBeHex(protocolId)
    this.chainId = zeroPadValue(toBeHex(chainId), 32)
    /// Context

    this.privateKey = privateKey
      ? privateKey
      : crypto.randomBytes(32).toString('hex')

    this.signingKey = new SigningKey(Buffer.from(this.privateKey, 'hex'))
    this.publicKey = this.signingKey.publicKey
    this.address = computeAddress(this.publicKey)
  }

  formatEvmSignature = _signature => {
    return concat([_signature.r, _signature.s, toBeHex(_signature.v)])
  }

  formatEosSignature = _signature => {
    return concat([toBeHex(_signature.v), _signature.r, _signature.s])
  }

  getEosEventPayload(event) {
    const topics = [
      zeroPadValue(Buffer.from(event.action, 'utf-8'), 32),
      zeroPadValue('0x00', 32),
      zeroPadValue('0x00', 32),
      zeroPadValue('0x00', 32),
    ]
    return concat([
      zeroPadValue(Buffer.from(event.account, 'utf-8'), 32),
      ...topics,
      Buffer.from(JSON.stringify(event.data), 'utf-8'),
    ])
  }

  getEvmEventPayload(event) {
    // EVM event support only: for other chains may be
    // required to change logic based on version and protocolID
    const topics = [0, 1, 2, 3].map(
      i => event.topics[i] || zeroPadValue('0x00', 32),
    )

    return concat([zeroPadValue(event.address, 32), ...topics, event.data])
  }

  isEvmEvent(event) {
    return R.has('address', event)
  }

  isEosEvent(event) {
    return R.has('account', event)
  }

  getEventPayload(event) {
    if (this.isEosEvent(event)) {
      return this.getEosEventPayload(event)
    } else if (this.isEvmEvent(event)) {
      return this.getEvmEventPayload(event)
    } else {
      throw new Error('Unsupported event')
    }
  }

  getEventContext() {
    return concat([this.version, this.protocolId, this.chainId])
  }

  _0x(_str) {
    return '0x' + _str.replace('0x', '')
  }

  getEventPreImage(event) {
    return concat([
      this.getEventContext(),
      this._0x(event.blockHash),
      this._0x(event.transactionHash),
      this.getEventPayload(event),
    ])
  }

  getEventId(event) {
    return sha256(this.getEventPreImage(event))
  }

  signBytes(bytes) {
    const digest = sha256(bytes)

    return this.signingKey.sign(digest)
  }

  sign(event) {
    const commitment = this.getEventId(event)

    return this.signingKey.sign(commitment)
  }
}

module.exports = {
  ProofcastEventAttestator,
}
