import crypto from 'crypto'
import { Event, Signature } from 'ethers'
import { SigningKey, computeAddress } from 'ethers/lib/utils'
import { RlpEncode, RlpList } from 'rlp-stream'

import { Chains } from './Chains'
import { Protocols } from './Protocols'
import { Versions } from './Versions'

const sha256Digest = (_value: crypto.BinaryLike) => {
  const sha256 = crypto.createHash('sha256')
  sha256.update(_value)
  return sha256.digest()
}

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

const formatSignature = (_signature: Signature): string => {
  const r = fromHex(_signature.r)
  const s = fromHex(_signature.s)
  const v = Buffer.from([_signature.v])
  const signature = Buffer.concat([r, s, v], r.length + s.length + v.length)
  return '0x' + signature.toString('hex')
}

export class ProofcastEventAttestator {
  public version: Buffer
  public protocolId: Buffer
  public chainId: Buffer
  public blockHash: Buffer
  public txHash: Buffer
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
    this.version = Buffer.from([version])
    this.chainId = Buffer.from(chainId.toString(16).padStart(64, '0'), 'hex')
    this.protocolId = Buffer.from([protocolId])
    this.privateKey = privateKey
      ? privateKey
      : crypto.randomBytes(32).toString('hex')
    this.signingKey = new SigningKey(Buffer.from(this.privateKey, 'hex'))
    this.publicKey = this.signingKey.publicKey
    this.address = computeAddress(this.publicKey)
    this.blockHash = fromHex(blockHash)
    this.txHash = fromHex(txHash)
  }

  getEventId(): Buffer {
    const sha256 = crypto.createHash('sha256')
    sha256.update(this.version)
    sha256.update(this.protocolId)
    sha256.update(this.chainId)
    sha256.update(this.blockHash)
    sha256.update(this.txHash)

    return sha256.digest()
  }

  getStatementBytes(event: Event): Buffer {
    const address = fromHex(event.address)
    const data = fromHex(event.data)
    const topics: RlpList = event.topics.map(topic => fromHex(topic))
    const eventRLP: RlpList = [address, topics, data]
    const eventBytes = RlpEncode(eventRLP)

    const eventId = this.getEventId()
    const length =
      this.version.length +
      this.protocolId.length +
      this.chainId.length +
      eventId.length +
      eventBytes.length

    return Buffer.concat(
      [this.version, this.protocolId, this.chainId, eventId, eventBytes],
      length,
    )
  }

  getStatement(event: Event): string {
    return '0x' + this.getStatementBytes(event).toString('hex')
  }

  getCommitmentBytes(event: Event): Buffer {
    const statement = this.getStatementBytes(event)
    return sha256Digest(statement)
  }

  getCommitment(event: Event): string {
    return '0x' + this.getCommitmentBytes(event).toString('hex')
  }

  signBytes(bytes: Buffer): string {
    const digest = sha256Digest(bytes)
    const signature = this.signingKey.signDigest(digest)

    return formatSignature(signature)
  }

  sign(event: Event): string {
    const commitment = this.getCommitmentBytes(event)
    const signature = this.signingKey.signDigest(commitment)

    return formatSignature(signature)
  }
}
