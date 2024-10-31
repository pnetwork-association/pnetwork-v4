const { expect } = require('chai')
const { Blockchain, expectToThrow, mintTokens } = require('@eosnetwork/vert')
const { deploy } = require('./utils/deploy')
const { Asset, Bytes, PublicKey } = require('@wharfkit/antelope')
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
const { getEventBytes, hexStringToBytes } = require('./utils/bytes-utils')
const { substract, no0x } = require('./utils/wharfkit-ext')
const { getAccountsBalances } = require('./utils/get-token-balance')
const { getEvmPeginMetadataSample, getEvmPeginMetadataWrongContext, getEvmPeginMetadataSampleWrongSignature, getEvmPeginMetadataSampleWithData } = require('./utils/get-metadata-sample')
const { getEvmPeginOperationSample, getEvmPeginOperationSampleWithData } = require('./utils/get-operation-sample')
const errors = require('./utils/errors')

const ethers = require('ethers')

const getSwapMemo = (sender, destinationChainId, recipient, data) =>
  `${sender},${destinationChainId},${recipient},${R.isEmpty(data) ? '0' : '1'}`

const attestation = 'deadbeef'

describe('Adapter EVM -> EOS testing', () => {
  const symbol = 'TST'
  const minFee = `0.00180000 X${symbol}`
  const precision4 = precision(4)
  const precision6 = precision(8)
  const precision18 = precision(18)
  const maxSupply = '500000000.00000000'
  const tokenMaxSupply = '500000000.000000000000000000'
  const userInitialBalance = `1000.00000000 ${symbol}`
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
    bytes: '000000000000000000000000e58cbe144dd5556c84874dec1b3f2d0d6ac45f1b', // eth address bytes representation
    contract: null,
  }
  const wrongToken = {
    symbol: 'WRG',
    account: 'wrg.token',
    maxSupply: `${maxSupply} WRG`,
    bytes: no0x(
      ethers.zeroPadValue(
        ethers.toBeHex(getSymbolCodeRaw('0.0000 WRG').toString()),
        32,
      ),
    ),
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
  const recipient = 'eosrecipient'
  const feemanager = 'feemanager'

  before(async () => {
    blockchain.createAccounts(user, evil, issuer, bridge, recipient, feemanager)
    lockbox.contract = deploy(
      blockchain,
      lockbox.account,
      'contracts/build/lockbox',
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
    await xerc20.contract.actions
      .create([issuer, xerc20.maxSupply])
      .send(active(xerc20.account))

    const mintingLimit = `1000.00000000 ${xerc20.symbol}`
    const burningLimit = `600.00000000 ${xerc20.symbol}`

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
          precision6(xerc20.symbol),
          '',
          precision18(token.symbol),
          token.bytes,
          minFee,
        ])
        .send(active(adapter.account))

      await adapter.contract.actions
        .setfeemanagr([feemanager])
        .send(active(adapter.account))

      const row = adapter.contract.tables
        .regadapter(getAccountCodeRaw(adapter.account))
        .getTableRow(getSymbolCodeRaw(token.maxSupply))

      const storage = getSingletonInstance(adapter.contract, TABLE_STORAGE)

      const compressed = Uint8Array.from(
        Buffer.from(
          '0380472f799469d9af8790307a022802785c2b1e2f9c0930bdf9bafe193245e7a3',
          'hex',
        ),
      )
      const pubKey = PublicKey.from({ type: 'K1', compressed })
      await adapter.contract.actions
        .settee([pubKey, attestation])
        .send(active(adapter.account))
      
      const tee = getSingletonInstance(adapter.contract, 'tee')

      expect(tee.key).to.be.equal(pubKey.toString())

      const originChainId = '0000000000000000000000000000000000000000000000000000000000000001'
      const originAdapter = '000000000000000000000000a899118f4bccb62f8c6a37887a4f450d8a4e92e0'
      const topicZero = '66756e6473206172652073616675207361667520736166752073616675202e2e'
      const normalizedOriginChainId = hexStringToBytes(originChainId)
      const normalizedOriginAdapter = hexStringToBytes(originAdapter)
      const normalizeTopicZero = hexStringToBytes(topicZero)
      
      await adapter.contract.actions
      .setemitter([normalizedOriginChainId, normalizedOriginAdapter])
      .send(active(adapter.account))

      await adapter.contract.actions
        .settopiczero([normalizedOriginChainId, normalizeTopicZero])
        .send(active(adapter.account))
      
      const emitterRow = adapter.contract.tables
        .mappings(getAccountCodeRaw(adapter.account))//.getTableRows()
        .getTableRow(BigInt('0x' + originChainId.slice(-16)))
      
      expect(emitterRow.chain_id).to.be.equal(originChainId)
      expect(emitterRow.emitter).to.be.equal(originAdapter)
      expect(emitterRow.topic_zero).to.be.equal(topicZero)

      expect(row).to.be.deep.equal({
        token: '',
        token_symbol: precision18(token.symbol),
        token_bytes: token.bytes,
        xerc20: xerc20.account,
        xerc20_symbol: precision6(xerc20.symbol),
        min_fee: minFee,
      })

      expect(storage).be.deep.equal({
        nonce: 0,
        feesmanager: feemanager,
      })
    })
  })

  describe('adapter::settle', () => {
    it('Should reject if adapter and token do not match', async () => {
      const operation = getEvmPeginOperationSample()
      const metadata = getEvmPeginMetadataSample()

      const action = adapter.contract.actions
        .settle([user, {...operation, token: wrongToken.bytes}, metadata])
        .send(active(user))

      await expectToThrow(action, errors.INVALID_TOKEN)
    })

    it('Should reject if context is not correct', async () => {
      const operation = getEvmPeginOperationSample()
      const metadata = getEvmPeginMetadataWrongContext()

      const action = adapter.contract.actions
        .settle([user, operation, metadata])
        .send(active(user))

      await expectToThrow(action, errors.UNEXPECTED_CONTEXT)
    })

    it('Should reject if signature is invalid', async () => {
      const operation = getEvmPeginOperationSample()
      const metadata = getEvmPeginMetadataSampleWrongSignature()

      const action = adapter.contract.actions
        .settle([user, operation, metadata])
        .send(active(user))

      await expectToThrow(action, errors.INVALID_SIGNATURE)
    })

    it('Should settle the operation properly', async () => {
      const quantity = `5.87190615 TST`
      const xquantity = '5.87190615 XTST'
      const normalizedAmount = ethers
        .parseUnits(Asset.from(quantity).value.toString(), 18)
        .toString()

      const operation = getEvmPeginOperationSample({
        amount: normalizedAmount,
      })

      const metadata = getEvmPeginMetadataSample()

      const before = getAccountsBalances(
        [user, recipient, adapter.account],
        [xerc20],
      )

      await adapter.contract.actions
        .settle([user, operation, metadata])
        .send(active(user))
        
      const after = getAccountsBalances(
        [user, recipient, adapter.account],
        [xerc20],
      )

      expect(
          after[recipient][xerc20.symbol],
      ).to.be.equal(xquantity)

      expect(after[adapter.account][xerc20.symbol]).to.be.equal(
        `0.0000 ${xerc20.symbol}`,
      )
    })

    it('Should settle the operation properly and send userdata', async () => {
      const quantity = `0.099924825 TST`
      const xquantity = '0.09992482 XTST'
      const normalizedAmount = ethers
        .parseUnits(Asset.from(quantity).value.toString(), 18)
        .toString()
      const xquantityAsset = Asset.from(xquantity)

      const operation = getEvmPeginOperationSampleWithData({
        amount: normalizedAmount,
      })

      const metadata = getEvmPeginMetadataSampleWithData()

      const before = getAccountsBalances(
        [user, recipient, adapter.account],
        [xerc20],
      )
      const beforeAsset = Asset.from(before[recipient][xerc20.symbol])

      await adapter.contract.actions
        .settle([user, operation, metadata])
        .send(active(user))

      const after = getAccountsBalances(
        [user, recipient, adapter.account],
        [xerc20],
      )

      expect(
          after[recipient][xerc20.symbol],
      ).to.be.equal(`${xquantityAsset.value + beforeAsset.value} XTST`)

      expect(after[adapter.account][xerc20.symbol]).to.be.equal(
        `0.0000 ${xerc20.symbol}`,
      )
    })
  })
})
