const { PublicKey } = require('@wharfkit/antelope')

module.exports.hexToPublicKey = _hex =>
  PublicKey.from({
    type: 'K1',
    compressed: Uint8Array.from(Buffer.from(_hex, 'hex')),
  })
