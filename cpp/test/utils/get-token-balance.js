const { Asset, Name } = require('@wharfkit/antelope')

// Usage:
// const before = getAccountsBalances(
//   [user, lockbox.account, adapter.account],
//   [token, xerc20],
// )
//
// console.log(before)
// {
//   user:    { TKN: '1000.0000 TKN', XTKN: '0' },
//   lockbox: { TKN: '0', XTKN: '0' },
//   adapter: { TKN: '0', XTKN: '0' }
// }
const getAccountsBalances = (_accounts, _tokensAndSymbol) => {
  const res = {}
  for (let account of _accounts) {
    res[account] = {}
    for (let token of _tokensAndSymbol) {
      res[account][token.symbol] = getTokenBalance(
        token.contract,
        account,
        token.symbol,
      ).toString()
    }
  }

  return res
}

// Given contract must be compatible with
// eosio.token
const getTokenBalance = (contract, account, symcode, precision = 4) => {
  const scope = Name.from(account).value.value
  const primary_key = Asset.SymbolCode.from(symcode).value.value
  const row = contract.tables.accounts(scope).getTableRow(primary_key)
  if (!row) return Asset.from(`0.${''.padEnd(precision, '0')} ${symcode}`)
  return Asset.from(row.balance)
}

module.exports = {
  getAccountsBalances,
  getTokenBalance,
}
