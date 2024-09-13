module.exports.deploy = (_blockchain, _account, _path) =>
  _blockchain.createContract(_account, _path, true)
