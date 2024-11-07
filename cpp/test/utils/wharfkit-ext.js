const R = require('ramda')
const assert = require('assert')
const { no0x } = require('./bytes-utils')
const { Asset, PublicKey } = require('@wharfkit/antelope')

const assetOperation = R.curry((_fn, _op1, _op2) => {
  const op1 = _op1 instanceof Asset ? _op1 : Asset.from(_op1)
  const op2 = _op1 instanceof Asset ? _op2 : Asset.from(_op2)

  assert(
    Number(op1.symbol.value) === Number(op2.symbol.value),
    'Asset symbols do not match',
  )

  return Asset.from(
    _fn === R.sum ? _fn([op1.value, op2.value]) : _fn(op1.value)(op2.value),
    op1.symbol,
  )
})

const substract = assetOperation(R.subtract)

const sum = assetOperation(R.sum)

const multiply = assetOperation(R.multiply)

const divide = assetOperation(R.divide)

const utf8HexString = _str => '0x' + Buffer.from(_str, 'utf-8').toString('hex')

const fromEthersPublicKey = _compressed =>
  PublicKey.from({
    type: 'K1',
    compressed: Uint8Array.from(Buffer.from(no0x(_compressed), 'hex')),
  })

module.exports = {
  sum,
  divide,
  multiply,
  substract,
  utf8HexString,
  fromEthersPublicKey,
}
