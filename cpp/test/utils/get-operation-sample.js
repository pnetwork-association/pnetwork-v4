const R = require('ramda')
const { toBeHex, zeroPadValue, parseUnits } = require('ethers')

const { no0x } = require('./bytes-utils')

const getOperationSample = _injectedOperation =>
  R.mergeDeepLeft(_injectedOperation, {
    blockId: '21d41bf94358b9252115aee1eb250ef5a644e7fae776b3de508aacda5f4c26fc',
    txId: '6be2de7375ad7c18fd5ca3ecc8b70e60c535750b042200070dc36f84175a16d6',
    nonce: 0,
    token: '0x000000000000000000000000e58cbe144dd5556c84874dec1b3f2d0d6ac45f1b',
    originChainId:
      '0000000000000000000000000000000000000000000000000000000000000001', // ETH chain id
    destinationChainId:
      'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906', // EOS chain id
    amount: '5889675000000000000',
    sender:
      '0x000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb92266',
    recipient: 'destinatieos',
    data: '',
  })

module.exports = {
  getOperationSample,
}
