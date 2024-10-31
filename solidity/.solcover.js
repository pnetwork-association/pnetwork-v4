// TODO: this does not work
// Try to move the src folder into a contracts folder
module.exports = {
  skipFiles: ['test', '../interfaces', 'ptoken-v1'],
  istanbulReporter: ['lcov'],
  mocha: {
    enableTimeouts: false,
  },
}
