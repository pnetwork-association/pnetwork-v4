module.exports.getUpgradeOpts = (_owner, _useGSN) =>
  _useGSN === ''
    ? {}
    : { call: { fn: 'initializeV2(address)', args: [_owner.address] } }
