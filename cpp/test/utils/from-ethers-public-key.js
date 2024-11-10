const { no0x } = require('./bytes-utils')
const { PublicKey } = require('@wharfkit/antelope')

module.exports.fromEthersPublicKey = _compressed =>
  PublicKey.from({
    type: 'K1',
    compressed: Uint8Array.from(Buffer.from(no0x(_compressed), 'hex')),
  })
