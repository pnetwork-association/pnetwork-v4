const { Asset, Name } = require('@wharfkit/antelope')

const active = _account => `${_account}@active`

const getSymbolCodeRaw = _asset => Asset.from(_asset).symbol.code.value.value

const getAccountCodeRaw = _account => Name.from(_account).value.value

module.exports = {
  active,
  getSymbolCodeRaw,
  getAccountCodeRaw,
}
