const eosio_assert = _str => `eosio_assert: ${_str}`

const SYMBOL_ALREADY_EXISTS = eosio_assert('token with symbol already exists')
const ACCOUNT_DOES_NOT_EXIST = eosio_assert('token account does not exist')
const INSUFFICIENT_BALANCE_SET = eosio_assert(
  '[set allowance]: balance is lower than the allowance to be set',
)
const INSUFFICIENT_BALANCE_INC = eosio_assert(
  '[increase allowance]: balance is lower than the allowance to be set',
)
const NO_ALLOWANCE_SET = eosio_assert('No allowance set for this node')

const AUTH_MISSING = _account => `missing required authority ${_account}`
const SYMBOL_NOT_FOUND = eosio_assert('symbol not found')

const FROM_ACCOUNT_IS_FROZEN = eosio_assert('from account is frozen')
const TO_ACCOUNT_IS_FROZEN = eosio_assert('to account is frozen')

const INVALID_TOKEN = eosio_assert(
  'underlying token does not match with adapter registry',
)
const UNEXPECTED_CONTEXT = eosio_assert('unexpected context')
const INVALID_SIGNATURE = eosio_assert('invalid signature')
const INVALID_MINFEE_SYMBOL = eosio_assert('invalid minimum fee symbol')

const NOT_INITIALIZED = eosio_assert('adapter contract not initialized')
const WRONG_SYM_PRECISION = eosio_assert('symbol not found')
const SINGLETON_NOT_EXISTING = eosio_assert('singleton does not exist')
const ORIGIN_CHAINID_NOT_REGISTERED = eosio_assert(
  'origin chain_id not registered',
)

module.exports = {
  AUTH_MISSING,
  SYMBOL_NOT_FOUND,
  SYMBOL_ALREADY_EXISTS,
  ACCOUNT_DOES_NOT_EXIST,
  INSUFFICIENT_BALANCE_SET,
  INSUFFICIENT_BALANCE_INC,
  NO_ALLOWANCE_SET,
  FROM_ACCOUNT_IS_FROZEN,
  TO_ACCOUNT_IS_FROZEN,
  INVALID_TOKEN,
  UNEXPECTED_CONTEXT,
  INVALID_SIGNATURE,
  INVALID_MINFEE_SYMBOL,
  NOT_INITIALIZED,
  WRONG_SYM_PRECISION,
  SINGLETON_NOT_EXISTING,
  ORIGIN_CHAINID_NOT_REGISTERED,
  INVALID_SIGNATURE,
}
