const { expect } = require('chai')
const { Blockchain, expectToThrow, mintTokens } = require('@eosnetwork/vert')
const { deploy } = require('./utils/deploy')
const { Asset } = require('@wharfkit/antelope')
const R = require('ramda')
const {
  active,
  precision,
  getAccountCodeRaw,
  getSymbolCodeRaw,
  getSingletonInstance,
} = require('./utils/eos-ext')
const { hexStringToBytes } = require('./utils/bytes-utils')
const { no0x } = require('./utils/wharfkit-ext')
const { getAccountsBalances } = require('./utils/get-token-balance')
const errors = require('./utils/errors')

const ethers = require('ethers')
const { evmOperationSamples, amounts, evmTopicZero, evmAdapter } = require('./samples/evm-operations')
const { evmMetadataSamples, teePubKey } = require('./samples/evm-metadata')
const { adjustPrecision } = require('./utils/precision-utils')

const attestation = 'deadbeef'
const NULL_KEY = 'PUB_K1_11111111111111111111111111111111149Mr2R' // null initialization of public_key() CDT function

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
    maxSupply: `${adjustPrecision(maxSupply, localprecision)} ${symbol}`,
    bytes: 'aa',
    contract: null,
  }

  // infos of the underlying token
  const evmUnderlyingToken = {
    symbol: evmTokenSymbol,
    precision: evmPrecision, // this should be the actual precision of the underlying token
    account: '',
    maxSupply: `${adjustPrecision(maxSupply, fromEvmXerc20Precision)} ${evmTokenSymbol}`, // use fromEvmXerc20Precision to avoid overflow
    bytes: evmOperationSamples.pegin.token,
    contract: null,
  }

  const xerc20 = {
    symbol: `X${symbol}`,
    precision: localprecision,
    account: `x${symbol.toLowerCase()}.token`,
    maxSupply: `${adjustPrecision(maxSupply, localprecision)} X${symbol}`,
    minFee: `${adjustPrecision('0.0018', localprecision)} X${symbol}`,
    contract: null,
  }

  const fromEvmXerc20 = {
    symbol: `X${evmTokenSymbol}`,
    precision: fromEvmXerc20Precision, // different from the underlying token - only uint64 is supported by Asset type
    account: `x${evmTokenSymbol.toLowerCase()}.token`,
    maxSupply: `${adjustPrecision(maxSupply, fromEvmXerc20Precision)} X${evmTokenSymbol}`,
    minFee: `${adjustPrecision('0.0018', fromEvmXerc20Precision)} X${evmTokenSymbol}`,
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

  const notInitAdapter = {
    account: 'adapter2',
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
    notInitAdapter.contract = deploy(
      blockchain,
      notInitAdapter.account,
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

    const mintingLimit = `${adjustPrecision('1000', fromEvmXerc20Precision)} ${fromEvmXerc20.symbol}`
    const burningLimit = `${adjustPrecision('600', fromEvmXerc20Precision)} ${fromEvmXerc20.symbol}`

    await fromEvmXerc20.contract.actions
      .setlimits([adapter.account, mintingLimit, burningLimit])
      .send(active(fromEvmXerc20.account))
  }

  describe('adapter::create', () => {
    it('Should throw if called by not authorized account', async () => {
      const action = adapter.contract.actions
        .create([
          fromEvmXerc20.account,
          precision(fromEvmXerc20.precision, fromEvmXerc20.symbol),
          evmUnderlyingToken.account,
          precision(evmUnderlyingToken.precision, evmUnderlyingToken.symbol),
          evmUnderlyingToken.bytes,
          fromEvmXerc20.minFee,
        ])
        .send(active(evil))

        await expectToThrow(action, errors.AUTH_MISSING(adapter.account))
    })
    
    it('Should throw if tokenByte size is not 32', async () => {
      try {
      await adapter.contract.actions
        .create([
          fromEvmXerc20.account,
          precision(fromEvmXerc20.precision, fromEvmXerc20.symbol),
          localToken.account,
          precision(localToken.precision, localToken.symbol),
          localToken.bytes,
          fromEvmXerc20.minFee,
        ])
        .send(active(adapter.account))

        fail()
      } catch (_err) {
        expect(_err.underlyingError.toString()).to.be.equal(`Error: Checksum size mismatch, expected 32 bytes got ${localToken.bytes.length / 2}`)
      }
    })

    it('Should throw if xERC20 account does not exist', async () => {
      const action = adapter.contract.actions
        .create([
          'undeployed',
          precision(fromEvmXerc20.precision, fromEvmXerc20.symbol),
          evmUnderlyingToken.account,
          precision(evmUnderlyingToken.precision, evmUnderlyingToken.symbol),
          evmUnderlyingToken.bytes,
          fromEvmXerc20.minFee,
        ])
        .send(active(adapter.account))

      await expectToThrow(action, 'eosio_assert: xERC20 account does not exist')
    })

    it('Should throw if minFee precision does not match', async () => {
      const action = adapter.contract.actions
        .create([
          fromEvmXerc20.account,
          precision(fromEvmXerc20.precision, fromEvmXerc20.symbol),
          evmUnderlyingToken.account,
          precision(evmUnderlyingToken.precision, evmUnderlyingToken.symbol),
          evmUnderlyingToken.bytes,
          '12, XTST',
        ])
        .send(active(adapter.account))

      await expectToThrow(action, 'eosio_assert: invalid minimum fee symbol')
    })

    it('Should throw if minFee symbol does not match', async () => {
      const action = adapter.contract.actions
        .create([
          fromEvmXerc20.account,
          precision(fromEvmXerc20.precision, fromEvmXerc20.symbol),
          evmUnderlyingToken.account,
          precision(evmUnderlyingToken.precision, evmUnderlyingToken.symbol),
          evmUnderlyingToken.bytes,
          `${adjustPrecision('0.0018', fromEvmXerc20Precision)} XYYY`,
        ])
        .send(active(adapter.account))

      await expectToThrow(action, 'eosio_assert: invalid minimum fee symbol')
    })

    it('Should throw if xERC20 symbol is not found on xERC20 account', async () => {
      const action = adapter.contract.actions
        .create([
          fromEvmXerc20.account,
          precision(fromEvmXerc20.precision, 'XYYY'),
          evmUnderlyingToken.account,
          precision(evmUnderlyingToken.precision, evmUnderlyingToken.symbol),
          evmUnderlyingToken.bytes,
          fromEvmXerc20.minFee,
        ])
        .send(active(adapter.account))

      await expectToThrow(action, 'eosio_assert: invalid minimum fee symbol')
    })


    //TODO deploy local token
    // it('Should throw if token is local and token symbol is not found on xERC20 account', async () => {
    //   const action = adapter.contract.actions
    //     .create([
    //       fromEvmXerc20.account,
    //       precision(fromEvmXerc20.precision, fromEvmXerc20.symbol),
    //       evmUnderlyingToken.account,
    //       precision(evmUnderlyingToken.precision, 'XYYY'),
    //       evmUnderlyingToken.bytes,
    //       fromEvmXerc20.minFee,
    //     ])
    //     .send(active(adapter.account))

    //   await expectToThrow(action, 'eosio_assert: invalid minimum fee symbol')
    // })
    // it('Should throw if token is local and xERC20 precision do not match it', async () => {
    //   const action = adapter.contract.actions
    //     .create([
    //       fromEvmXerc20.account,
    //       precision(fromEvmXerc20.precision, fromEvmXerc20.symbol),
    //       'token',
    //       precision(evmUnderlyingToken.precision, evmUnderlyingToken.symbol),
    //       evmUnderlyingToken.bytes,
    //       fromEvmXerc20.minFee,
    //     ])
    //     .send(active(adapter.account))

    //   await expectToThrow(action, 'eosio_assert: invalid minimum fee symbol')
    // })
    // it('Should throw if token is local and token account does not exist', async () => {
    //   const action = adapter.contract.actions
    //     .create([
    //       'undeployed',
    //       precision(fromEvmXerc20.precision, fromEvmXerc20.symbol),
    //       evmUnderlyingToken.account,
    //       precision(evmUnderlyingToken.precision, evmUnderlyingToken.symbol),
    //       evmUnderlyingToken.bytes,
    //       fromEvmXerc20.minFee,
    //     ])
    //     .send(active(adapter.account))

    //   await expectToThrow(action, 'eosio_assert: xERC20 account does not exist')
    // })

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

      const row = adapter.contract.tables
        .regadapter(getAccountCodeRaw(adapter.account))
        .getTableRow(getSymbolCodeRaw(evmUnderlyingToken.maxSupply))
      const storage = getSingletonInstance(adapter.contract, TABLE_STORAGE)      
      const tee = getSingletonInstance(adapter.contract, 'tee')      
      const mappingsRow = adapter.contract.tables
        .mappings(getAccountCodeRaw(adapter.account))
        .getTableRows()
      
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
        feesmanager: '',
      })
      expect(tee).to.be.deep.equal({
        key: NULL_KEY,
        attestation: '',
      })
      expect(mappingsRow).to.be.deep.equal([])
    })

    it('Should throw if already created', async () => {
      const action = adapter.contract.actions
        .create([
          fromEvmXerc20.account,
          precision(fromEvmXerc20.precision, fromEvmXerc20.symbol),
          evmUnderlyingToken.account,
          precision(evmUnderlyingToken.precision, evmUnderlyingToken.symbol),
          evmUnderlyingToken.bytes,
          fromEvmXerc20.minFee,
        ])
        .send(active(adapter.account))
      
      await expectToThrow(action, 'eosio_assert: token already registered')
    })
  })

  describe('adapter::setfeemanagr', () => {
    it('Should throw if called by not authorized account', async () => {
      const action = adapter.contract.actions
        .setfeemanagr([feemanager])
        .send(active(evil))

        await expectToThrow(action, errors.AUTH_MISSING(adapter.account))
    })

    it('Should throw if adapter is not initialized', async () => {
      const action = notInitAdapter.contract.actions
        .setfeemanagr([feemanager])
        .send(active(notInitAdapter.account))

      await expectToThrow(action, 'eosio_assert: adapter contract not initialized')
    })

    it('Should set the feemanager correctly', async () => {
      await adapter.contract.actions
        .setfeemanagr([user])
        .send(active(adapter.account))

      const storage = getSingletonInstance(adapter.contract, TABLE_STORAGE)

      expect(storage).be.deep.equal({
        nonce: 0,
        feesmanager: user,
      })
    })

    it('Should update the feemanager correctly', async () => {
      await adapter.contract.actions
        .setfeemanagr([feemanager])
        .send(active(adapter.account))

      const storage = getSingletonInstance(adapter.contract, TABLE_STORAGE)

      expect(storage).be.deep.equal({
        nonce: 0,
        feesmanager: feemanager,
      })
    })
  })

  describe('adapter::settee', () => {
    it('Should throw if called by not authorized account', async () => {
      const action = adapter.contract.actions
        .settee([teePubKey, attestation])
        .send(active(evil))

        await expectToThrow(action, errors.AUTH_MISSING(adapter.account))
    })

    it('Should throw if adapter is not initialized', async () => {
      const action = notInitAdapter.contract.actions
        .settee([teePubKey, attestation])
        .send(active(notInitAdapter.account))

      await expectToThrow(action, 'eosio_assert: adapter contract not initialized')
    })

    it('Should set the tee pubKey and attestation correctly', async () => {
      await adapter.contract.actions
        .settee([teePubKey, attestation])
        .send(active(adapter.account))

      const tee = getSingletonInstance(adapter.contract, 'tee')

      expect(tee.key).to.be.equal(teePubKey.toString())
      expect(tee.attestation).to.be.equal(attestation)
    })
  })

  describe('adapter::setemitter', () => {
    it('Should throw if called by not authorized account', async () => {
      const originChainId = evmOperationSamples.pegin.originChainId
      const action = adapter.contract.actions
        .setemitter([hexStringToBytes(originChainId), hexStringToBytes(evmAdapter)])
        .send(active(evil))

        await expectToThrow(action, errors.AUTH_MISSING(adapter.account))
    })

    it('Should throw if emitter is not 32 bytes', async () => {
      const originChainId = evmOperationSamples.pegin.originChainId
      const action = adapter.contract.actions
        .setemitter([hexStringToBytes(originChainId), 'BCF063A9eB18bc3C6eB005791C61801B7cB16fe4'])
        .send(active(adapter.account))

      await expectToThrow(action, 'eosio_assert: expected 32 bytes emitter')
    })

    it('Should throw if origin chain id is not 32 bytes', async () => {
      const action = adapter.contract.actions
        .setemitter([1, hexStringToBytes(evmAdapter)])
        .send(active(adapter.account))

      await expectToThrow(action, 'eosio_assert: expected 32 bytes chain_id')
    })

    it('Should set the emitter and chainId correctly', async () => {
      const originChainId = evmOperationSamples.pegin.originChainId
      await adapter.contract.actions
        .setemitter([hexStringToBytes(originChainId), hexStringToBytes(evmTopicZero)])
        .send(active(adapter.account))
      
      const emitterRow = adapter.contract.tables
        .mappings(getAccountCodeRaw(adapter.account))
        .getTableRow(BigInt('0x' + originChainId.slice(-16)))
      
      expect(emitterRow.chain_id).to.be.equal(originChainId)
      expect(emitterRow.emitter).to.be.equal(evmTopicZero)
    })

    it('Should update the emitter correctly', async () => {
      const originChainId = evmOperationSamples.pegin.originChainId
      await adapter.contract.actions
        .setemitter([hexStringToBytes(originChainId), hexStringToBytes(evmAdapter)])
        .send(active(adapter.account))
      
      const emitterRow = adapter.contract.tables
        .mappings(getAccountCodeRaw(adapter.account))
        .getTableRow(BigInt('0x' + originChainId.slice(-16)))
      
      expect(emitterRow.chain_id).to.be.equal(originChainId)
      expect(emitterRow.emitter).to.be.equal(evmAdapter)
    })
  })

  describe('adapter::settopiczero', () => {
    it('Should throw if called by not authorized account', async () => {
      const originChainId = evmOperationSamples.pegin.originChainId        
      const action = adapter.contract.actions
        .settopiczero([hexStringToBytes(originChainId), hexStringToBytes(evmTopicZero)])
        .send(active(evil))

        await expectToThrow(action, errors.AUTH_MISSING(adapter.account))
    })

    it('Should throw if emitter is not 32 bytes', async () => {
      const originChainId = evmOperationSamples.pegin.originChainId
      const action = adapter.contract.actions
        .settopiczero([hexStringToBytes(originChainId), 'a899118f4bccb62f8c6a37887a4f450d8a4e92e0'])
        .send(active(adapter.account))

      await expectToThrow(action, 'eosio_assert: expected 32 bytes emitter')
    })

    it('Should throw if origin chain id is not 32 bytes', async () => {
      const action = adapter.contract.actions
        .settopiczero([1, hexStringToBytes(evmTopicZero)])
        .send(active(adapter.account))

      await expectToThrow(action, 'eosio_assert: expected 32 bytes chain_id')
    })

    it('Should set the topic0 and chainId correctly', async () => {
      const originChainId = no0x(ethers.zeroPadValue('0x02',32))
      await adapter.contract.actions
        .settopiczero([hexStringToBytes(originChainId), hexStringToBytes(evmTopicZero)])
        .send(active(adapter.account))
      
      const emitterRow = adapter.contract.tables
        .mappings(getAccountCodeRaw(adapter.account))
        .getTableRow(BigInt('0x' + originChainId.slice(-16)))
      
      expect(emitterRow.chain_id).to.be.equal(originChainId)
      expect(emitterRow.topic_zero).to.be.equal(evmTopicZero)
    })

    it('Should update the topic0 correctly', async () => {
      const originChainId = evmOperationSamples.pegin.originChainId
      await adapter.contract.actions
        .settopiczero([hexStringToBytes(originChainId), hexStringToBytes(evmTopicZero)])
        .send(active(adapter.account))
      
      const emitterRow = adapter.contract.tables
        .mappings(getAccountCodeRaw(adapter.account))
        .getTableRow(BigInt('0x' + originChainId.slice(-16)))
      
      expect(emitterRow.chain_id).to.be.equal(originChainId)
      expect(emitterRow.topic_zero).to.be.equal(evmTopicZero)
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
      const xquantity = `${adjustPrecision(amounts.pegin, fromEvmXerc20.precision)} XTST`
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
      const xquantity = `${adjustPrecision(amounts.peginWithUserData, fromEvmXerc20.precision)} XTST`
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


      console.log(adapter.contract.bc.console)

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
