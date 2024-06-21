#!/usr/bin/env node
import {
  Chains,
  ProofcastEventAttestator,
  Protocols,
  Versions,
} from '@pnetwork/event-attestator'
import { Command } from 'commander'
import fs from 'fs/promises'
import * as R from 'ramda'

const DEFAULT_TX_HASH =
  '0x11365bbee18058f12c27236e891a66999c4325879865303f785854e9169c257a'
const DEFAULT_BLOCK_HASH =
  '0xa880cb2ab67ec9140db0f6de238b34d4108f6fab99315772ee987ef9002e0e63'

const addMainCommand = _program =>
  _program
    .name('attestator.js')
    .description('Proofcast event attestator simulator')
    .version('1.0.0')
    .action(() => {
      _program.help()
    })

const getPrivateKey = (privateKeyFile = './attestator.key') =>
  fs.readFile(privateKeyFile).then(_content => _content.toString())

const getAttestator = R.curry(({ blockHash, txHash }, privateKey) =>
  Promise.resolve(
    new ProofcastEventAttestator({
      version: Versions.V1,
      protocolId: Protocols.Evm,
      chainId: Chains.Mainnet,
      privateKey,
      blockHash,
      txHash,
    }),
  ),
)

const getStatementString = (_event, _options = {}) =>
  getPrivateKey()
    .then(getAttestator(_options))
    .then(_ea => console.info(_ea.getStatement(_event)))

const signBytes = (_bytes, _options) =>
  getPrivateKey()
    .then(getAttestator(_options))
    .then(_ea =>
      console.info(_ea.signBytes(Buffer.from(_bytes.replace('0x', ''), 'hex'))),
    )

const addGetStatementCommand = _program =>
  _program
    .command('statement <address> <data> topics...')
    .option(
      '-b --block-hash <hash>',
      'the block including the event',
      DEFAULT_BLOCK_HASH,
    )
    .option(
      '-t --tx-hash <hash>',
      'the transaction including the event',
      DEFAULT_TX_HASH,
    )
    .description('Get the hex encoded string of the statement to be signed')
    .action((address, data, topics, options) =>
      getStatementString({ address, topics, data }, options),
    ) && _program

const addSignCommand = _program =>
  _program
    .command('sign <statement>')
    .option(
      '-b --block-hash <hash>',
      'the block including the event',
      DEFAULT_BLOCK_HASH,
    )
    .option(
      '-t --tx-hash <hash>',
      'the transaction including the event',
      DEFAULT_TX_HASH,
    )
    .description('Sign')
    .action((_statement, _options) => signBytes(_statement, _options)) &&
  _program

const main = () =>
  Promise.resolve(new Command())
    .then(addMainCommand)
    .then(addGetStatementCommand)
    .then(addSignCommand)
    .then(_program => _program.parseAsync(process.argv))
    .catch(_err => console.error(_err.msg))

main()
