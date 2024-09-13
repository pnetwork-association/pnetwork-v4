const { expect } = require('chai')
const { Blockchain, expectToThrow } = require('@eosnetwork/vert')
const { deploy } = require('./utils/deploy')
const { active, getAccountCodeRaw } = require('./utils/eos-ext')
const errors = require('./utils/errors')
const { getSymbolCodeRaw } = require('./utils/eos-ext')

describe('Lockbox testing', () => {
  const symbol = 'TKN'
  const precision = 4
  const maxSupply = 500000000
  const token = {
    symbol: `${precision},${symbol}`,
    account: `${symbol.toLowerCase()}.token`,
    maxSupply: `${maxSupply} ${symbol}`,
    contract: undefined,
  }
  const xerc20 = {
    symbol: `${precision},X${symbol}`,
    account: `x${symbol.toLowerCase()}.token`,
    maxSupply: `${maxSupply} X${symbol}`,
    contract: undefined,
  }

  const lockbox = {
    account: 'lockbox',
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
  })

  describe('lockbox::init', () => {
    it('Should fail if account initializing is not the lockbox.account', async () => {
      const action = lockbox.contract.actions
        .init([xerc20.account, xerc20.symbol, token.account, token.symbol])
        .send(active(evil))

      await expectToThrow(action, errors.AUTH_MISSING(lockbox.account))
    })

    it('Should fail when unable to find the symbol in the xerc20 stats table', async () => {
      const action = lockbox.contract.actions
        .init([xerc20.account, xerc20.symbol, token.account, token.symbol])
        .send(active(lockbox.account))

      await expectToThrow(action, errors.SYMBOL_NOT_FOUND)
    })

    it('Should fail when unable to find the symbol in the token stats table', async () => {
      await xerc20.contract.actions.create([issuer, xerc20.maxSupply]).send()

      const action = lockbox.contract.actions
        .init([xerc20.account, xerc20.symbol, token.account, token.symbol])
        .send(active(lockbox.account))

      await expectToThrow(action, errors.SYMBOL_NOT_FOUND)
    })

    it('Should initialize a pair properly', async () => {
      await token.contract.actions.create([issuer, token.maxSupply]).send()

      await lockbox.contract.actions
        .init([xerc20.account, xerc20.symbol, token.account, token.symbol])
        .send(active(lockbox.account))

      const after = lockbox.contract.tables
        .registry(getAccountCodeRaw(lockbox.account))
        .getTableRow(getAccountCodeRaw(token.account))

      expect(after).to.be.deep.equal({
        token: token.account,
        token_symbol: token.symbol,
        xerc20: xerc20.account,
        xerc20_symbol: xerc20.symbol,
      })
    })
  })

  // describe('lockbox::deposit', () => {
  //   before(async () => {
  //     token = {
  //       contract: deploy(blockchain, token.account, 'contracts/eosio.token'),
  //       account: token.account,
  //   })

  //   it('Should deposit the expected quantity to the sender', async () => {
  //     const memo = ''
  //     const quantity = `1000 ${symbol}`
  //     await token.contract.actions.create([issuer, maxSupply]).send()
  //     await xerc20.contract.actions.create([issuer, maxSupplyXERC20]).send()
  //     await token.contract.actions
  //       .issue([issuer, quantity, memo])
  //       .send(active(issuer))
  //     await token.contract.actions
  //       .tranfer([issuer, user, quantity, memo])
  //       .send(active(issuer))

  //     console.log('balance', getTokenBalance(token.contract, user, symbol))
  //     await lockbox.contract.actions
  //       .deposit([user, token.account, quantity])
  //       .send(active(user))
  //   })
  // })
})
