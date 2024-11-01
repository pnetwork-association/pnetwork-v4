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

const getSwapMemo = (sender, destinationChainId, recipient, data) =>
  `${sender},${destinationChainId},${recipient},${R.isEmpty(data) ? '0' : '1'}`

const attestation = 'deadbeef'

describe('Adapter EVM -> EOS testing', () => {
  const symbol = 'TST'
  const maxSupply = '500000000'
  const evmPrecision = 18
  const xerc20Precision = 8

  const TABLE_STORAGE = 'storage'
  const FEE_BASIS_POINTS = 1750
  const FEE_BASIS_POINTS_DIVISOR = 1000000

  // infos of the underlying token
  const evmUnderlyingToken = {
    symbol: symbol,
    precision: evmPrecision, // this should be the actual precision of the underlying token
    account: '',
    maxSupply: `${trimPrecision(maxSupply, xerc20Precision)} ${symbol}`, // use xerc20Precision to avoid overflow
    bytes: evmOperationSamples.pegin.token,
    contract: null,
  }

  const xerc20 = {
    symbol: `X${symbol}`,
    precision: xerc20Precision, // different from the underlying token - only uint64 is supported by Asset type
    account: `x${symbol.toLowerCase()}.token`,
    maxSupply: `${trimPrecision(maxSupply, xerc20Precision)} X${symbol}`,
    minFee: `${trimPrecision('0.0018', xerc20Precision)} X${symbol}`,
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

    const mintingLimit = `${trimPrecision('1000', xerc20Precision)} ${xerc20.symbol}`
    const burningLimit = `${trimPrecision('600', xerc20Precision)} ${xerc20.symbol}`

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
          precision(xerc20.precision, xerc20.symbol),
          evmUnderlyingToken.account,
          precision(evmUnderlyingToken.precision, evmUnderlyingToken.symbol),
          evmUnderlyingToken.bytes,
          xerc20.minFee,
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
        xerc20: xerc20.account,
        xerc20_symbol: precision(xerc20.precision, xerc20.symbol),
        min_fee: xerc20.minFee,
      })

      expect(storage).be.deep.equal({
        nonce: 0,
        feesmanager: feemanager,
      })
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
      const xquantity = `${trimPrecision(amounts.pegin, xerc20.precision)} XTST`
      const normalizedAmount = ethers
        .parseUnits(Asset.from(quantity).value.toString(), 18)
        .toString()

      const before = getAccountsBalances(
        [user, recipient, adapter.account, feemanager],
        [xerc20],
      )

      await adapter.contract.actions
        .settle([user, operation, metadata])
        .send(active(user))
        
      const after = getAccountsBalances(
        [user, recipient, adapter.account, feemanager],
        [xerc20],
      )

      expect(
          after[recipient][xerc20.symbol],
      ).to.be.equal(xquantity)

      expect(after[adapter.account][xerc20.symbol]).to.be.equal(
        `0.0000 ${xerc20.symbol}`,
      )

      expect(
        before[feemanager][xerc20.symbol]
      ).to.be.equal(after[feemanager][xerc20.symbol])

    })

    it('Should settle the operation properly and send userdata', async () => {
      const operation = evmOperationSamples.peginWithUserData
      const metadata = evmMetadataSamples.peginWithUserData

      const quantity = `${amounts.peginWithUserData} TST`
      const xquantity = `${trimPrecision(amounts.peginWithUserData, xerc20.precision)} XTST`
      const normalizedAmount = ethers
        .parseUnits(Asset.from(quantity).value.toString(), 18)
        .toString()
      const xquantityAsset = Asset.from(xquantity)

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
