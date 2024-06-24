import crypto from 'crypto'
import { Event, Signature } from 'ethers'
import {
  SigningKey,
  computeAddress,
  defaultAbiCoder,
  getAddress,
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
  blockHash: string | undefined
  txHash: string | undefined
  privateKey: string | undefined
}

const fromHex = (_str: string): Buffer => {
  return Buffer.from(_str.replace('0x', ''), 'hex')
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
    { version, protocolId, chainId, privateKey, blockHash, txHash }: Context = {
      version: Versions.V1,
      protocolId: Protocols.Evm,
      chainId: Chains.Goerli,
      privateKey: undefined,
      blockHash: undefined,
      txHash: undefined,
    },
  ) {
    /// Context
    this.version = hexlify(version)
    this.protocolId = hexlify(protocolId)
    this.chainId = hexZeroPad(hexlify(chainId), 32)
    /// Context
    this.blockHash = blockHash
    this.txHash = txHash

    this.privateKey = privateKey
      ? privateKey
      : crypto.randomBytes(32).toString('hex')

    this.signingKey = new SigningKey(Buffer.from(this.privateKey, 'hex'))
    this.publicKey = this.signingKey.publicKey
    this.address = computeAddress(this.publicKey)
  }

  private formatSignature = (_signature: Signature): string => {
    const r = fromHex(_signature.r)
    const s = fromHex(_signature.s)
    const v = Buffer.from([_signature.v])
    const signature = Buffer.concat([r, s, v], r.length + s.length + v.length)
    return '0x' + signature.toString('hex')
  }

  getEventBytes(event: Event): string {
    // EVM event support only: for other chains may be
    // required to change logic based on version and protocolID
    const eventSignature = event.topics[0]
    const eventNonce = event.topics[1]
    let [
      erc20,
      originChainId,
      destinationChainId,
      amount,
      sender,
      recipient,
      data,
    ] = defaultAbiCoder.decode(
      [
        'bytes32',
        'uint256',
        'uint256',
        'uint256',
        'address',
        'string',
        'bytes',
      ],
      event.data,
    )

    originChainId = hexZeroPad(hexlify(originChainId), 32)
    destinationChainId = hexZeroPad(hexlify(destinationChainId), 32)
    amount = hexZeroPad(hexlify(amount), 32)
    recipient = getAddress(recipient)

    const context = this.getEventContext()

    return hexConcat([
      context,
      this.blockHash,
      this.txHash,
      eventSignature,
      eventNonce,
      erc20,
      originChainId,
      destinationChainId,
      amount,
      sender,
      recipient,
      data,
    ])
  }

  getEventContext(): string {
    return hexConcat([this.version, this.protocolId, this.chainId])
  }

  getEventId(event: Event): string {
    return sha256(this.getEventBytes(event))
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
