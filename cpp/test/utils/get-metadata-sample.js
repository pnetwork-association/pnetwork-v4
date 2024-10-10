const R = require('ramda')

const getMetadataSample = _injectedMetadata =>
  R.mergeDeepRight(_injectedMetadata, {
    preimage: '0101000000000000000000000000000000000000000000000000000000000000000121d41bf94358b9252115aee1eb250ef5a644e7fae776b3de508aacda5f4c26fc6be2de7375ad7c18fd5ca3ecc8b70e60c535750b042200070dc36f84175a16d6000000000000000000000000cc9676b9bf25ce45a3a5f88205239afddecf1bc79b706941b48091a1c675b439064f40b9d43c577d9c7134cce93179b9b0bf2a520000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000ce00000000000000000000000000000000000000000000000000000000000000000000000000000000000000003ca5269b5c54d4c807ca0df7eeb2cb7a5327e77daca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e90600000000000000000000000000000000000000000000000051bc5435297fb000000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb92266000000000000000000000000000000000000000000000000000000000000000e64657374696e6174696f6e656f73000000000000000000000000000000000000',
    signature: '2ef652ed4417037f4ecaee9144158af25123a2a98ca28772d234e4edbb61567f2f1a5d0cf43d0f079ff9d90d606b779fbd73489d2831349790da63f6f9b81e7a1c',
  })

module.exports = {
  getMetadataSample,
}