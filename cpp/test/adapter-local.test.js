const { expect } = require('chai')
const { Blockchain, expectToThrow } = require('@eosnetwork/vert')
const { deploy } = require('./utils/deploy')
const R = require('ramda')
const {
  active,
  precision,
  getAccountCodeRaw,
  getSymbolCodeRaw,
  getSingletonInstance,
  prettyTrace,
} = require('./utils/eos-ext')
const {
  getXbytesHex,
  hexToString,
  removeNullChars,
} = require('./utils/bytes-utils')
const { getEventBytes } = require('./utils/get-event-bytes')
const { substract } = require('./utils/wharfkit-ext')
const { getAccountsBalances } = require('./utils/get-token-balance')
const errors = require('./utils/errors')
const { no0x } = require('./utils')
const ethers = require('ethers')

const getSwapMemo = (sender, destinationChainId, recipient, data) =>
  `${sender},${destinationChainId},${recipient},${R.isEmpty(data) ? '0' : '1'}`

const attestation = 'deadbeef'

describe('Adapter EOS -> ETH testing', () => {
  const symbol = 'TKN'
  const minFee = `0.0010 X${symbol}`
  const precision4 = precision(4)
  const maxSupply = '500000000.0000'
  const tokenMaxSupply = '500000000.0000'
  const userInitialBalance = `1000.0000 ${symbol}`
  const tokenBytes = no0x(
    ethers.zeroPadValue(
      ethers.toBeHex(getSymbolCodeRaw(`0.0000 ${symbol}`).toString()),
      32,
    ),
  )

  const TABLE_STORAGE = 'storage'
  const FEE_BASIS_POINTS = 1750
  const FEE_BASIS_POINTS_DIVISOR = 1000000

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
  const feemanager = 'feemanager'

  before(async () => {
    blockchain.createAccounts(user, evil, issuer, bridge, recipient, feemanager)
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
          minFee,
        ])
        .send(active(adapter.account))

      await adapter.contract.actions
        .setfeemanagr([feemanager])
        .send(active(adapter.account))

      const row = getSingletonInstance(adapter.contract, 'regadapter')

      const storage = getSingletonInstance(adapter.contract, TABLE_STORAGE)

      expect(row).to.be.deep.equal({
        token: token.account,
        token_symbol: precision4(token.symbol),
        token_bytes: token.bytes,
        xerc20: xerc20.account,
        xerc20_symbol: precision4(xerc20.symbol),
        min_fee: minFee,
      })

      expect(row).to.be.deep.equal({
        token: token.account,
        token_symbol: precision4(token.symbol),
        token_bytes: token.bytes,
        xerc20: xerc20.account,
        xerc20_symbol: precision4(xerc20.symbol),
        min_fee: minFee,
      })

      expect(storage).be.deep.equal({
        nonce: 0,
        feesmanager: feemanager,
      })
    })
  })

  describe('adapter::swap', () => {
    it('Should revert when calling the swap function directly', async () => {
      const nonce = 3
      const eventBytes = '00000666'
      const action = adapter.contract.actions
        .swap([nonce, eventBytes])
        .send(active(evil))

      await expectToThrow(action, errors.AUTH_MISSING(adapter.account))
    })

    it('Should swap correctly', async () => {
      const data = ''
      const recipient = '0x68bbed6a47194eff1cf514b50ea91895597fc91e'
      const destinationChainId = ethers.zeroPadValue('0x01', 32)
      const memo = getSwapMemo(user, destinationChainId, recipient, data)
      const amount = '10.0000'
      const quantity = `${amount} ${symbol}`

      const before = getAccountsBalances(
        [user, lockbox.account, adapter.account, feemanager],
        [token, xerc20],
      )

      before.storage = getSingletonInstance(adapter.contract, TABLE_STORAGE)

      await token.contract.actions
        .transfer([user, adapter.account, quantity, memo])
        .send(active(user))

      const after = getAccountsBalances(
        [user, lockbox.account, adapter.account, feemanager],
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

      const intFees = (
        (parseInt(amount) * FEE_BASIS_POINTS) /
        FEE_BASIS_POINTS_DIVISOR
      ).toFixed(4)

      const fees = `${intFees} ${xerc20.symbol}`

      expect(
        substract(
          after.feemanager[xerc20.symbol],
          before.feemanager[xerc20.symbol],
        ).toString(),
      ).to.be.equal(fees)

      expect(after.storage.nonce).to.be.equal(before.storage.nonce + 1)

      const possibleSwap = prettyTrace(R.last(blockchain.executionTraces))
      expect(possibleSwap['Contract']).to.be.equal(adapter.account)
      expect(possibleSwap['Action']).to.be.equal('swap')
      expect(possibleSwap['Inline']).to.be.equal(true)
      expect(possibleSwap['Notification']).to.be.equal(false)
      expect(possibleSwap['First Receiver']).to.be.equal(adapter.account)
      expect(possibleSwap['Sender']).to.be.equal(adapter.account)

      const eventBytes = getEventBytes(adapter.contract)
      const expectedEventBytes =
        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000746b6e2e746f6b656e00000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000008a88f6dc465640000000000000000000000000000000000000000000000000000000000075736572000000000000000000000000000000000000000000000000000000000000002a307836386262656436613437313934656666316366353134623530656139313839353539376663393165'
      expect(eventBytes).to.be.equal(expectedEventBytes)

      offset = 0
      const nonce = getXbytesHex(eventBytes, offset, 32)
      offset += 32
      const swapToken = getXbytesHex(eventBytes, offset, 32)
      offset += 32
      const destChainId = getXbytesHex(eventBytes, offset, 32)
      offset += 32
      const netAmount = getXbytesHex(eventBytes, offset, 32)
      offset += 32
      const swapSender = getXbytesHex(eventBytes, offset, 32)
      offset += 32
      const recipientLen = getXbytesHex(eventBytes, offset, 32)
      offset += 32
      const swapRecipient = getXbytesHex(
        eventBytes,
        offset,
        parseInt(recipientLen, 16),
      )
      offset += parseInt(recipientLen, 16)
      const userData = eventBytes.slice(offset * 2, eventBytes.length)

      const expectedAmount = (parseInt(amount) - intFees) * 10 ** 18
      expect(parseInt(nonce)).to.be.equal(before.storage.nonce)
      expect(removeNullChars(hexToString(swapToken))).to.be.equal(token.account)
      expect(destChainId).to.be.equal(destinationChainId.slice(2))
      expect(parseInt(netAmount, 16)).to.be.equal(expectedAmount)
      expect(removeNullChars(hexToString(swapSender))).to.be.equal(user)
      expect(removeNullChars(hexToString(swapRecipient))).to.be.equal(recipient)
      expect(removeNullChars(hexToString(userData))).to.be.equal(data)
    })

    // TODO: test adduserdata + swap actions in
    // succession once the above is fixed
    // it('Should swap with userdata', async () => {})
  })

  // describe('adapter::settle', () => {
  //   it('Should settle the operation properly and send userdata', async () => {
  //     const quantity = `10.000000 TKN`
  //     const normalizedAmount = ethers
  //       .parseUnits(Asset.from(quantity).units.toString(), 18)
  //       .toString()

  //     const operation = getOperationSample({
  //       amount: normalizedAmount,
  //     })

  //     const metadata = getMetadataSample()

  //     const before = getAccountsBalances(
  //       [user, recipient, lockbox.account, adapter.account],
  //       [token, xerc20],
  //     )

  //     const compressed = Uint8Array.from(, 16
  //       Buffer.from(
  //         '0380472f799469d9af8790307a022802785c2b1e2f9c0930bdf9bafe193245e7a3',
  //         'hex',
  //       ),
  //     )
  //     const pubKey = PublicKey.from({ type: 'K1', compressed })
  //     await adapter.contract.actions
  //       .settee([pubKey, attestation])
  //       .send(active(adapter.account))

  //     const normalizedOriginChainId = hexStringToBytes('0000000000000000000000000000000000000000000000000000000000000001')
  //     const normalizedOriginAdapter = hexStringToBytes('000000000000000000000000cc9676b9bf25ce45a3a5f88205239afddecf1bc7')
  //     const normalizeTopicZero = hexStringToBytes('9b706941b48091a1c675b439064f40b9d43c577d9c7134cce93179b9b0bf2a52')

  //     await adapter.contract.actions
  //       .setemitter([normalizedOriginChainId, normalizedOriginAdapter])
  //       .send(active(adapter.account))

  //     await adapter.contract.actions
  //       .settopiczero([normalizedOriginChainId, normalizeTopicZero])
  //       .send(active(adapter.account))

  //     await adapter.contract.actions
  //       .settle([user, operation, metadata])
  //       .send(active(user))

  //     const after = getAccountsBalances(
  //       [user, recipient, lockbox.account, adapter.account],
  //       [token, xerc20],
  //     )

  //     console.log(before)

  //     console.log(adapter.contract.bc.console)

  //     expect(
  //       substract(
  //         after[recipient][token.symbol],
  //         before[recipient][token.symbol],
  //       ).toString(),
  //     ).to.be.equal(quantity)

  //     expect(
  //       substract(
  //         after[recipient][xerc20.symbol],
  //         before[recipient][xerc20.symbol],
  //       ).toString(),
  //     ).to.be.equal(quantity)

  //     expect(
  //       substract(
  //         before[lockbox.account][token.symbol],
  //         after[lockbox.account][token.symbol],
  //       ).toString(),
  //     ).to.be.equal(quantity)

  //     expect(after[lockbox.account][xerc20.symbol]).to.be.equal(
  //       `0.0000 ${xerc20.symbol}`,
  //     )

  //     expect(after[adapter.account][token.symbol]).to.be.equal(
  //       `0.0000 ${token.symbol}`,
  //     )
  //     expect(after[adapter.account][xerc20.symbol]).to.be.equal(
  //       `0.0000 ${xerc20.symbol}`,
  //     )
  //   })

  // it('Should send userdata to a receiver contract', async () => {
  //   const quantity = `1.0000 ${token.symbol}`
  //   const normalizedAmount = ethers
  //     .parseUnits(Asset.from(quantity).units.toString(), 18)
  //     .toString()

  //   const metadata = getMetadataSample()
  //   const operation = getOperationSample({
  //     amount: normalizedAmount,
  //     data: 'c0ffeec0ffeec0ffee',
  //     recipient: receiver.account,
  //   })

  //   const before = getAccountsBalances([receiver.account], [token, xerc20])

  //   // Fill in some tokens as collateral
  //   await token.contract.actions
  //     .transfer([user, lockbox.account, quantity, ''])
  //     .send(active(user))

  //   await adapter.contract.actions
  //     .settle([user, operation, metadata])
  //     .send(active(user))

  //   const after = getAccountsBalances([receiver.account], [token, xerc20])
  //   const receiverResults = receiver.contract.tables
  //     .results(getAccountCodeRaw(receiver.account))
  //     .getTableRow(0n)

  //   expect(
  //     substract(
  //       after[receiver.account][token.symbol],
  //       before[receiver.account][token.symbol],
  //     ).toString(),
  //   ).to.be.equal(quantity)

  //   expect(receiverResults).to.be.deep.equal({
  //     id: 0,
  //     data: operation.data,
  //   })
  // })
  // })
})
