const R = require('ramda')
const { expect } = require('chai')
const { Asset, Name } = require('@wharfkit/antelope')
const { Blockchain, expectToThrow, nameToBigInt } = require('@eosnetwork/vert')
const { deploy } = require('./utils/deploy')
const {
  no0x,
  active,
  errors,
  bytes32,
  precision,
  substract,
  getSwapMemo,
  prettyTrace,
  getSymbolCodeRaw,
  getAccountsBalances,
  getSingletonInstance,
  fromEthersPublicKey,
  deserializeEventBytes,
} = require('./utils')

const { toBeHex } = require('ethers')
const {
  Protocols,
  Chains,
  ProofcastEventAttestator,
  Versions,
} = require('@pnetwork/event-attestator')

describe('Adapter Testing - Local deployment', () => {
  const decimals = 4
  const symbol = 'TKN'
  const xsymbol = `X${symbol}`
  const symbolPrecision = precision(decimals, symbol)
  const xsymbolPrecision = precision(decimals, xsymbol)
  const minFee = Asset.from(0.0018, xsymbolPrecision)
  const maxSupply = 500000000
  const userInitialBalance = Asset.from(1000, symbolPrecision)

  const TABLE_STORAGE = 'storage'
  const FEE_BASIS_POINTS = 1750
  const FEE_BASIS_POINTS_DIVISOR = 1000000

  const evmOriginChainId = Chains(Protocols.Evm).Mainnet
  const evmAdapter =
    '000000000000000000000000bcf063a9eb18bc3c6eb005791c61801b7cb16fe4'
  const evmTopicZero =
    '66756e6473206172652073616675207361667520736166752073616675202e2e'

  const token = {
    symbol: symbol,
    account: `${symbol.toLowerCase()}.token`,
    maxSupply: Asset.from(maxSupply, symbolPrecision),
    bytes: no0x(bytes32(toBeHex(Number(getSymbolCodeRaw(symbolPrecision))))),
    contract: null,
  }
  const xerc20 = {
    symbol: xsymbol,
    account: `${xsymbol.toLowerCase()}.token`,
    maxSupply: Asset.from(maxSupply, xsymbolPrecision),
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

  const evmEA = new ProofcastEventAttestator({
    version: Versions.V1,
    protocolId: Protocols.Evm,
    chainId: Chains(Protocols.Evm).Mainnet,
  })

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
        xsymbolPrecision,
        token.account,
        symbolPrecision,
      ])
      .send(active(lockbox.account))

    // Fund the user
    await token.contract.actions
      .issue([issuer, userInitialBalance, memo])
      .send(active(issuer))

    await token.contract.actions
      .transfer([issuer, user, userInitialBalance, memo])
      .send(active(issuer))

    // Fund the attacker
    await token.contract.actions
      .issue([issuer, userInitialBalance, memo])
      .send(active(issuer))

    await token.contract.actions
      .transfer([issuer, evil, userInitialBalance, memo])
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
          xsymbolPrecision,
          token.account,
          symbolPrecision,
          token.bytes,
          minFee,
        ])
        .send(active(adapter.account))
    })

    it('Should set the fee manager successfully', async () => {
      await adapter.contract.actions
        .setfeemanagr([feemanager])
        .send(active(adapter.account))
    })

    it('Should add the tee public key successfully', async () => {
      const teePubKey = fromEthersPublicKey(
        evmEA.signingKey.compressedPublicKey,
      )

      const attestation = ''
      await adapter.contract.actions
        .settee([teePubKey, attestation])
        .send(active(adapter.account))
    })

    it('Should add the origin details successfully', async () => {
      await adapter.contract.actions
        .setorigin([no0x(bytes32(evmOriginChainId)), evmAdapter, evmTopicZero])
        .send(active(adapter.account))
    })
  })

  describe('adapter::swap', () => {
    const data = ''
    const recipient = '0x68bbed6a47194eff1cf514b50ea91895597fc91e'
    const destinationChainId = Chains(Protocols.Evm).Mainnet
    const memo = getSwapMemo(user, bytes32(destinationChainId), recipient, data)
    const amount = 10
    const quantity = Asset.from(amount, symbolPrecision)
    it('Should swap correctly', async () => {
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
        substract(before.user[token.symbol], after.user[token.symbol]),
      ).to.be.deep.equal(quantity)

      expect(
        substract(after.lockbox[token.symbol], before.lockbox[token.symbol]),
      ).to.be.deep.equal(quantity)

      expect(
        substract(after.lockbox[xerc20.symbol], before.lockbox[xerc20.symbol]),
      ).to.be.deep.equal(Asset.from(0, xsymbolPrecision))

      const intFees = (amount * FEE_BASIS_POINTS) / FEE_BASIS_POINTS_DIVISOR
      const fees = Asset.from(intFees, xsymbolPrecision)

      expect(
        substract(
          after.feemanager[xerc20.symbol],
          before.feemanager[xerc20.symbol],
        ),
      ).to.be.deep.equal(fees)

      expect(after.storage.nonce).to.be.equal(before.storage.nonce + 1)

      const possibleSwap = prettyTrace(R.last(blockchain.executionTraces))
      expect(possibleSwap['Contract']).to.be.equal(adapter.account)
      expect(possibleSwap['Action']).to.be.equal('swap')
      expect(possibleSwap['Inline']).to.be.equal(true)
      expect(possibleSwap['Notification']).to.be.equal(false)
      expect(possibleSwap['First Receiver']).to.be.equal(adapter.account)
      expect(possibleSwap['Sender']).to.be.equal(adapter.account)

      const eventBytes = adapter.contract.bc.console
      const deserialized = deserializeEventBytes(eventBytes)

      expect(deserialized.nonce).to.be.equal(before.storage.nonce)
      expect(deserialized.token).to.be.equal(token.account)
      expect(deserialized.destinationChainid).to.be.equal(destinationChainId)
      const expectedAmount = (amount - intFees) * 10 ** 18
      expect(deserialized.amount).to.be.equal(expectedAmount)
      expect(deserialized.sender).to.be.equal(user)
      expect(deserialized.recipient).to.be.equal(recipient)
      expect(deserialized.data).to.be.equal(data)
    })

    describe('adapter::adduserdata', () => {
      const data = Buffer.from('More coffee plz', 'utf-8').toString('hex')
      const memo = getSwapMemo(
        user,
        bytes32(destinationChainId),
        recipient,
        data,
      )
      const amount = 10
      const quantity = Asset.from(amount, symbolPrecision)

      it('Should revert when missing userdata record', async () => {
        const action = token.contract.actions
          .transfer([user, adapter.account, quantity, memo])
          .send(active(user))

        await expectToThrow(action, errors.USER_DATA_RECORD_NOT_FOUND)
      })

      it('Should revert when somebody calls adduserdata on their behalf', async () => {
        const action = adapter.contract.actions
          .adduserdata([user, data])
          .send(active(evil))

        await expectToThrow(action, errors.AUTH_MISSING(user))
      })

      it('Should revert when the payload is empty', async () => {
        const empty = []
        const action = adapter.contract.actions
          .adduserdata([user, empty])
          .send(active(user))

        await expectToThrow(action, errors.INVALID_PAYLOAD)
      })

      it('Should add user data successfully', async () => {
        const temporary = Buffer.from('))=33', 'utf-8').toString('hex')
        await adapter.contract.actions
          .adduserdata([user, temporary])
          .send(active(user))

        const rows = adapter.contract.tables
          .userdata(nameToBigInt(user))
          .getTableRows()

        expect(R.last(rows).id).to.be.equal(1)
        expect(R.last(rows).payload).to.be.equal(temporary)
      })

      it('Should change userdata to another one successfully', async () => {
        await adapter.contract.actions
          .adduserdata([user, data])
          .send(active(user))

        const rows = adapter.contract.tables
          .userdata(nameToBigInt(user))
          .getTableRows()

        expect(R.last(rows).id).to.be.equal(1)
        expect(R.last(rows).payload).to.be.equal(data)
      })

      it('Should send user data successfully', async () => {
        await token.contract.actions
          .transfer([user, adapter.account, quantity, memo])
          .send(active(user))

        const eventBytes = deserializeEventBytes(adapter.contract.bc.console)

        expect(eventBytes.nonce).to.be.equal(1)
        expect(eventBytes.token).to.be.equal(token.account)
        expect(eventBytes.destinationChainid).to.be.equal(destinationChainId)
        const intFees = (amount * FEE_BASIS_POINTS) / FEE_BASIS_POINTS_DIVISOR
        const expectedAmount = (amount - intFees) * 10 ** 18
        expect(eventBytes.amount).to.be.equal(expectedAmount)
        expect(eventBytes.sender).to.be.equal(user)
        expect(eventBytes.recipient).to.be.equal(recipient)
        expect(eventBytes.data).to.be.equal(data)
      })
    })
  })
})
