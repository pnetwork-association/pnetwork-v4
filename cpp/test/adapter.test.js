const { expect } = require('chai')
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
  getOperation,
  getSymbolCodeRaw,
  getAccountCodeRaw,
  serializeOperation,
  getAccountsBalances,
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

const LOCAL = 'Local'
const NOT_LOCAL = 'Not-local'
const TABLE_STORAGE = 'storage'

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

  const notLocalToken = {
    symbol,
    account: '',
    maxSupply: Asset.from(0, symbolPrecision),
    bytes: '000000000000000000000000810090f35dfa6b18b5eb59d298e2a2443a2811e2', // EVM address
  }

  const tokenAccount = `${symbol.toLowerCase()}.token`
  const localToken = {
    symbol,
    account: tokenAccount,
    maxSupply: Asset.from(maxSupply, symbolPrecision),
    bytes: no0x(bytes32(toBeHex(String(getSymbolCodeRaw(symbolPrecision))))),
  }

  const xerc20 = {
    symbol: `${xsymbol}`,
    account: `${xsymbol.toLowerCase()}.token`,
    maxSupply: Asset.from(maxSupply, xsymbolPrecision),
    minFee: Asset.from(minFee, xsymbolPrecision),
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

  ;[NOT_LOCAL].map(_type => {
    describe(_type, () => {
      before(() => {
        blockchain.createAccounts(
          user,
          evil,
          issuer,
          bridge,
          recipient,
          feemanager,
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

        if (_type == LOCAL) {
          lockbox.contract = deploy(
            blockchain,
            lockbox.account,
            'contracts/build/lockbox',
          )

          localToken.contract = deploy(
            blockchain,
            localToken.account,
            'contracts/build/eosio.token',
          )
        }
      })

      after(async () => {
        blockchain.resetTables()
        await blockchain.resetVm()
      })

      const token = _type === LOCAL ? localToken : notLocalToken

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

          if (_type === LOCAL) {
            await localToken.contract.actions
              .create([issuer, localToken.maxSupply])
              .send(active(localToken.account))
          }
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

          const row = adapter.contract.tables
            .regadapter(getAccountCodeRaw(adapter.account))
            .getTableRow(getSymbolCodeRaw(token.maxSupply))
          const storage = getSingletonInstance(adapter.contract, TABLE_STORAGE)
          const tee = getSingletonInstance(adapter.contract, 'tee')
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

      describe('adapter::settee', () => {
        const teePubKey = fromEthersPublicKey(
          evmEA.signingKey.compressedPublicKey,
        )
        const attestation = ''
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

          const tee = getSingletonInstance(adapter.contract, 'tee')

          expect(tee.key).to.be.equal(teePubKey.toString())
          expect(tee.attestation).to.be.equal(attestation)
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

      describe('adapter::settle', () => {
        const operation = getOperation({
          blockId:
            '7e21ba208ea2a072bad2d011dbc3a9f870c574a66203d84bde926fcf85756d78',
          txId: '2e3704b180feda25af9dfe50793e292fd99d644aa505c3d170fa69407091dbd3',
          nonce: 0,
          token: '0x810090f35dfa6b18b5eb59d298e2a2443a2811e2',
          originChainId: Chains(Protocols.Evm).Mainnet, // EVM mainnet chain id
          destinationChainId: Chains(Protocols.Eos).Mainnet,
          amount: Asset.from(5.87190615, xsymbolPrecision),
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

          expect(after[recipient][xerc20.symbol]).to.be.equal(
            operation.amount.toString(),
          )

          expect(after[adapter.account][xerc20.symbol]).to.be.equal(
            `0.0000 ${xerc20.symbol}`,
          )

          expect(before[feemanager][xerc20.symbol]).to.be.equal(
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

          expect(after[recipient][xerc20.symbol]).to.equal(
            sum(operation.amount, beforeAsset).toString(),
          )

          expect(after[adapter.account][xerc20.symbol]).to.be.equal(
            `0.0000 ${xerc20.symbol}`,
          )
        })
      })
    })
  })
})
