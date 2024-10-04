const { expect } = require('chai')
const { Blockchain, expectToThrow, mintTokens } = require('@eosnetwork/vert')
const { deploy } = require('./utils/deploy')
const { Asset, Bytes } = require('@wharfkit/antelope')
const R = require('ramda')
const {
  active,
  precision,
  getAccountCodeRaw,
  getSymbolCodeRaw,
  getSingletonInstance,
  logExecutionTraces,
  prettyTrace,
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

  const TABLE_STORAGE = 'storage'

  const token = {
    symbol: symbol,
    account: `${symbol.toLowerCase()}.token`,
    maxSupply: `${maxSupply} ${symbol}`,
    bytes: tokenBytes,
    contract: null,
  }
  const xerc20 = {
    symbol: `X${symbol}`,
    account: `x${symbol.toLowerCase()}.token`,
    maxSupply: `${maxSupply} X${symbol}`,
    contract: null,
  }

  const lockbox = {
    account: 'lockbox',
    contract: null,
  }

  const adapter = {
    account: 'adapter',
    contract: null,
  }

  const receiver = {
    account: 'receiver',
    contract: null,
  }

  const blockchain = new Blockchain()

  const user = 'user'
  const evil = 'evil'
  const issuer = 'issuer'
  const bridge = 'bridge'
  const recipient = 'recipient'

  before(async () => {
    blockchain.createAccounts(user, evil, issuer, bridge, recipient)
    lockbox.contract = deploy(
      blockchain,
      lockbox.account,
      'contracts/build/lockbox',
    )
    token.contract = deploy(
      blockchain,
      token.account,
      'contracts/build/eosio.token',
    )
    xerc20.contract = deploy(
      blockchain,
      xerc20.account,
      'contracts/build/xerc20.token',
    )
    adapter.contract = deploy(
      blockchain,
      adapter.account,
      'contracts/build/adapter',
    )
    receiver.contract = deploy(
      blockchain,
      receiver.account,
      'contracts/build/test.receiver',
    )
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

      await adapter.contract.actions
        .create([
          xerc20.account,
          precision4(xerc20.symbol),
          token.account,
          precision4(token.symbol),
          token.bytes,
        ])
        .send(active(adapter.account))

      const row = adapter.contract.tables
        .regadapter(getAccountCodeRaw(adapter.account))
        .getTableRow(getSymbolCodeRaw(token.maxSupply))

      const storage = getSingletonInstance(adapter.contract, TABLE_STORAGE)

      expect(row).to.be.deep.equal({
        token: token.account,
        token_symbol: precision4(token.symbol),
        token_bytes: token.bytes,
        xerc20: xerc20.account,
        xerc20_symbol: precision4(xerc20.symbol),
      })

      expect(storage).be.deep.equal({
        nonce: 0,
        minfee: '',
        feesmanager: '',
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

      before.storage = getSingletonInstance(adapter.contract, TABLE_STORAGE)

      await token.contract.actions
        .transfer([user, adapter.account, quantity, memo])
        .send(active(user))

      const after = getAccountsBalances(
        [user, lockbox.account, adapter.account],
        [token, xerc20],
      )

      after.storage = getSingletonInstance(adapter.contract, TABLE_STORAGE)

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

      expect(after.storage.nonce).to.be.equal(before.storage.nonce + 1)

      const possibleSwap = prettyTrace(R.last(blockchain.executionTraces))
      expect(possibleSwap['Contract']).to.be.equal(adapter.account)
      expect(possibleSwap['Action']).to.be.equal('swap')
      expect(possibleSwap['Inline']).to.be.equal(true)
      expect(possibleSwap['Notification']).to.be.equal(false)
      expect(possibleSwap['First Receiver']).to.be.equal(adapter.account)
      expect(possibleSwap['Sender']).to.be.equal(adapter.account)
      // FIXME: event_bytes is correctly set inside the action
      // probably a deserialization bug of vert during
      // expect(['Data']).to.be.equal()
    })

    // TODO: test adduserdata + swap actions in
    // succession once the above is fixed
    // it('Should swap with userdata', async () => {})
  })

  describe('adapter::settle', () => {
    it('Should settle the operation properly and send userdata', async () => {
      const quantity = `10.0000 TKN`
      const normalizedAmount = ethers
        .parseUnits(Asset.from(quantity).units.toString(), 18)
        .toString()

      const operation = getOperationSample({
        amount: normalizedAmount,
      })

      const metadata = getMetadataSample()

      const before = getAccountsBalances(
        [user, recipient, lockbox.account, adapter.account],
        [token, xerc20],
      )

      await adapter.contract.actions
        .settle([user, operation, metadata])
        .send(active(user))

      const after = getAccountsBalances(
        [user, recipient, lockbox.account, adapter.account],
        [token, xerc20],
      )

      expect(
        substract(
          after[recipient][token.symbol],
          before[recipient][token.symbol],
        ).toString(),
      ).to.be.equal(quantity)

      expect(
        substract(
          before[lockbox.account][token.symbol],
          after[lockbox.account][token.symbol],
        ).toString(),
      ).to.be.equal(quantity)

      expect(after[lockbox.account][xerc20.symbol]).to.be.equal(
        `0.0000 ${xerc20.symbol}`,
      )

      expect(after[adapter.account][token.symbol]).to.be.equal(
        `0.0000 ${token.symbol}`,
      )
      expect(after[adapter.account][xerc20.symbol]).to.be.equal(
        `0.0000 ${xerc20.symbol}`,
      )
    })

    it('Should send userdata to a receiver contract', async () => {
      const quantity = `1.0000 ${token.symbol}`
      const normalizedAmount = ethers
        .parseUnits(Asset.from(quantity).units.toString(), 18)
        .toString()

      const metadata = getMetadataSample()
      const operation = getOperationSample({
        amount: normalizedAmount,
        data: 'c0ffeec0ffeec0ffee',
        recipient: receiver.account,
      })

      const before = getAccountsBalances([receiver.account], [token, xerc20])

      // Fill in some tokens as collateral
      await token.contract.actions
        .transfer([user, lockbox.account, quantity, ''])
        .send(active(user))

      await adapter.contract.actions
        .settle([user, operation, metadata])
        .send(active(user))

      const after = getAccountsBalances([receiver.account], [token, xerc20])
      const receiverResults = receiver.contract.tables
        .results(getAccountCodeRaw(receiver.account))
        .getTableRow(0n)

      expect(
        substract(
          after[receiver.account][token.symbol],
          before[receiver.account][token.symbol],
        ).toString(),
      ).to.be.equal(quantity)

      expect(receiverResults).to.be.deep.equal({
        id: 0,
        data: operation.data,
      })
    })
  })
})
