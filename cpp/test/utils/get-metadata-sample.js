const R = require('ramda')

const getMetadataSample = _injectedMetadata =>
  R.mergeLeft(_injectedMetadata, {
    preimage: '',
    signature: '',
  })

module.exports = {
  getMetadataSample,
}
