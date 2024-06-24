const fromHex = (_str: string): Buffer => {
  return Buffer.from(_str.replace('0x', ''), 'hex')
}

export default {
  fromHex: fromHex,
}
