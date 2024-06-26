/** @type import('hardhat/config').HardhatUserConfig */
require('@openzeppelin/hardhat-upgrades')
require('@nomicfoundation/hardhat-toolbox')
require('@nomicfoundation/hardhat-foundry')

module.exports = {
  solidity: {
    compilers: [
      { version: '0.4.18' },
      { version: '0.6.2' },
      { version: '0.8.25' },
    ],
  },
  paths: {
    sources: './src',
  },
}
