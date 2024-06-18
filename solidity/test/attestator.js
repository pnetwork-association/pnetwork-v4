#!/usr/bin/env node
const fs = require('fs').promises
const { Command } = require('commander')
const { ProofcastEventAttestator } = require('@pnetwork/event-attestator')

const addMainCommand = _program =>
  _program
    .name('attestator.js')
    .description('Proofcast event attestator simulator')
    .version('1.0.0')
    .action(_ => {
      _program.help()
    })

const version = 0x00
const protocolId = 0x00
const chainId = 0x01

const getPrivateKey = (privateKeyFile = './attestator.key') =>
  fs.readFile(privateKeyFile).then(_content => _content.toString())

const getAttestator = privateKey =>
  Promise.resolve(
    new ProofcastEventAttestator({
      version,
      protocolId,
      chainId,
      privateKey,
    }),
  )

const getStatementString = _event =>
  getPrivateKey()
    .then(getAttestator)
    .then(_ea => console.log(_ea.getStatement(_event)))

const signBytes = _bytes =>
  getPrivateKey()
    .then(getAttestator)
    .then(_ea =>
      console.info(_ea.signBytes(Buffer.from(_bytes.replace('0x', ''), 'hex'))),
    )

const addGetStatementCommand = _program =>
  _program
    .command('statement <address> <data> topics...')
    .description('Get the hex encoded string of the statement to be signed')
    .action((address, data, topics) =>
      getStatementString({ address, topics, data }),
    ) && _program

const addOtherCommand = _program =>
  _program
    .command('sign <statement>')
    .description('Sign')
    .action(_statement => signBytes(_statement)) && _program

const main = () =>
  Promise.resolve(new Command())
    .then(addMainCommand)
    .then(addGetStatementCommand)
    .then(addOtherCommand)
    .then(_program => _program.parseAsync(process.argv))
    .catch(_err => console.error(_err.msg))

main()
