module.exports.hardhatReset = (_hre, _url, _pinnedBlockNumber) =>
  _hre.network.provider.request({
    method: 'hardhat_reset',
    params: [
      {
        forking: {
          jsonRpcUrl: _url,
          blockNumber: _pinnedBlockNumber,
        },
      },
    ],
  })
