const R = require('ramda')

module.exports.getEventBytes = _contract => {
  const re = /adapter_swap_event_bytes:[a-fA-F0-9]+/
  const match = re.exec(_contract.bc.console)
  const extract = R.compose(R.prop(1), R.split(':'), R.prop(0))
  return extract(match)
}