module.exports.getUpgradeOpts = (_owner, _freezingEnabled = false) => ({
  call: {
    fn: 'initializeV2(address, bool)',
    args: [_owner.address, _freezingEnabled],
  },
})
