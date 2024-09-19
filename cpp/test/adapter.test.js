const { expect } = require('chai')
const { Blockchain, expectToThrow } = require('@eosnetwork/vert')
const { deploy } = require('./utils/deploy')
const { Asset } = require('@wharfkit/antelope')
const {
  active,
  precision,
  getAccountCodeRaw,
  getSymbolCodeRaw,
} = require('./utils/eos-ext')
const errors = require('./utils/errors')
const { substract } = require('./utils/wharfkit-ext')
const { getTokenBalance } = require('./utils/get-token-balance')

describe('Lockbox testing', () => {
  const symbol = 'TKN'
  const precision4 = precision(4)
  const maxSupply = '500000000.0000'
  const token = {
    symbol: symbol,
    account: `${symbol.toLowerCase()}.token`,
    maxSupply: `${maxSupply} ${symbol}`,
    contract: undefined,
  }
  const xerc20 = {
    symbol: `X${symbol}`,
    account: `x${symbol.toLowerCase()}.token`,
    maxSupply: `${maxSupply} X${symbol}`,
    contract: undefined,
  }

  const lockbox = {
    account: 'lockbox',
    contract: undefined,
  }

  const adapter = {
    account: 'adapter',
    contract: undefined,
  }

  const blockchain = new Blockchain()

  const user = 'user'
  const evil = 'evil'
  const issuer = 'issuer'
  const bridge = 'bridge'
  const recipient = 'recipient'

  before(async () => {
    blockchain.createAccounts(user, evil, issuer, bridge, recipient)
    lockbox.contract = deploy(blockchain, lockbox.account, 'contracts/lockbox')
    token.contract = deploy(blockchain, token.account, 'contracts/eosio.token')
    xerc20.contract = deploy(
      blockchain,
      xerc20.account,
      'contracts/xerc20.token',
    )
    adapter.contract = deploy(blockchain, adapter.account, 'contracts/adapter')
  })

  describe('lockbox::init', () => {
    it('Should fail if account initializing is not the lockbox.account', async () => {
      const action = lockbox.contract.actions.create([]).send(active(adapter))
    })
  })
})
