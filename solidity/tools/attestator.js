#!/usr/bin/env node
const {
  Chains,
  ProofcastEventAttestator,
  Protocols,
  Versions,
} = require('@pnetwork/event-attestator')
const { Command } = require('commander')
const fs = require('fs')
const R = require('ramda')

const DEFAULT_TX_HASH =
  '0x11365bbee18058f12c27236e891a66999c4325879865303f785854e9169c257a'
const DEFAULT_BLOCK_HASH =
  '0xa880cb2ab67ec9140db0f6de238b34d4108f6fab99315772ee987ef9002e0e63'

const DEFAULT_PK_FILE = './attestator.key'

const getMetadata = (_event, _options) => {
  const privateKey = fs.readFileSync(_options.privateKeyFile).toString()
  const ea = new ProofcastEventAttestator({
    version: Versions.V1,
    protocolId: Protocols.Evm,
    chainId: _options.chainId,
    privateKey,
  })

  _event.blockHash = _options.blockHash
  _event.transactionHash = _options.txHash

  const signature = _options.eos
    ? ea.formatEosSignature(ea.sign(_event))
    : ea.formatEvmSignature(ea.sign(_event))

  console.info('\ncontext:', ea.getEventContext())
  console.info('preimage:', ea.getEventPreImage(_event))
  console.info('eventid:', ea.getEventId(_event))
  console.log('signature:', signature)
}

const program = new Command()

program
  .command('eos-metadata <account> <action> <data>')
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
    Chains(Protocols.Eos).Mainnet,
  )
  .option(
    '-p, --private-key-file <file>',
    'the file containing the private key in hex string format',
    DEFAULT_PK_FILE,
  )
  .option('-e, --evm', 'sign with EVM signature format', false)
  .option('-s, --eos', 'sign with EOS signature format', true)
  .description('Gets an EOS event metadata')
  .action((account, action, data, options) =>
    getMetadata(
      {
        account,
        action,
        data,
      },
      options,
    ),
  )

program
  .command('evm-metadata <address> <data> topics...')
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
    '-p, --private-key-file <file>',
    'the file containing the private key in hex string format',
    DEFAULT_PK_FILE,
  )
  .option(
    '-c --chain-id <number>',
    'the origin chain id of the event',
    Number,
    Chains(Protocols.Evm).Mainnet,
  )
  .option('-e, --evm', 'sign with EVM signature format', true)
  .option('-s, --eos', 'sign with EOS signature format', false)
  .description('Gets an EVM event metadata')
  .action((address, data, topics, options) =>
    getMetadata(
      {
        address,
        topics,
        data,
        blockHash: options.blockHash,
        transactionHash: options.txHash,
      },
      options,
    ),
  )

program
  .name('attestator.js')
  .description('Proofcast event attestator simulator')
  .version('1.0.0')
  .action(() => {
    program.help()
  })

program.parse()
