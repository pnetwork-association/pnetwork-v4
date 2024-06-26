const { pollingInterval } = require('./openzeppelin-opts.cjs')

module.exports.deployProxy = (_hre, _factoryName, _args = []) =>
  _hre.ethers.getContractFactory(_factoryName).then(_pToken =>
    _hre.upgrades.deployProxy(_pToken, _args, {
      initializer: 'initialize(string,string,address,bytes4)',
      pollingInterval,
    }),
  )
