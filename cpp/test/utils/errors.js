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

const INVALID_MINFEE_SYMBOL = eosio_assert('invalid minimum fee symbol')

const NOT_INITIALIZED = eosio_assert('adapter contract not initialized')

const SINGLETON_NOT_EXISTING = eosio_assert('singleton does not exist')

const ORIGIN_CHAINID_NOT_REGISTERED = eosio_assert(
  'origin chain_id not registered',
)

const INVALID_SIGNATURE = eosio_assert('invalid signature')

const UNEXPECTED_EMITTER = eosio_assert('unexpected emitter')

const UNEXPECTED_TOPIC_ZERO = eosio_assert('unexpected topic zero')

const INVALID_NONCE = eosio_assert('nonce do not match')

const INVALID_TOKEN_ADDRESS = eosio_assert('token address do not match')

const INVALID_DESTINATION_CHAIN = eosio_assert(
  'destination chain id does not match with the expected one',
)

const INVALID_AMOUNT = eosio_assert('amount do not match')

const INVALID_SENDER = eosio_assert('sender do not match')

const INVALID_RECIPIENT = eosio_assert('recipient do not match')

const INVALID_USER_DATA = eosio_assert('user data do not match')

const ACCOUNT_STR_IS_TOO_LONG = eosio_assert(
  'string is too long to be a valid name',
)

const INVALID_ACCOUNT = eosio_assert('invalid account')

const INVALID_SYMBOL = eosio_assert('invalid symbol')

const EXPECTED_32_BYTES = _thing => eosio_assert(`expected 32 bytes ${_thing}`)

const USER_DATA_RECORD_NOT_FOUND = eosio_assert('userdata record not found')

const INVALID_PAYLOAD = eosio_assert('invalid payload')

const CONTRACT_ALREADY_INITIALIZED = eosio_assert(
  'contract already initialized',
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
  SYMBOL_NOT_FOUND,
  SINGLETON_NOT_EXISTING,
  ORIGIN_CHAINID_NOT_REGISTERED,
  INVALID_SIGNATURE,
  UNEXPECTED_EMITTER,
  UNEXPECTED_TOPIC_ZERO,
  INVALID_NONCE,
  INVALID_TOKEN_ADDRESS,
  INVALID_DESTINATION_CHAIN,
  INVALID_AMOUNT,
  INVALID_SENDER,
  INVALID_RECIPIENT,
  INVALID_USER_DATA,
  INVALID_ACCOUNT,
  ACCOUNT_STR_IS_TOO_LONG,
  EXPECTED_32_BYTES,
  INVALID_SYMBOL,
  USER_DATA_RECORD_NOT_FOUND,
  INVALID_PAYLOAD,
  CONTRACT_ALREADY_INITIALIZED,
}
