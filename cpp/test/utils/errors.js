const SYMBOL_ALREADY_EXISTS = 'eosio_assert: token with symbol already exists'
const ACCOUNT_DOES_NOT_EXIST = 'eosio_assert: token account does not exist'
const INSUFFICIENT_BALANCE = 'eosio_assert: balance is lower than the allowance to be set'
const NO_ALLOWANCE_SET = 'eosio_assert: No allowance set for this node'

const AUTH_MISSING = _account => `missing required authority ${_account}`
const SYMBOL_NOT_FOUND = 'eosio_assert: symbol not found'

module.exports = {
  AUTH_MISSING,
  SYMBOL_NOT_FOUND,
  SYMBOL_ALREADY_EXISTS,
  ACCOUNT_DOES_NOT_EXIST,
  INSUFFICIENT_BALANCE,
  NO_ALLOWANCE_SET,
}
