const R = require('ramda')

const SWAP_EVENT_TOPIC = '0x7a62b8c6141da7e579d5a8ec90e6a5fbd5ce9a3d16ca0a9955ee3c2a095a0c2d'

module.exports.getSwapEvent = _tx =>
  _tx
    .wait(0)
    .then(R.prop('logs'))
    .then(_logs => _logs.filter(x => x.topics.includes(SWAP_EVENT_TOPIC))[0])
