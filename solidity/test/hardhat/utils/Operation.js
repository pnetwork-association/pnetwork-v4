const { ethers } = require('hardhat')
const { padLeft32 } = require('./pad-left-32.js')

class Operation {
  constructor({
    blockId,
    txId,
    originChainId,
    nonce,
    erc20,
    destinationChainId,
    amount,
    sender,
    recipient,
    data,
  }) {
    this.blockId = blockId
    this.txId = txId
    this.nonce = nonce
    this.erc20 = erc20
    this.originChainId = padLeft32(originChainId)
    this.destinationChainId = destinationChainId
    this.amount = ethers.toBigInt(ethers.getBytes(amount))
    this.sender = sender
    this.recipient = recipient
    this.data = data
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
