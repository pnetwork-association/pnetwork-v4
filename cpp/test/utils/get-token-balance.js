const { Asset, Name } = require('@wharfkit/antelope')

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
const getTokenBalance = (contract, account, symcode) => {
  const scope = Name.from(account).value.value
  const primary_key = Asset.SymbolCode.from(symcode).value.value
  const row = contract.tables.accounts(scope).getTableRow(primary_key)
  if (!row) return 0
  return Asset.from(row.balance)
}

module.exports = {
  getAccountsBalances,
  getTokenBalance,
}
