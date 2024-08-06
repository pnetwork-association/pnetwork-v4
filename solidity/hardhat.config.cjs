/** @type import('hardhat/config').HardhatUserConfig */
require('dotenv').config()
require('@openzeppelin/hardhat-upgrades')
require('@nomicfoundation/hardhat-toolbox')
require('@nomicfoundation/hardhat-foundry')
require('@nomicfoundation/hardhat-network-helpers')
require('hardhat-gas-reporter')
require('solidity-coverage')
require('hardhat-tracer')

const getEnvironmentVariable = _envVar => process.env[_envVar] || ''

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
  // Set these within the .env file
  networks: {
    hardhat: {
      chains: {
        // Otherwise will not fork for BSC,
        // reference: https://hardhat.org/hardhat-network/docs/guides/forking-other-networks#using-a-custom-hardfork-history
        56: {
          hardforkHistory: {
            cancun: 40700000,
          },
        },
      },
    },
    ethFork: {
      url: getEnvironmentVariable('ETH_RPC_URL'),
    },
    bscFork: {
      url: getEnvironmentVariable('BSC_RPC_URL'),
    },
    bsc: {
      chainid: 56,
      url: getEnvironmentVariable('BSC_RPC_URL'),
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS || false,
  },
}

require('./tasks/index.cjs')
