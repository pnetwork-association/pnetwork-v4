const R = require('ramda')

module.exports.validateUpgrade = R.curry((_hre, _contractName, _proxy) =>
  _hre.ethers.getContractFactory(_contractName)
    .then(_contractFactory => _hre.upgrades.validateUpgrade(_proxy, _contractFactory))
    .catch(_err => Promise.reject(_err))

)
