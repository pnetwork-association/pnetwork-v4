module.exports.deploy = (_hre, _factory, _args = []) =>
  _hre.ethers
    .getContractFactory(_factory)
    .then(_factory => _factory.deploy(..._args))
