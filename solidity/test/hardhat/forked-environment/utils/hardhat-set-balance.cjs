module.exports.hardhatSetBalance = (_hre, _url, _address, _amount) =>
  _hre.network.provider.request({
    method: 'hardhat_setBalance',
    params: [_address, _amount],
  })
