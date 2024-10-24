const R = require('ramda')

const SWAP_TOPIC = '0x66756e6473206172652073616675207361667520736166752073616675202e2e'

const getSwapEvent = _tx =>
  _tx
    .wait(0)
    .then(R.prop('logs'))
    .then(_logs => _logs.filter(x => x.topics.includes(SWAP_TOPIC))[0])

module.exports = {
  SWAP_TOPIC,
  getSwapEvent,
}