const { Asset, Name } = require('@wharfkit/antelope')

// Given contract must be compatible with
// eosio.token
module.exports.getTokenBalance = (contract, account, symcode) => {
  const scope = Name.from(account).value.value
  const primary_key = Asset.SymbolCode.from(symcode).value.value
  const row = contract.tables.accounts(scope).getTableRow(primary_key)
  console.log('row', row)

  console.log('primary_key', Number(primary_key))
  console.log('scope', Number(scope))
  if (!row) return 0
  return Asset.from(row.balance).units.toNumber()
}
