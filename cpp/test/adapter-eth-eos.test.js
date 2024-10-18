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
const { getEventBytes } = require('./utils/get-event-bytes')
const { substract, no0x } = require('./utils/wharfkit-ext')
const { getAccountsBalances } = require('./utils/get-token-balance')
const { getMetadataSample } = require('./utils/get-metadata-sample')
const { getOperationSample } = require('./utils/get-operation-sample')
const errors = require('./utils/errors')

const ethers = require('ethers')

const getSwapMemo = (sender, destinationChainId, recipient, data) =>
  `${sender},${destinationChainId},${recipient},${R.isEmpty(data) ? '0' : '1'}`

const attestation = 'deadbeef'

const hexStringToBytes = (hex) => {
    // Ensure the input string is valid
    if (hex.length % 2 !== 0) {
        throw new Error("Hex string must have an even length.");
    }

    const bytes = [];
    for (let i = 0; i < hex.length; i += 2) {
        // Parse two hex characters at a time and convert to a byte (0-255)
        bytes.push(parseInt(hex.substr(i, 2), 16));
    }
    return bytes;
}

describe('Adapter EVM -> EOS testing', () => {
  const symbol = 'TKN'
  const minFee = `0.001800 X${symbol}`
  const precision4 = precision(4)
  const precision6 = precision(6)
  const precision18 = precision(18)
  const maxSupply = '500000000.000000'
  const tokenMaxSupply = '500000000.000000000000000000'
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
    bytes: '0000000000000000000000003ca5269b5c54d4c807ca0df7eeb2cb7a5327e77d', //tokenBytes,
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
  const recipient = 'destinatieos' //'recipient'
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

    const mintingLimit = `1000.000000 ${xerc20.symbol}`
    const burningLimit = `600.000000 ${xerc20.symbol}`

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
    it('Should settle the operation properly and send userdata', async () => {
      const quantity = `10.000000 TKN`
      const xquantity = '0.000005 XTKN'
      const normalizedAmount = ethers
        .parseUnits(Asset.from(quantity).units.toString(), 18)
        .toString()

      const operation = getOperationSample({
        amount: normalizedAmount,
      })

      const metadata = getMetadataSample()

      const before = getAccountsBalances(
        [user, recipient, adapter.account],
        [xerc20],
      )

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
      
      const normalizedOriginChainId = hexStringToBytes('0000000000000000000000000000000000000000000000000000000000000001') 
      const normalizedOriginAdapter = hexStringToBytes('000000000000000000000000cc9676b9bf25ce45a3a5f88205239afddecf1bc7')
      const normalizeTopicZero = hexStringToBytes('9b706941b48091a1c675b439064f40b9d43c577d9c7134cce93179b9b0bf2a52')
                                                        
      await adapter.contract.actions
        .setemitter([normalizedOriginChainId, normalizedOriginAdapter])
        .send(active(adapter.account))

      await adapter.contract.actions
        .settopiczero([normalizedOriginChainId, normalizeTopicZero])
        .send(active(adapter.account))

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
  })
})
