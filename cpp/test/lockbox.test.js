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
const { getAccountsBalances } = require('./utils/get-token-balance')

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

  const blockchain = new Blockchain()

  const user = 'user'
  const evil = 'evil'
  const issuer = 'issuer'
  const bridge = 'bridge'
  const recipient = 'recipient'

  before(async () => {
    blockchain.createAccounts(user, evil, issuer, bridge, recipient)
    lockbox.contract = deploy(blockchain, lockbox.account, 'contracts/build/lockbox')
    token.contract = deploy(blockchain, token.account, 'contracts/build/eosio.token')
    xerc20.contract = deploy(
      blockchain,
      xerc20.account,
      'contracts/build/xerc20.token',
    )
  })

  describe('lockbox::create', () => {
    it('Should fail if account initializing is not the lockbox.account', async () => {
      const action = lockbox.contract.actions
        .create([
          xerc20.account,
          precision4(xerc20.symbol),
          token.account,
          precision4(token.symbol),
        ])
        .send(active(evil))

      await expectToThrow(action, errors.AUTH_MISSING(lockbox.account))
    })

    it('Should fail when unable to find the symbol in the xerc20 stats table', async () => {
      const action = lockbox.contract.actions
        .create([
          xerc20.account,
          precision4(xerc20.symbol),
          token.account,
          precision4(token.symbol),
        ])
        .send(active(lockbox.account))

      await expectToThrow(action, errors.SYMBOL_NOT_FOUND)
    })

    it('Should fail when unable to find the symbol in the token stats table', async () => {
      await xerc20.contract.actions.create([issuer, xerc20.maxSupply]).send()

      const action = lockbox.contract.actions
        .create([
          xerc20.account,
          precision4(xerc20.symbol),
          token.account,
          precision4(token.symbol),
        ])
        .send(active(lockbox.account))

      await expectToThrow(action, errors.SYMBOL_NOT_FOUND)
    })

    it('Should initialize a pair properly', async () => {
      await token.contract.actions.create([issuer, token.maxSupply]).send()

      await lockbox.contract.actions
        .create([
          xerc20.account,
          precision4(xerc20.symbol),
          token.account,
          precision4(token.symbol),
        ])
        .send(active(lockbox.account))

      const after = lockbox.contract.tables
        .reglockbox(getAccountCodeRaw(lockbox.account))
        .getTableRow(getSymbolCodeRaw(token.maxSupply))

      expect(after).to.be.deep.equal({
        token: token.account,
        token_symbol: precision4(token.symbol),
        xerc20: xerc20.account,
        xerc20_symbol: precision4(xerc20.symbol),
      })
    })
  })

  describe('lockbox::deposit', () => {
    const userInitialBalance = `1000.0000 ${symbol}`
    before(async () => {
      const memo = ''
      await token.contract.actions
        .issue([issuer, userInitialBalance, memo])
        .send(active(issuer))
      await token.contract.actions
        .transfer([issuer, user, userInitialBalance, memo])
        .send(active(issuer))

      await xerc20.contract.actions
        .setlockbox(lockbox)
        .send(active(xerc20.account))
    })

    it('Should deposit the expected quantity', async () => {
      const memo = ''
      const amount = '10.0000'
      const quantity = `${amount} ${token.symbol}`

      await token.contract.actions
        .transfer([user, lockbox.account, quantity, memo])
        .send(active(user))

      const tokenBalance = token.contract.tables
        .accounts(getAccountCodeRaw(user))
        .getTableRow(getSymbolCodeRaw(token.maxSupply)).balance

      expect(tokenBalance).to.be.equal(
        String(substract(userInitialBalance, quantity)),
      )

      const lockboxBalance = token.contract.tables
        .accounts(getAccountCodeRaw(lockbox.account))
        .getTableRow(getSymbolCodeRaw(token.maxSupply)).balance

      expect(lockboxBalance).to.be.equal(quantity)

      const userBalance = xerc20.contract.tables
        .accounts(getAccountCodeRaw(user))
        .getTableRow(getSymbolCodeRaw(xerc20.maxSupply)).balance

      const expectedBalance = `${amount} ${xerc20.symbol}`
      expect(userBalance).to.be.equal(expectedBalance)
    })

    it('Should withdraw the expected quantity', async () => {
      const memo = ''
      const amount = '5.0000'
      const quantity = `${amount} ${xerc20.symbol}`

      const before = getAccountsBalances(
        [lockbox.account, user],
        [token, xerc20],
      )

      await xerc20.contract.actions
        .transfer([user, lockbox.account, quantity, memo])
        .send(active(user))

      const after = getAccountsBalances(
        [lockbox.account, user],
        [token, xerc20],
      )

      expect(
        String(
          substract(before.lockbox[token.symbol], after.lockbox[token.symbol]),
        ),
      ).to.be.equal(`${amount} ${token.symbol}`)
      expect(
        String(substract(after.user[token.symbol], before.user[token.symbol])),
      ).to.be.equal(`${amount} ${token.symbol}`)
      expect(
        String(
          substract(before.user[xerc20.symbol], after.user[xerc20.symbol]),
        ),
      ).to.be.equal(quantity)
    })
  })
})
