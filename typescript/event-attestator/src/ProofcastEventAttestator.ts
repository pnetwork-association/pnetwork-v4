import crypto from 'crypto'
import { Event, Signature } from 'ethers'
import {
  SigningKey,
  computeAddress,
  hexConcat,
  hexZeroPad,
  hexlify,
  sha256,
} from 'ethers/lib/utils.js'

import { Chains } from './Chains.js'
import { Protocols } from './Protocols.js'
import { Versions } from './Versions.js'

type Context = {
  version: number
  protocolId: number
  chainId: number
  privateKey: string | undefined
}

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
      chainId: Chains.Goerli,
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

  getEventBytes(event: Event): string {
    // EVM event support only: for other chains may be
    // required to change logic based on version and protocolID

    return hexConcat([
      hexZeroPad(event.address, 32),
      sha256(hexConcat(event.topics)),
      event.data,
    ])
  }

  getEventContext(): string {
    return hexConcat([this.version, this.protocolId, this.chainId])
  }

  getEventPreImage(event: Event): string {
    return hexConcat([
      this.getEventContext(),
      event.blockHash,
      event.transactionHash,
      this.getEventBytes(event),
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

  getMetadata(event: Event): string {
    return hexConcat([
      this.getEventContext(),
      this.getEventId(event),
      this.sign(event),
    ])
  }
}
