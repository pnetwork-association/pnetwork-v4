const { expect } = require('chai')
const { parseEther } = require('ethers')
const { Blockchain, expectToThrow } = require('@eosnetwork/vert')
const { Asset } = require('@wharfkit/antelope')
const { Symbol } = Asset
const {
  sum,
  no0x,
  active,
  deploy,
  errors,
  bytes32,
  getSwapMemo,
  getOperation,
  serializeOperation,
  getAccountsBalances,
  fromEthersPublicKey,
  substract,
} = require('./utils')
const {
  Chains,
  Versions,
  Protocols,
  ProofcastEventAttestator,
} = require('@pnetwork/event-attestator')
const { adjustPrecision } = require('./utils/precision-utils')

describe('Adapter Testing - Non Local Deployment', () => {
  const symbol = 'TST'
  const xsymbol = `X${symbol}`
  const maxSupply = 500000000
  const minFee = 0.0018
  const symbolDecimals = 18
  const xsymbolDecimals = 8
  const symbolPrecision = Symbol.fromParts(symbol, symbolDecimals)
  const xsymbolPrecision = Symbol.fromParts(xsymbol, xsymbolDecimals)

  const blockchain = new Blockchain()

  const user = 'user'
  const evil = 'evil'
  const issuer = 'issuer'
  const bridge = 'bridge'
  const recipient = 'eosrecipient'
  const feemanager = 'feemanager'

  const evmSwapAmount = 5.87190615
  const evmOriginChainId = Chains(Protocols.Evm).Mainnet
  const evmAdapter =
    '000000000000000000000000bcf063a9eb18bc3c6eb005791c61801b7cb16fe4'
  const evmTopicZero =
    '66756e6473206172652073616675207361667520736166752073616675202e2e'
  const EOSChainId =
    'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906'

  const token = {
    symbol,
    decimals: symbolDecimals,
    account: '',
    maxSupply: Asset.from(0, symbolPrecision),
    bytes: '000000000000000000000000810090f35dfa6b18b5eb59d298e2a2443a2811e2', // EVM address
  }

  const xerc20 = {
    symbol: xsymbol,
    decimals: xsymbolDecimals,
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

  const eosEA = new ProofcastEventAttestator({
    version: Versions.V1,
    protocolId: Protocols.Eos,
    chainId: Chains(Protocols.Eos).Mainnet,
  })

  before(() => {
    blockchain.createAccounts(user, evil, issuer, bridge, recipient, feemanager)

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
    await xerc20.contract.actions
      .create([issuer, xerc20.maxSupply])
      .send(active(xerc20.account))

    const mintingLimit = Asset.from(1000, xsymbolPrecision)
    const burningLimit = Asset.from(600, xsymbolPrecision)

    await xerc20.contract.actions
      .setlimits([adapter.account, mintingLimit, burningLimit])
      .send(active(xerc20.account))
  }

  describe('adapter::settle', () => {
    const operation = getOperation({
      blockId:
        '7e21ba208ea2a072bad2d011dbc3a9f870c574a66203d84bde926fcf85756d78',
      txId: '2e3704b180feda25af9dfe50793e292fd99d644aa505c3d170fa69407091dbd3',
      nonce: 0,
      token: '0x810090f35dfa6b18b5eb59d298e2a2443a2811e2',
      originChainId: evmOriginChainId,
      destinationChainId: Chains(Protocols.Eos).Mainnet,
      amount: evmSwapAmount,
      sender:
        '000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb92266',
      recipient,
      data: '',
    })

    const event = {
      blockHash: operation.blockId,
      transactionHash: operation.txId,
      address: evmAdapter,
      topics: [evmTopicZero],
      data: serializeOperation(operation),
    }
    const preimage = no0x(evmEA.getEventPreImage(event))
    const signature = no0x(evmEA.formatEosSignature(evmEA.sign(event)))

    const metadata = { preimage, signature }

    it('Setup', async () => {
      await setup()
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
    })

    it('Should set the local chain id successfully', async () => {
      await adapter.contract.actions
        .setchainid([EOSChainId])
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

    it('Should add the fee manager account', async () => {
      await adapter.contract.actions
        .setfeemanagr([feemanager])
        .send(active(adapter.account))
    })

    it('Should reject if adapter and token do not match', async () => {
      const wrongTokenBytes = no0x(bytes32('0x'))
      const action = adapter.contract.actions
        .settle([
          user,
          { ...no0x(operation), token: wrongTokenBytes },
          metadata,
        ])
        .send(active(user))

      await expectToThrow(action, errors.INVALID_TOKEN)
    })

    it('Should settle the operation properly', async () => {
      const before = getAccountsBalances(
        [user, recipient, adapter.account, feemanager],
        [xerc20],
      )

      await adapter.contract.actions
        .settle([user, no0x(operation), metadata])
        .send(active(user))

      const after = getAccountsBalances(
        [user, recipient, adapter.account, feemanager],
        [xerc20],
      )

      expect(after[recipient][xerc20.symbol]).to.be.deep.equal(
        Asset.from(evmSwapAmount, xsymbolPrecision),
      )

      expect(after[adapter.account][xerc20.symbol]).to.be.deep.equal(
        Asset.from(0, xsymbolPrecision),
      )

      expect(before[feemanager][xerc20.symbol]).to.be.deep.equal(
        after[feemanager][xerc20.symbol],
      )
    })

    it('Should settle the operation properly and send userdata', async () => {
      const operationWithUserData = {
        ...operation,
        data: '0x12345abcdefc0de1337f',
      }

      const newEvent = {
        ...event,
        data: serializeOperation(operationWithUserData),
      }

      const newMetadata = {
        preimage: evmEA.getEventPreImage(newEvent),
        signature: evmEA.formatEosSignature(evmEA.sign(newEvent)),
      }

      const before = getAccountsBalances(
        [user, recipient, adapter.account],
        [xerc20],
      )

      const beforeAsset = Asset.from(before[recipient][xerc20.symbol])

      await adapter.contract.actions
        .settle([user, no0x(operationWithUserData), no0x(newMetadata)])
        .send(active(user))

      const after = getAccountsBalances(
        [user, recipient, adapter.account],
        [xerc20],
      )

      expect(after[recipient][xerc20.symbol]).to.be.deep.equal(
        sum(Asset.from(evmSwapAmount, xsymbolPrecision), beforeAsset),
      )

      expect(after[adapter.account][xerc20.symbol]).to.be.deep.equal(
        Asset.from(0, xsymbolPrecision),
      )
    })

    it('Should truncate the passed amount to the set precision', async () => {
      const largeAmount = '1189215224969292133'
      const largeOperation = {
        ...operation,
        amount: largeAmount,
      }

      const largeEvent = {
        ...event,
        data: serializeOperation(largeOperation),
      }

      const largeMetadata = {
        preimage: evmEA.getEventPreImage(largeEvent),
        signature: evmEA.formatEosSignature(evmEA.sign(largeEvent)),
      }

      const before = getAccountsBalances(
        [user, recipient, adapter.account],
        [xerc20],
      )

      await adapter.contract.actions
        .settle([user, no0x(largeOperation), no0x(largeMetadata)])
        .send(active(user))

      const after = getAccountsBalances(
        [user, recipient, adapter.account],
        [xerc20],
      )

      const adjusted = Asset.from(
        largeAmount / 10 ** symbolDecimals,
        xsymbolPrecision,
      )

      expect(
        substract(
          after[recipient][xerc20.symbol],
          before[recipient][xerc20.symbol],
        ),
      ).to.be.deep.equal(adjusted)

      expect(after[adapter.account][xerc20.symbol]).to.be.deep.equal(
        Asset.from(0, xsymbolPrecision),
      )
    })
  })

  describe('adapter::swap', () => {
    it('Should swap the amount back to the originating chain', async () => {
      const to = '0xe396757ec7e6ac7c8e5abe7285dde47b98f22db8'
      const destinationChainId = bytes32(Chains(Protocols.Evm).Mainnet)
      const data = ''
      const memo = getSwapMemo(user, destinationChainId, to, data)
      const quantity = Asset.from(evmSwapAmount, xsymbolPrecision)

      const before = getAccountsBalances([recipient, adapter.account], [xerc20])

      await xerc20.contract.actions
        .transfer([recipient, adapter.account, quantity, memo])
        .send(active(recipient))

      const after = getAccountsBalances([recipient, adapter.account], [xerc20])

      expect(
        substract(
          before[recipient][xerc20.symbol],
          after[recipient][xerc20.symbol],
        ),
      ).to.be.deep.equal(quantity)

      expect(after[adapter.account][xerc20.symbol]).to.be.deep.equal(
        Asset.from(0, xsymbolPrecision),
      )

      const expectedEventBytes =
        '0000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000005158b1b8444260000000000000000000000000000000000000000000000000000000000075736572000000000000000000000000000000000000000000000000000000000000002a307865333936373537656337653661633763386535616265373238356464653437623938663232646238'

      expect(adapter.contract.bc.console).to.be.equal(expectedEventBytes)
    })
  })
})
