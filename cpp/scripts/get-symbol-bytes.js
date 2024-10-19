#!/usr/bin/env node

// Usage:
// node get-symbol-bytes.js WRAM
//
const { getSymbolCodeRaw } = require('../test/utils/eos-ext')

if (process.argv.length < 3) throw Error('Asset argument is missing')

const symbol = process.argv[2]

// NOTE: getSymbolCodeRaw accepts an asset
const hex = getSymbolCodeRaw(`0 ${symbol}`).toString(16)

console.log(hex.padStart(64, '0'))
