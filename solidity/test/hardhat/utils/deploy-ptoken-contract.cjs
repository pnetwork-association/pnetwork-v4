const R = require('ramda')
const { pollingInterval } = require('./openzeppelin-opts.cjs')

module.exports.deployPTokenContract = R.curry(
  (_hre, _name, _symbol, _defaultAmin, _originChainId) =>
    _hre.ethers.getContractFactory('pToken').then(_pToken =>
      _hre.upgrades.deployProxy(
        _pToken,
        [_name, _symbol, _defaultAmin, _originChainId],
        {
          initializer: 'initialize(string,string,address,bytes4)',
          pollingInterval,
        },
      ),
    ),
)
