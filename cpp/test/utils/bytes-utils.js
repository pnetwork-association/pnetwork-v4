const getXbytesHex = (hex, offset, byteNum) =>
  hex.slice(offset * 2, offset * 2 + byteNum * 2)

const hexToString = hex => {
  let str = ''
  for (let i = 0; i < hex.length; i += 2) {
    str += String.fromCharCode(parseInt(hex.substr(i, 2), 16))
  }
  return str
}

const no0x = _0xValue => _0xValue.replace('0x', '')

const hexStringToBytes = _hex => Uint8Array.from(Buffer.from(no0x(_hex), 'hex'))

const removeNullChars = string => string.replace(/\u0000/g, '')

module.exports = {
  no0x,
  getXbytesHex,
  hexToString,
  hexStringToBytes,
  removeNullChars,
}
