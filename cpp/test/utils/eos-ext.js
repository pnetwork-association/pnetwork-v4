const R = require('ramda')

const { Asset, Name } = require('@wharfkit/antelope')
const { Symbol } = Asset

const active = _account => `${_account}@active`

const getSymbolCodeRaw = _assetOrSymbol =>
  _assetOrSymbol instanceof Asset
    ? Asset.from(_assetOrSymbol).symbol.code.value.value
    : Symbol.from(_assetOrSymbol).value.value

const getAccountCodeRaw = _account => Name.from(_account).value.value

const precision = R.curry((_precision, _symbol) => `${_precision},${_symbol}`)

const getSingletonInstance = (_contract, _tableName) =>
  _contract.tables[_tableName]().getTableRow(getAccountCodeRaw(_tableName))

const prettyTrace = _trace => ({
  Contract: _trace.contract.toString(),
  Action: _trace.action.toString(),
  Inline: _trace.isInline,
  Notification: _trace.isNotification,
  'First Receiver': _trace.firstReceiver.toString(),
  Sender: _trace.sender.toString(),
  Authorization: JSON.stringify(_trace.authorization),
  Data: JSON.stringify(_trace.data),
  'Action Order': _trace.actionOrder.toString(),
  'Execution Order': _trace.executionOrder.toString(),
})

const logExecutionTraces = traces => {
  return traces.map(_trace => console.log(prettyTrace(_trace)))
}

module.exports = {
  active,
  precision,
  prettyTrace,
  getSymbolCodeRaw,
  getAccountCodeRaw,
  logExecutionTraces,
  getSingletonInstance,
}
