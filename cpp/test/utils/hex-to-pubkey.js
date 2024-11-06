const { PublicKey } = require('@wharfkit/antelope')
const { no0x } = require('./bytes-utils')

module.exports.hexToPublicKey = _hex =>
  PublicKey.from({
    type: 'K1',
    compressed: Uint8Array.from(Buffer.from(no0x(_hex), 'hex')),
  })
