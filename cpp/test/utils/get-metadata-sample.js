const R = require('ramda')

const getMetadataSample = _injectedMetadata =>
  R.mergeDeepRight(_injectedMetadata, {
    preimage: '',
    signature: '',
  })

module.exports = {
  getMetadataSample,
}
