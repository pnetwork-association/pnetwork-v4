const R = require('ramda')

const getXbytesHex = (hex, offset, byteNum) => hex.slice(offset * 2, offset * 2 + byteNum * 2)

const getEventBytes = _contract => {
  const re = /adapter_swap_event_bytes:[a-fA-F0-9]+/
  const match = re.exec(_contract.bc.console)
  const extract = R.compose(R.prop(1), R.split(':'), R.prop(0))
  return extract(match)
}

const hexToString = (hex) => {
  let str = '';
  for (let i = 0; i < hex.length; i += 2) {
      str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
  }
  return str;
}

const hexStringToBytes = (hex) => {
  // Ensure the input string is valid
  if (hex.length % 2 !== 0) {
      throw new Error("Hex string must have an even length.");
  }

  const bytes = [];
  for (let i = 0; i < hex.length; i += 2) {
      // Parse two hex characters at a time and convert to a byte (0-255)
      bytes.push(parseInt(hex.substr(i, 2), 16));
  }
  return bytes;
}

const removeNullChars = (string) => string.replace(/\u0000/g, '');

module.exports = {
  getEventBytes,
  getXbytesHex,
  hexToString,
  hexStringToBytes,
  removeNullChars,
}
