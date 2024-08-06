module.exports.deploy = (_hre, _factory, _args = []) =>
  _hre.ethers.getContractFactory(_factory).then(_factory =>
    _factory.deploy(..._args, {
      // Fix an unsufficient maxFeePerGas value
      // on the fork environment tests
      maxFeePerGas: process.env.FORK ? 5000000000 : undefined,
    }),
  )
