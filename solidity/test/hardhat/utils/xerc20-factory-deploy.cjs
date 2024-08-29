const R = require('ramda')

const factoryDeploy = (_hre, _factory, _methodName, _args = []) =>
  _factory[_methodName](..._args)
    .then(_tx => _tx.wait(0))
    .then(R.prop('logs'))
    .then(R.filter(R.is(_hre.ethers.EventLog)))
    .then(R.prop(0))
    .then(R.prop('args'))
    .then(R.prop(0))

const deployXERC20 = (_hre, _factory, _name, _symbol) =>
  factoryDeploy(_hre, _factory, 'deployXERC20', [
    _name,
    _symbol,
    [],
    [],
    [],
  ]).then(_address => _hre.ethers.getContractAt('XERC20', _address))

const deployXERC20Lockbox = (_hre, _factory, _xerc20, _erc20, _isNative) =>
  factoryDeploy(_hre, _factory, 'deployLockbox', [
    _xerc20,
    _erc20,
    _isNative,
  ]).then(_address => _hre.ethers.getContractAt('XERC20Lockbox', _address))

module.exports = {
  deployXERC20,
  deployXERC20Lockbox,
}
