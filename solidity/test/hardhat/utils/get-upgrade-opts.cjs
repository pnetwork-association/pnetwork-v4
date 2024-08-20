module.exports.getUpgradeOpts = _owner => ({
  call: { fn: 'initializeV2(address)', args: [_owner.address] },
})
