const { expect } = require('chai')
const { Blockchain, expectToThrow } = require('@eosnetwork/vert')
const { deploy } = require('./utils/deploy')
const { Asset } = require('@wharfkit/antelope')
const R = require('ramda')
const {
  active,
  precision,
  getAccountCodeRaw,
  getSymbolCodeRaw,
} = require('./utils/eos-ext')
const errors = require('./utils/errors')
const { substract } = require('./utils/wharfkit-ext')
const { getTokenBalance } = require('./utils/get-token-balance')
const ethers = require('ethers')

const getSwapMemo = (destinationChainId, recipient, data) =>
  `${destinationChainId},${recipient},${R.isEmpty(data) ? '0' : '1'}`

describe('Lockbox testing', () => {
  const symbol = 'TKN'
  const precision4 = precision(4)
  const maxSupply = '500000000.0000'
  const userInitialBalance = `1000.0000 ${symbol}`

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

  const setup = async () => {
    const memo = ''
    await token.contract.actions
      .create([issuer, token.maxSupply])
      .send(active(token.account))
    await xerc20.contract.actions
      .create([issuer, xerc20.maxSupply])
      .send(active(xerc20.account))
    await lockbox.contract.actions
      .create([
        xerc20.account,
        precision4(xerc20.symbol),
        token.account,
        precision4(token.symbol),
      ])
      .send(active(lockbox.account))

    await token.contract.actions
      .issue([issuer, userInitialBalance, memo])
      .send(active(issuer))

    await token.contract.actions
      .transfer([issuer, user, userInitialBalance, memo])
      .send(active(issuer))

    await xerc20.contract.actions
      .setlockbox(lockbox)
      .send(active(xerc20.account))
  }

  describe('adapter::create', () => {
    it('Should create the pair successfully', async () => {
      await setup()

      await adapter.contract.actions
        .create([
          xerc20.account,
          precision4(xerc20.symbol),
          token.account,
          precision4(token.symbol),
        ])
        .send(active(adapter.account))

      const row = adapter.contract.tables
        .registry(getAccountCodeRaw(adapter.account))
        .getTableRow(getSymbolCodeRaw(token.maxSupply))

      expect(row).to.be.deep.equal({
        token: token.account,
        token_symbol: precision4(token.symbol),
        xerc20: xerc20.account,
        xerc20_symbol: precision4(xerc20.symbol),
      })
    })
  })

  describe('adapter::swap', () => {
    it('Should swap correctly', async () => {
      const data = ''
      const recipient = '0x68bbed6a47194eff1cf514b50ea91895597fc91e'

      const destinationChainId = ethers.zeroPadValue('0x01', 32)
      console.log('destinationChainId', destinationChainId)

      const memo = getSwapMemo(destinationChainId, recipient, data)
      const amount = '10.0000'
      const quantity = `${amount} ${symbol}`

      try {
        await token.contract.actions
          .transfer([user, adapter.account, quantity, memo])
          .send(active(user))
      } finally {
        console.log(adapter.contract.bc.console)
        console.log(lockbox.contract.bc.console)
      }
    })
  })
})