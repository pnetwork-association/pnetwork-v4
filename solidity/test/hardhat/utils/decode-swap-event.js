const { ethers } = require('hardhat')

module.exports.decodeSwapEvent = swapLogData => {
  if (swapLogData.startsWith('0x')) swapLogData = swapLogData.slice(2)
  let offset = 0

  const nonce = BigInt(`0x${swapLogData.substring(offset, (offset += 64))}`)
  const erc20 = `0x${swapLogData.substring(offset, (offset += 64))}`
  const destinationChainId = `0x${swapLogData.substring(offset, (offset += 64))}`
  const amount = `0x${swapLogData.substring(offset, (offset += 64))}`
  const sender = `0x${swapLogData.substring(offset, (offset += 64))}`
  const recipientLen = Number(
    `0x${swapLogData.substring(offset, (offset += 64))}`,
  )
  const recipientBytes = `0x${swapLogData.substring(offset, (offset += recipientLen * 2))}`
  const recipient = ethers.toUtf8String(recipientBytes)
  const data = `0x${swapLogData.substring(offset)}`
  return {
    nonce,
    erc20,
    destinationChainId,
    amount,
    sender,
    recipient,
    data,
  }
}
