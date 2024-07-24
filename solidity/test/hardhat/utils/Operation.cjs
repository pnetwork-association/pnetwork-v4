const { ethers } = require('hardhat')
const { padLeft32 } = require('./pad-left-32.cjs')

class Operation {
  constructor({ blockId, txId, originChainId, eventContent }) {
    this.blockId = blockId
    this.txId = txId
    let offset = 0
    this.nonce = ethers.toBigInt(
      ethers.getBytes(ethers.dataSlice(eventContent, 0, (offset += 32))),
    )
    this.erc20 = ethers.dataSlice(eventContent, offset, (offset += 32))
    this.originChainId = padLeft32(originChainId)
    this.destinationChainId = ethers.dataSlice(
      eventContent,
      offset,
      (offset += 32),
    )
    this.amount = ethers.toBigInt(
      ethers.getBytes(ethers.dataSlice(eventContent, offset, (offset += 32))),
    )
    this.sender = ethers.dataSlice(eventContent, offset, (offset += 32))
    const recipientLen = ethers.toNumber(
      ethers.getBytes(ethers.dataSlice(eventContent, offset, (offset += 32))),
    )
    this.recipient = Buffer.from(
      ethers
        .dataSlice(eventContent, offset, (offset += recipientLen))
        .replace('0x', ''),
      'hex',
    ).toString('utf-8')
    this.data = ethers.dataSlice(eventContent, offset)
  }

  serialize() {
    return [
      this.blockId,
      this.txId,
      this.nonce,
      this.erc20,
      this.originChainId,
      this.destinationChainId,
      this.amount,
      this.sender,
      this.recipient,
      this.data,
    ]
  }
}

module.exports = Operation
