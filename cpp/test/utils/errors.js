const SYMBOL_ALREADY_EXISTS = 'eosio_assert: token with symbol already exists'

const AUTH_MISSING = _account => `missing required authority ${_account}`

module.exports = {
  AUTH_MISSING,
  SYMBOL_ALREADY_EXISTS,
}
