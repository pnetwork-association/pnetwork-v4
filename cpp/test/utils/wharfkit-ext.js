const R = require('ramda')
const { Asset } = require('@wharfkit/antelope')
const assert = require('assert')

const assetOperation = R.curry((_fn, _op1, _op2) => {
  const op1 = _op1 instanceof Asset ? _op1 : Asset.from(_op1)
  const op2 = _op1 instanceof Asset ? _op2 : Asset.from(_op2)

  assert(
    Number(op1.symbol.value) === Number(op2.symbol.value),
    'Asset symbols do not match',
  )

  return Asset.from(_fn(op1.value, op2.value), op1.symbol)
})

const substract = assetOperation(R.subtract)

const sum = assetOperation(R.sum)

const multiply = assetOperation(R.multiply)

const divide = assetOperation(R.divide)

const no0x = _0xValue => _0xValue.replace('0x', '')

module.exports = {
  sum,
  no0x,
  divide,
  multiply,
  substract,
}
