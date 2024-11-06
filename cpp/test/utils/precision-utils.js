const adjustPrecision = (amount, precision) => {
  if (typeof amount === 'number') {
    amount = amount.toString()
  }

  const [integerPart, decimalPart] = amount.split('.')
  const trimmedDecimals = (decimalPart || '')
    .slice(0, precision)
    .padEnd(precision, '0')

  return precision > 0 ? `${integerPart}.${trimmedDecimals}` : integerPart
}

module.exports = {
  adjustPrecision,
}
