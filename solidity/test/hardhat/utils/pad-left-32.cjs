const hre = require('hardhat')

module.exports.padLeft32 = _value => {
  switch (typeof _value) {
    case 'string':
      return hre.ethers.zeroPadValue(_value, 32)
    case 'number':
      return hre.ethers.zeroPadValue(hre.ethers.toBeHex(_value), 32)
    default:
      throw new Error('Invalid value:', _value)
  }
}
