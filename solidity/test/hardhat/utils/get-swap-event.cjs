const R = require('ramda')

const SWAP_EVENT_TOPIC =
  '0x9b706941b48091a1c675b439064f40b9d43c577d9c7134cce93179b9b0bf2a52'

module.exports.getSwapEvent = _tx =>
  _tx
    .wait(0)
    .then(R.prop('logs'))
    .then(_logs => _logs.filter(x => x.topics.includes(SWAP_EVENT_TOPIC))[0])
