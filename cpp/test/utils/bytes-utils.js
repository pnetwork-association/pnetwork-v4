const R = require('ramda')
const { zeroPadValue } = require('ethers')

const getXbytesHex = (hex, offset, byteNum) =>
  hex.slice(offset * 2, offset * 2 + byteNum * 2)

const hexToString = hex => {
  let str = ''
  for (let i = 0; i < hex.length; i += 2) {
    str += String.fromCharCode(parseInt(hex.substr(i, 2), 16))
  }
  return str
}

const replaceOrIdentity = (_regExp, _value, _x) => {
  try {
    return R.replace(_regExp, _value, _x)
  } catch (e) {
    return _x
  }
}

// If input is an object, then
// { k: '0x1111' }
//
// becomes
//
// { k: '1111'}
//
const no0x = _0xValue =>
  R.type(_0xValue) === 'Object'
    ? R.keys(_0xValue).reduce(
        (acc, elem) => ({
          ...acc,
          [elem]: replaceOrIdentity('0x', '', _0xValue[elem]),
        }),
        _0xValue,
      )
    : _0xValue.replace('0x', '')

const _0x = _value =>
  _value instanceof Buffer
    ? `0x${no0x(_value.toString('hex'))}`
    : `0x${no0x(_value)}`

const hexStringToBytes = _hex => Uint8Array.from(Buffer.from(no0x(_hex), 'hex'))

const removeNullChars = string => string.replace(/\u0000/g, '')

const bytes32 = _value => zeroPadValue(_0x(_value), 32)

module.exports = {
  _0x,
  no0x,
  bytes32,
  getXbytesHex,
  hexToString,
  hexStringToBytes,
  removeNullChars,
}
