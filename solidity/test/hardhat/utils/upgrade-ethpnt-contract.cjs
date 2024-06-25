const { pollingInterval } = require('./openzeppelin-opts.cjs')

module.exports.upgradeEthPNTContract = (
  _hre,
  _proxyAddress,
  _contractFactoryName = 'EthPntv2',
  _owner = undefined,
) =>
  _hre.ethers.getContractFactory(_contractFactoryName, _owner).then(_ethPNTv2 =>
    _hre.upgrades.upgradeProxy(_proxyAddress, _ethPNTv2, {
      call: { fn: 'initializeV2()' },
      pollingInterval,
    }),
  )
