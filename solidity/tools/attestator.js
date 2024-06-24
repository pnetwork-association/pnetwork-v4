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

const getAttestator = R.curry(({ blockHash, txHash, chainId }, privateKey) =>
  Promise.resolve(
    new ProofcastEventAttestator({
      version: Versions.V1,
      protocolId: Protocols.Evm,
      chainId,
      privateKey,
      blockHash,
      txHash,
    }),
  ),
)

const getMetadata = (_event, _options = {}) =>
  getPrivateKey()
    .then(getAttestator(_options))
    .then(_ea => console.info('\ncontext:', _ea.getEventContext()) || _ea)
    .then(_ea => console.info('preimage:', _ea.getEventPreImage(_event)) || _ea)
    .then(_ea => console.info('eventid:', _ea.getEventId(_event)) || _ea)
    .then(_ea => console.info('signature:', _ea.sign(_event)) || _ea)

const addGetMetadataCommand = _program =>
  _program
    .command('metadata <address> <data> topics...')
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
    .option(
      '-c --chain-id <number>',
      'the origin chain id of the event',
      Number,
      Chains.Mainnet,
    )
    .description('Print the metadata to submit on chain and the related info')
    .action((address, data, topics, options) =>
      getMetadata({ address, topics, data }, options),
    ) && _program

const main = () =>
  Promise.resolve(new Command())
    .then(addMainCommand)
    .then(addGetMetadataCommand)
    .then(_program => _program.parseAsync(process.argv))
    .catch(_err => console.error(_err.msg))

main()
