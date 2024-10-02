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
const { substract, no0x } = require('./utils/wharfkit-ext')
const { getAccountsBalances } = require('./utils/get-token-balance')
const { getMetadataSample } = require('./utils/get-metadata-sample')
const { getOperationSample } = require('./utils/get-operation-sample')

const ethers = require('ethers')

const getSwapMemo = (sender, destinationChainId, recipient, data) =>
  `${sender},${destinationChainId},${recipient},${R.isEmpty(data) ? '0' : '1'}`

describe('Adapter testing', () => {
  const symbol = 'TKN'
  const precision4 = precision(4)
  const maxSupply = '500000000.0000'
  const userInitialBalance = `1000.0000 ${symbol}`
  const tokenBytes = no0x(
    ethers.zeroPadValue(
      ethers.toBeHex(getSymbolCodeRaw(`0.0000 ${symbol}`).toString()),
      32,
    ),
  )

  const token = {
    symbol: symbol,
    account: `${symbol.toLowerCase()}.token`,
    maxSupply: `${maxSupply} ${symbol}`,
    bytes: tokenBytes,
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

    const mintingLimit = `1000.0000 ${xerc20.symbol}`
    const burningLimit = `600.0000 ${xerc20.symbol}`

    await xerc20.contract.actions
      .setlimits([adapter.account, mintingLimit, burningLimit])
      .send(active(xerc20.account))
  }

  describe('adapter::create', () => {
    it('Should create the pair successfully', async () => {
      await setup()

      console.log('tokenBytes', token.bytes)
      try {
        await adapter.contract.actions
          .create([
            xerc20.account,
            precision4(xerc20.symbol),
            token.account,
            precision4(token.symbol),
            token.bytes,
          ])
          .send(active(adapter.account))
      } finally {
        console.log(adapter.contract.bc.console)
      }

      const row = adapter.contract.tables
        .regadapter(getAccountCodeRaw(adapter.account))
        .getTableRow(getSymbolCodeRaw(token.maxSupply))

      expect(row).to.be.deep.equal({
        token: token.account,
        token_symbol: precision4(token.symbol),
        token_bytes: token.bytes,
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
      const memo = getSwapMemo(user, destinationChainId, recipient, data)
      const amount = '10.0000'
      const quantity = `${amount} ${symbol}`

      const before = getAccountsBalances(
        [user, lockbox.account, adapter.account],
        [token, xerc20],
      )

      try {
        await token.contract.actions
          .transfer([user, adapter.account, quantity, memo])
          .send(active(user))
      } finally {
        console.log(adapter.contract.bc.console)
      }

      const after = getAccountsBalances(
        [user, lockbox.account, adapter.account],
        [token, xerc20],
      )

      expect(
        substract(
          before.user[token.symbol],
          after.user[token.symbol],
        ).toString(),
      ).to.be.equal(quantity)

      expect(
        substract(
          after.lockbox[token.symbol],
          before.lockbox[token.symbol],
        ).toString(),
      ).to.be.equal(quantity)

      expect(
        substract(
          after.lockbox[xerc20.symbol],
          before.lockbox[xerc20.symbol],
        ).toString(),
      ).to.be.equal(`0.0000 ${xerc20.symbol}`)

      // TODO: check swap action inclusion here
    })
  })

  describe('adapter::settle', () => {
    it('Should settle the operation properly', async () => {
      const operation = getOperationSample()
      const metadata = getMetadataSample()

      try {
        await adapter.contract.actions
          .settle([user, operation, metadata])
          .send(active(user))
      } finally {
        console.log(adapter.contract.bc.console)
      }
    })
  })
})
