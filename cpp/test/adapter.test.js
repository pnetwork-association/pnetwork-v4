const { expect } = require('chai')
const { Blockchain, expectToThrow } = require('@eosnetwork/vert')
const { Asset } = require('@wharfkit/antelope')
const { Symbol } = Asset
const {
  no0x,
  active,
  deploy,
  errors,
  bytes32,
  getSymbolCodeRaw,
  getAccountCodeRaw,
  fromEthersPublicKey,
  getSingletonInstance,
} = require('./utils')
const { toBeHex, stripZerosLeft } = require('ethers')
const {
  Chains,
  Versions,
  Protocols,
  ProofcastEventAttestator,
} = require('@pnetwork/event-attestator')
const { TimePointSec } = require('@wharfkit/antelope')

const TEE_ADDRESS_CHANGE_GRACE_PERIOD_MS = 172800 * 1000
const TABLE_STORAGE = 'storage'
const TABLE_TEE = 'tee'
const TABLE_LOCAL_CHAIN_ID = 'chainid'

describe('Adapter tests', () => {
  const symbol = 'TST'
  const xsymbol = `X${symbol}`
  const maxSupply = 500000000
  const minFee = 0.0018
  const precision = 8
  const symbolPrecision = Symbol.fromParts(symbol, precision)
  const xsymbolPrecision = Symbol.fromParts(xsymbol, precision)

  const blockchain = new Blockchain()

  const user = 'user'
  const evil = 'evil'
  const issuer = 'issuer'
  const bridge = 'bridge'
  const recipient = 'eosrecipient'
  const feemanager = 'feemanager'

  const evmAdapter =
    '000000000000000000000000bcf063a9eb18bc3c6eb005791c61801b7cb16fe4'
  const evmTopicZero =
    '66756e6473206172652073616675207361667520736166752073616675202e2e'
  const EOSChainId =
    'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906'

  const token = {
    symbol,
    account: `${symbol.toLowerCase()}.token`,
    maxSupply: Asset.from(maxSupply, symbolPrecision),
    bytes: no0x(bytes32(toBeHex(String(getSymbolCodeRaw(symbolPrecision))))),
    contract: null,
  }

  const xerc20 = {
    symbol: `${xsymbol}`,
    account: `${xsymbol.toLowerCase()}.token`,
    maxSupply: Asset.from(maxSupply, xsymbolPrecision),
    minFee: Asset.from(minFee, xsymbolPrecision),
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

  const evmEA = new ProofcastEventAttestator({
    version: Versions.V1,
    protocolId: Protocols.Evm,
    chainId: Chains(Protocols.Evm).Mainnet,
  })

  const NULL_KEY = 'PUB_K1_11111111111111111111111111111111149Mr2R'
  const anotherAttestation = 'deadc0de'
  const anotherEventAttestator = new ProofcastEventAttestator()
  const anotherPublicKey = fromEthersPublicKey(
    anotherEventAttestator.signingKey.compressedPublicKey,
  )
  const teePubKey = fromEthersPublicKey(evmEA.signingKey.compressedPublicKey)
  const attestation = ''

  before(() => {
    blockchain.createAccounts(user, evil, issuer, bridge, recipient, feemanager)

    xerc20.contract = deploy(
      blockchain,
      xerc20.account,
      'contracts/build/xerc20.token',
    )

    token.contract = deploy(
      blockchain,
      token.account,
      'contracts/build/eosio.token',
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

  describe('adapter::create', () => {
    it('Should throw if called by not authorized account', async () => {
      const action = adapter.contract.actions
        .create([
          xerc20.account,
          xsymbolPrecision,
          token.account,
          symbolPrecision,
          token.bytes,
          xerc20.minFee,
        ])
        .send(active(evil))

      await expectToThrow(action, errors.AUTH_MISSING(adapter.account))
    })

    it('Should throw if tokenByte size is not 32', async () => {
      const wrongBytes = 'aa'
      try {
        await adapter.contract.actions
          .create([
            xerc20.account,
            xsymbolPrecision,
            token.account,
            symbolPrecision,
            wrongBytes,
            xerc20.minFee,
          ])
          .send(active(adapter.account))

        fail()
      } catch (_err) {
        expect(_err.underlyingError.toString()).to.be.equal(
          `Error: Checksum size mismatch, expected 32 bytes got ${wrongBytes.length / 2}`,
        )
      }
    })

    it('Should throw if xERC20 account does not exist', async () => {
      const wrongAccount = 'undeployed'
      const action = adapter.contract.actions
        .create([
          wrongAccount,
          xsymbolPrecision,
          token.account,
          symbolPrecision,
          token.bytes,
          xerc20.minFee,
        ])
        .send(active(adapter.account))

      await expectToThrow(action, errors.INVALID_ACCOUNT)
    })

    const deployTokenContracts = async () => {
      await xerc20.contract.actions
        .create([issuer, xerc20.maxSupply])
        .send(active(xerc20.account))

      const mintingLimit = Asset.from(1000, xsymbolPrecision)
      const burningLimit = Asset.from(600, xsymbolPrecision)

      await xerc20.contract.actions
        .setlimits([adapter.account, mintingLimit, burningLimit])
        .send(active(xerc20.account))

      await token.contract.actions
        .create([issuer, token.maxSupply])
        .send(active(token.account))
    }

    it('Should throw if minFee precision does not match', async () => {
      await deployTokenContracts()

      const wrongPrecision = precision - 1
      const wrongSymbol = Symbol.fromParts(xsymbol, wrongPrecision)
      const wrongMinFee = Asset.from(minFee, wrongSymbol)
      const action = adapter.contract.actions
        .create([
          xerc20.account,
          xsymbolPrecision,
          token.account,
          symbolPrecision,
          token.bytes,
          wrongMinFee,
        ])
        .send(active(adapter.account))

      await expectToThrow(action, errors.INVALID_MINFEE_SYMBOL)
    })

    it('Should throw if minFee symbol does not match', async () => {
      const wrongSymbol = Symbol.fromParts('WRONG', precision)
      const wrongMinFee = Asset.from(minFee, wrongSymbol)
      const action = adapter.contract.actions
        .create([
          xerc20.account,
          xsymbolPrecision,
          token.account,
          symbolPrecision,
          token.bytes,
          wrongMinFee,
        ])
        .send(active(adapter.account))

      await expectToThrow(action, errors.INVALID_MINFEE_SYMBOL)
    })

    it('Should throw if xERC20 symbol is not found on xERC20 account', async () => {
      const unknownSymbol = 'XXYY'
      const wrongXERC20 = Symbol.fromParts(unknownSymbol, precision)

      const action = adapter.contract.actions
        .create([
          xerc20.account,
          wrongXERC20,
          token.account,
          symbolPrecision,
          token.bytes,
          xerc20.minFee,
        ])
        .send(active(adapter.account))

      await expectToThrow(action, errors.SYMBOL_NOT_FOUND)
    })

    it('Should throw if symbol precision is not correct', async () => {
      const wrongPrecision = precision - 1
      const wrongSymbol = Symbol.fromParts(xsymbol, wrongPrecision)
      const action = adapter.contract.actions
        .create([
          xerc20.account,
          wrongSymbol,
          token.account,
          symbolPrecision,
          token.bytes,
          Asset.from(10, wrongSymbol),
        ])
        .send(active(adapter.account))

      await expectToThrow(action, errors.INVALID_SYMBOL)
    })

    it('Should create the pair successfully', async () => {
      await adapter.contract.actions
        .create([
          xerc20.account,
          xsymbolPrecision,
          token.account,
          symbolPrecision,
          token.bytes,
          xerc20.minFee,
        ])
        .send(active(adapter.account))

      const row = getSingletonInstance(adapter.contract, 'regadapter')
      const storage = getSingletonInstance(adapter.contract, TABLE_STORAGE)
      const tee = getSingletonInstance(adapter.contract, TABLE_TEE)
      const mappingsRow = adapter.contract.tables
        .mappings(getAccountCodeRaw(adapter.account))
        .getTableRows()

      expect(row).to.be.deep.equal({
        token: token.account,
        token_symbol: symbolPrecision.toString(),
        token_bytes: token.bytes,
        xerc20: xerc20.account,
        xerc20_symbol: xsymbolPrecision.toString(),
        min_fee: xerc20.minFee.toString(),
      })
      expect(storage).be.deep.equal({
        nonce: 0,
        feesmanager: '',
      })
      expect(tee).to.be.undefined
      expect(mappingsRow).to.be.deep.equal([])
    })

    it('Should throw if already created', async () => {
      const action = adapter.contract.actions
        .create([
          xerc20.account,
          xsymbolPrecision,
          token.account,
          symbolPrecision,
          token.bytes,
          xerc20.minFee,
        ])
        .send(active(adapter.account))

      await expectToThrow(action, errors.CONTRACT_ALREADY_INITIALIZED)
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

      await expectToThrow(action, errors.NOT_INITIALIZED)
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

  describe('adapter::setchainid', () => {
    it('Should throw if called by not authorized account', async () => {
      const action = adapter.contract.actions
        .setchainid([EOSChainId])
        .send(active(evil))

      await expectToThrow(action, errors.AUTH_MISSING(adapter.account))
    })

    it('Should set the local chain id correctly', async () => {
      const chain_id = 'ababba'
      await adapter.contract.actions
        .setchainid([chain_id])
        .send(active(adapter.account))

      const local_chain_id = getSingletonInstance(
        adapter.contract,
        TABLE_LOCAL_CHAIN_ID,
      )
      expect(local_chain_id.chain_id).to.be.equal(chain_id)
    })

    it('Should update the local chain id correctly', async () => {
      await adapter.contract.actions
        .setchainid([EOSChainId])
        .send(active(adapter.account))

      const local_chain_id = getSingletonInstance(adapter.contract, 'chainid')
      expect(local_chain_id.chain_id).to.be.equal(EOSChainId)
    })
  })

  describe('adapter::settee', () => {
    it('Should throw if called by not authorized account', async () => {
      const action = adapter.contract.actions
        .settee([teePubKey, attestation])
        .send(active(evil))

      await expectToThrow(action, errors.AUTH_MISSING(adapter.account))
    })

    it('Should set the tee pubKey and attestation correctly', async () => {
      await adapter.contract.actions
        .settee([teePubKey, attestation])
        .send(active(adapter.account))

      const tee = getSingletonInstance(adapter.contract, TABLE_TEE)

      expect(tee.key).to.be.equal(teePubKey.toString())
      expect(tee.updating_key).to.be.equal(NULL_KEY)
      expect(tee.attestation).to.be.equal(attestation)
      expect(tee.updating_attestation).to.be.equal('')
      expect(tee.change_grace_threshold).to.be.equal(0)
    })

    it('Should wait and set a grace time period when a new tee is set', async () => {
      await adapter.contract.actions
        .settee([anotherPublicKey, anotherAttestation])
        .send(active(adapter.account))

      const tee = getSingletonInstance(adapter.contract, TABLE_TEE)

      expect(tee.key).to.be.equal(teePubKey.toString())
      expect(tee.updating_key).to.be.equal(anotherPublicKey.toString())
      expect(tee.attestation).to.be.equal(attestation)
      expect(tee.updating_attestation).to.be.equal(anotherAttestation)
      expect(tee.change_grace_threshold).to.not.be.equal(0)
    })
  })

  describe('adapter::applytee', () => {
    it('Should reject when calling the action before the grace period elapsed', async () => {
      const action = adapter.contract.actions
        .applynewtee([])
        .send(active(adapter.account))

      await expectToThrow(action, errors.GRACE_PERIOD_NOT_ELAPSED)
    })

    it('Should be able to apply the new tee key after the grace period', async () => {
      const timestamp = TimePointSec.fromMilliseconds(
        Date.now() + TEE_ADDRESS_CHANGE_GRACE_PERIOD_MS,
      )

      blockchain.setTime(timestamp)

      await adapter.contract.actions
        .applynewtee([])
        .send(active(adapter.account))

      const tee = getSingletonInstance(adapter.contract, TABLE_TEE)

      expect(tee.key).to.be.equal(anotherPublicKey.toString())
      expect(tee.updating_key).to.be.equal(NULL_KEY)
      expect(tee.attestation).to.be.equal(anotherAttestation)
      expect(tee.updating_attestation).to.be.equal('')
      expect(tee.change_grace_threshold).to.be.equal(0)
    })
  })

  describe('adapter::setorigin', () => {
    const originChainId = no0x(bytes32(Chains(Protocols.Evm).Mainnet))

    it('Should throw if called by not authorized account', async () => {
      const action = adapter.contract.actions
        .setorigin([originChainId, evmAdapter, evmTopicZero])
        .send(active(evil))

      await expectToThrow(action, errors.AUTH_MISSING(adapter.account))
    })

    it('Should throw if emitter is not 32 bytes', async () => {
      const wrong = 'C0FFEE'
      const action = adapter.contract.actions
        .setorigin([originChainId, wrong, evmTopicZero])
        .send(active(adapter.account))

      await expectToThrow(action, errors.EXPECTED_32_BYTES('emitter'))
    })

    it('Should throw if topic zero is not 32 bytes', async () => {
      const wrong = 'C0FFEE'
      const action = adapter.contract.actions
        .setorigin([originChainId, evmAdapter, wrong])
        .send(active(adapter.account))

      await expectToThrow(action, errors.EXPECTED_32_BYTES('topic zero'))
    })

    it('Should throw if origin chain id is not 32 bytes', async () => {
      const wrong = 1
      const action = adapter.contract.actions
        .setorigin([wrong, evmAdapter, evmTopicZero])
        .send(active(adapter.account))

      await expectToThrow(action, errors.EXPECTED_32_BYTES('chain_id'))
    })

    it('Should set the origin details correctly', async () => {
      const anAddress = no0x(
        bytes32('0xe396757ec7e6ac7c8e5abe7285dde47b98f22db8'),
      )
      await adapter.contract.actions
        .setorigin([originChainId, anAddress, evmTopicZero])
        .send(active(adapter.account))

      const row = adapter.contract.tables
        .mappings(getAccountCodeRaw(adapter.account))
        .getTableRow(stripZerosLeft(`0x${originChainId}`))

      expect(row.chain_id).to.be.equal(originChainId)
      expect(row.emitter).to.be.equal(anAddress)
      expect(row.topic_zero).to.be.equal(evmTopicZero)
    })

    it('Should update the origin details correctly', async () => {
      await adapter.contract.actions
        .setorigin([originChainId, evmAdapter, evmTopicZero])
        .send(active(adapter.account))

      const emitterRow = adapter.contract.tables
        .mappings(getAccountCodeRaw(adapter.account))
        .getTableRow(stripZerosLeft(`0x${originChainId}`))

      expect(emitterRow.chain_id).to.be.equal(originChainId)
      expect(emitterRow.emitter).to.be.equal(evmAdapter)
      expect(emitterRow.topic_zero).to.be.equal(evmTopicZero)
    })
  })
})
