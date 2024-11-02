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
const errors = require('./utils/errors')

const ethers = require('ethers')
const { evmOperationSamples, amounts, evmTopicZero, evmAdapter } = require('./samples/evm-operations')
const { evmMetadataSamples, teeCompressedPubKey } = require('./samples/evm-metadata')
const { trimPrecision } = require('./utils/precision-utils')
const { symbolName } = require('typescript')

const getSwapMemo = (sender, destinationChainId, recipient, data) =>
  `${sender},${destinationChainId},${recipient},${R.isEmpty(data) ? '0' : '1'}`

const attestation = 'deadbeef'

describe('Adapter EVM -> EOS testing', () => {
  const symbol = 'TST'
  const evmTokenSymbol = 'TST'
  const maxSupply = '500000000'
  const localprecision = 6
  const evmPrecision = 18
  const fromEvmXerc20Precision = 8

  const TABLE_STORAGE = 'storage'
  const FEE_BASIS_POINTS = 1750
  const FEE_BASIS_POINTS_DIVISOR = 1000000

  const localToken = {
    symbol: symbol,
    precision: localprecision,
    account: `${symbol.toLowerCase()}.token`,
    maxSupply: `${trimPrecision(maxSupply, localprecision)} ${symbol}`,
    bytes: '',
    contract: null,
  }

  // infos of the underlying token
  const evmUnderlyingToken = {
    symbol: evmTokenSymbol,
    precision: evmPrecision, // this should be the actual precision of the underlying token
    account: '',
    maxSupply: `${trimPrecision(maxSupply, fromEvmXerc20Precision)} ${evmTokenSymbol}`, // use fromEvmXerc20Precision to avoid overflow
    bytes: evmOperationSamples.pegin.token,
    contract: null,
  }

  const xerc20 = {
    symbol: `X${symbol}`,
    precision: localprecision,
    account: `x${symbol.toLowerCase()}.token`,
    maxSupply: `${trimPrecision(maxSupply, localprecision)} X${symbol}`,
    minFee: `${trimPrecision('0.0018', localprecision)} X${symbol}`,
    contract: null,
  }

  const fromEvmXerc20 = {
    symbol: `X${evmTokenSymbol}`,
    precision: fromEvmXerc20Precision, // different from the underlying token - only uint64 is supported by Asset type
    account: `x${evmTokenSymbol.toLowerCase()}.token`,
    maxSupply: `${trimPrecision(maxSupply, fromEvmXerc20Precision)} X${evmTokenSymbol}`,
    minFee: `${trimPrecision('0.0018', fromEvmXerc20Precision)} X${evmTokenSymbol}`,
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
    fromEvmXerc20.contract = deploy(
      blockchain,
      fromEvmXerc20.account,
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
    await fromEvmXerc20.contract.actions
      .create([issuer, fromEvmXerc20.maxSupply])
      .send(active(fromEvmXerc20.account))

    const mintingLimit = `${trimPrecision('1000', fromEvmXerc20Precision)} ${fromEvmXerc20.symbol}`
    const burningLimit = `${trimPrecision('600', fromEvmXerc20Precision)} ${fromEvmXerc20.symbol}`

    await fromEvmXerc20.contract.actions
      .setlimits([adapter.account, mintingLimit, burningLimit])
      .send(active(fromEvmXerc20.account))
  }

  describe('adapter::create', () => {
    it('Should create the pair successfully', async () => {
      await setup()

      await adapter.contract.actions
        .create([
          fromEvmXerc20.account,
          precision(fromEvmXerc20.precision, fromEvmXerc20.symbol),
          evmUnderlyingToken.account,
          precision(evmUnderlyingToken.precision, evmUnderlyingToken.symbol),
          evmUnderlyingToken.bytes,
          fromEvmXerc20.minFee,
        ])
        .send(active(adapter.account))

      await adapter.contract.actions
        .setfeemanagr([feemanager])
        .send(active(adapter.account))

      const row = adapter.contract.tables
        .regadapter(getAccountCodeRaw(adapter.account))
        .getTableRow(getSymbolCodeRaw(evmUnderlyingToken.maxSupply))

      const storage = getSingletonInstance(adapter.contract, TABLE_STORAGE)

      const compressed = Uint8Array.from(
        Buffer.from(
          teeCompressedPubKey,
          'hex',
        ),
      )
      const pubKey = PublicKey.from({ type: 'K1', compressed })
      await adapter.contract.actions
        .settee([pubKey, attestation])
        .send(active(adapter.account))
      
      const tee = getSingletonInstance(adapter.contract, 'tee')

      expect(tee.key).to.be.equal(pubKey.toString())

      const originChainId = evmOperationSamples.pegin.originChainId
      const originAdapter = evmAdapter
      const topicZero = evmTopicZero
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
        .mappings(getAccountCodeRaw(adapter.account))
        .getTableRow(BigInt('0x' + originChainId.slice(-16)))
      
      expect(emitterRow.chain_id).to.be.equal(originChainId)
      expect(emitterRow.emitter).to.be.equal(originAdapter)
      expect(emitterRow.topic_zero).to.be.equal(topicZero)

      expect(row).to.be.deep.equal({
        token: '',
        token_symbol: precision(evmUnderlyingToken.precision, evmUnderlyingToken.symbol),
        token_bytes: evmUnderlyingToken.bytes,
        xerc20: fromEvmXerc20.account,
        xerc20_symbol: precision(fromEvmXerc20.precision, fromEvmXerc20.symbol),
        min_fee: fromEvmXerc20.minFee,
      })

      expect(storage).be.deep.equal({
        nonce: 0,
        feesmanager: feemanager,
      })
    })
  })
  
  describe('adapter::swap', () => {
    it('Should swap correctly', async () => {
    
    })
  })

  describe('adapter::settle', () => {
    // -> TODO move under PAM tests
    it('Should reject if adapter and token do not match', async () => {
      const operation = evmOperationSamples.pegin
      const metadata = evmMetadataSamples.pegin

      const action = adapter.contract.actions
        .settle([user, {...operation, token: wrongToken.bytes}, metadata])
        .send(active(user))

      await expectToThrow(action, errors.INVALID_TOKEN)
    })

    it('Should reject if context is not correct', async () => {
      const operation = evmOperationSamples.pegin
      const metadata = evmMetadataSamples.peginWithWrongContext

      const action = adapter.contract.actions
        .settle([user, operation, metadata])
        .send(active(user))

      await expectToThrow(action, errors.UNEXPECTED_CONTEXT)
    })

    it('Should reject if signature is invalid', async () => {
      const operation = evmOperationSamples.pegin
      const metadata = evmMetadataSamples.peginWithWrongSignature

      const action = adapter.contract.actions
        .settle([user, operation, metadata])
        .send(active(user))

      await expectToThrow(action, errors.INVALID_SIGNATURE)
    })
    // <- TODO move under PAM tests

    it('Should settle the operation properly', async () => {
      const operation = evmOperationSamples.pegin
      const metadata = evmMetadataSamples.pegin
      
      const quantity = `${amounts.pegin} TST`
      const xquantity = `${trimPrecision(amounts.pegin, fromEvmXerc20.precision)} XTST`
      const normalizedAmount = ethers
        .parseUnits(Asset.from(quantity).value.toString(), 18)
        .toString()

      const before = getAccountsBalances(
        [user, recipient, adapter.account, feemanager],
        [fromEvmXerc20],
      )

      await adapter.contract.actions
        .settle([user, operation, metadata])
        .send(active(user))
        
      const after = getAccountsBalances(
        [user, recipient, adapter.account, feemanager],
        [fromEvmXerc20],
      )

      expect(
          after[recipient][fromEvmXerc20.symbol],
      ).to.be.equal(xquantity)

      expect(after[adapter.account][fromEvmXerc20.symbol]).to.be.equal(
        `0.0000 ${fromEvmXerc20.symbol}`,
      )

      expect(
        before[feemanager][fromEvmXerc20.symbol]
      ).to.be.equal(after[feemanager][fromEvmXerc20.symbol])

    })

    it('Should settle the operation properly and send userdata', async () => {
      const operation = evmOperationSamples.peginWithUserData
      const metadata = evmMetadataSamples.peginWithUserData

      const quantity = `${amounts.peginWithUserData} TST`
      const xquantity = `${trimPrecision(amounts.peginWithUserData, fromEvmXerc20.precision)} XTST`
      const normalizedAmount = ethers
        .parseUnits(Asset.from(quantity).value.toString(), 18)
        .toString()
      const xquantityAsset = Asset.from(xquantity)

      const before = getAccountsBalances(
        [user, recipient, adapter.account],
        [fromEvmXerc20],
      )
      const beforeAsset = Asset.from(before[recipient][fromEvmXerc20.symbol])

      await adapter.contract.actions
        .settle([user, operation, metadata])
        .send(active(user))

      const after = getAccountsBalances(
        [user, recipient, adapter.account],
        [fromEvmXerc20],
      )

      expect(
          after[recipient][fromEvmXerc20.symbol],
      ).to.be.equal(`${xquantityAsset.value + beforeAsset.value} XTST`)

      expect(after[adapter.account][fromEvmXerc20.symbol]).to.be.equal(
        `0.0000 ${fromEvmXerc20.symbol}`,
      )
    })
  })
})
