const R = require('ramda')

const { Asset, Name } = require('@wharfkit/antelope')

const active = _account => `${_account}@active`

// TODO: replace w/ symbolCodeToBigInt
const getSymbolCodeRaw = _asset => Asset.from(_asset).symbol.code.value.value

// TODO: replace w/ nameToBigInt
const getAccountCodeRaw = _account => Name.from(_account).value.value

const precision = R.curry((_precision, _symbol) => `${_precision},${_symbol}`)

const getSingletonInstance = (_contract, _tableName) =>
  _contract.tables[_tableName]().getTableRow(getAccountCodeRaw(_tableName))

const logExecutionTraces = traces => {
  return traces.map(_trace =>
    console.log(`START ACTION
    Contract: ${_trace.contract}
    Action: ${_trace.action}
    Inline: ${_trace.isInline}
    Notification: ${_trace.isNotification}
    First Receiver: ${_trace.firstReceiver}
    Sender: ${_trace.sender}
    Authorization: ${JSON.stringify(_trace.authorization)}
    Data: ${JSON.stringify(_trace.data, null, 4)}
    Action Order: ${_trace.actionOrder}
    Execution Order: ${_trace.executionOrder}
    `),
  )
}

module.exports = {
  active,
  precision,
  getSymbolCodeRaw,
  getAccountCodeRaw,
  logExecutionTraces,
  getSingletonInstance,
}
