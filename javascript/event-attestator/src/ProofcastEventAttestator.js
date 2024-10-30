const crypto = require('crypto')
const { Event } = require('ethers')
const {
  SigningKey,
  computeAddress,
  hexConcat,
  hexZeroPad,
  hexlify,
  sha256,
} = require('ethers/lib/utils.js')
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
    this.version = hexlify(version)
    this.protocolId = hexlify(protocolId)
    this.chainId = hexZeroPad(hexlify(chainId), 32)
    /// Context

    this.privateKey = privateKey
      ? privateKey
      : crypto.randomBytes(32).toString('hex')

    this.signingKey = new SigningKey(Buffer.from(this.privateKey, 'hex'))
    this.publicKey = this.signingKey.publicKey
    this.address = computeAddress(this.publicKey)
  }

  formatEvmSignature = _signature => {
    return hexConcat([_signature.r, _signature.s, hexlify(_signature.v)])
  }

  formatEosSignature = _signature => {
    return hexConcat([hexlify(_signature.v), _signature.r, _signature.s])
  }

  getEosEventPayload(event) {
    const topics = [
      hexZeroPad(Buffer.from(event.action, 'utf-8'), 32),
      hexZeroPad('0x00', 32),
      hexZeroPad('0x00', 32),
      hexZeroPad('0x00', 32),
    ]
    return hexConcat([
      hexZeroPad(Buffer.from(event.account, 'utf-8'), 32),
      ...topics,
      event.data,
    ])
  }

  getEvmEventPayload(event) {
    // EVM event support only: for other chains may be
    // required to change logic based on version and protocolID
    const topics = [0, 1, 2, 3].map(
      i => event.topics[i] || hexZeroPad('0x00', 32),
    )

    return hexConcat([hexZeroPad(event.address, 32), ...topics, event.data])
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
    return hexConcat([this.version, this.protocolId, this.chainId])
  }

  _0x(_str) {
    return '0x' + _str.replace('0x', '')
  }

  getEventPreImage(event) {
    return hexConcat([
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
    const signature = this.signingKey.signDigest(digest)

    return this.formatEvmSignature(signature)
  }

  sign(event) {
    const commitment = this.getEventId(event)
    const signature = this.signingKey.signDigest(commitment)

    if (this.isEvmEvent(event)) {
      return this.formatEvmSignature(signature)
    } else if (this.isEosEvent(event)) {
      return this.formatEosSignature(signature)
    } else {
      throw new Error('Unsupported event')
    }
  }
}

module.exports = {
  ProofcastEventAttestator,
}
