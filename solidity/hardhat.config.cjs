/** @type import('hardhat/config').HardhatUserConfig */
require('@openzeppelin/hardhat-upgrades')
require('@nomicfoundation/hardhat-toolbox')
require('@nomicfoundation/hardhat-foundry')
require('@nomicfoundation/hardhat-network-helpers')
require('hardhat-tracer')

module.exports = {
  solidity: {
    compilers: [
      {
        version: '0.4.18',
        settings: {
          optimizer: {
            runs: 200,
            enabled: true,
          },
        },
      },
      { version: '0.5.3' },
      {
        version: '0.6.2',
        settings: {
          optimizer: {
            runs: 200,
            enabled: true,
          },
        },
      },
      { version: '0.8.25' },
    ],
  },
  paths: {
    sources: './src',
  },
}
