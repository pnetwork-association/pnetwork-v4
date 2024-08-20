const { pollingInterval } = require('./openzeppelin-opts.cjs')

module.exports.upgradeProxy = (
  _hre,
  _proxy,
  _contractFactoryName,
  _opts = {},
  _admin,
) =>
  _hre.ethers
    .getContractFactory(_contractFactoryName, _admin)
    .then(_ethPNTv2 => _hre.upgrades.upgradeProxy(_proxy, _ethPNTv2, _opts))
