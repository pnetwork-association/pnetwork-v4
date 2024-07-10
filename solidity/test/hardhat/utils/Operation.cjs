const { pad32 } = require('./pad-left-32.cjs')

const hre = require('hardhat')

class Operation {
  const
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
    this.originChainId = pad32(originChainId)
    this.destinationChainId = destinationChainId
    this.amount = amount
    this.sender = hre.ethers.zeroPadValue(sender, 32)
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
