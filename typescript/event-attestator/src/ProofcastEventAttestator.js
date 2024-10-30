import crypto from 'crypto'
import { Event as EvmEvent, Signature } from 'ethers'
import {
  SigningKey,
  computeAddress,
  hexConcat,
  hexZeroPad,
  hexlify,
  sha256,
} from 'ethers/lib/utils.js'
import R from 'ramda'

import { Chains } from './Chains.js'
import { Protocols } from './Protocols.js'
import { Versions } from './Versions.js'

type Context = {
  version: number
  protocolId: number
  chainId: string
  privateKey: string | undefined
}

export type EosEvent = {
  blockHash: string
  transactionHash: string
  account: string
  action: string
  data: string
}

export type Event = EvmEvent | EosEvent

export class ProofcastEventAttestator {
  public version: string
  public protocolId: string
  public chainId: string
  public blockHash: string
  public txHash: string
  public address: string
  public publicKey: string
  public privateKey: string
  private signingKey: SigningKey

  constructor(
    { version, protocolId, chainId, privateKey }: Context = {
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

  private formatSignature = (_signature: Signature): string => {
    return hexConcat([_signature.r, _signature.s, hexlify(_signature.v)])
  }

  getEosEventPayload(event: EosEvent): string {
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

  getEvmEventPayload(event: EvmEvent): string {
    // EVM event support only: for other chains may be
    // required to change logic based on version and protocolID
    const topics = [0, 1, 2, 3].map(
      i => event.topics[i] || hexZeroPad('0x00', 32),
    )

    return hexConcat([hexZeroPad(event.address, 32), ...topics, event.data])
  }

  getEventPayload(event: Event): string {
    if (R.has('account', event)) {
      return this.getEosEventPayload(event as EosEvent)
    } else if (R.has('address', event)) {
      return this.getEvmEventPayload(event as EvmEvent)
    }
  }

  getEventContext(): string {
    return hexConcat([this.version, this.protocolId, this.chainId])
  }

  _0x(_str: string): string {
    return '0x' + _str.replace('0x', '')
  }

  getEventPreImage(event: Event): string {
    return hexConcat([
      this.getEventContext(),
      this._0x(event.blockHash),
      this._0x(event.transactionHash),
      this.getEventPayload(event),
    ])
  }

  getEventId(event: Event): string {
    return sha256(this.getEventPreImage(event))
  }

  signBytes(bytes: string): string {
    const digest = sha256(bytes)
    const signature = this.signingKey.signDigest(digest)

    return this.formatSignature(signature)
  }

  sign(event: Event): string {
    const commitment = this.getEventId(event)
    const signature = this.signingKey.signDigest(commitment)

    return this.formatSignature(signature)
  }
}
