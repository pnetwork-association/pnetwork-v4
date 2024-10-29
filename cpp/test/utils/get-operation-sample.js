const R = require('ramda')
const { toBeHex, zeroPadValue, parseUnits } = require('ethers')

const { no0x } = require('./bytes-utils')

const getOperationSample = _injectedOperation =>
  R.mergeDeepRight(_injectedOperation, {
    blockId: no0x(
      zeroPadValue(
        '0x21d41bf94358b9252115aee1eb250ef5a644e7fae776b3de508aacda5f4c26fc',
        32,
      ),
    ),
    txId: no0x(
      zeroPadValue(
        '0x6be2de7375ad7c18fd5ca3ecc8b70e60c535750b042200070dc36f84175a16d6',
        32,
      ),
    ),
    nonce: 0,
    token: no0x(
      zeroPadValue(toBeHex('0xe58cBE144dD5556C84874deC1b3F2d0D6Ac45F1b'), 32),
    ),
    originChainId: no0x(zeroPadValue('0x01', 32)), // ETH chain id
    destinationChainId: no0x(
      zeroPadValue(
        '0xaca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906',
        32,
      ),
    ), // EOS chain id
    amount: parseUnits('5.889675', 18).toString(),
    // sender: no0x(zeroPadValue(utf8HexString('user'), 32)),
    sender: no0x(
      zeroPadValue('0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266', 32),
    ),
    recipient: 'destinatieos', //no0x(zeroPadValue('0xC0FFEE', 20)),
    data: '',
  })

module.exports = {
  getOperationSample,
}
