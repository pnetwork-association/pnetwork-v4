const { expect } = require('chai')
const { Blockchain, expectToThrow } = require('@eosnetwork/vert')
const { deploy } = require('./utils/deploy')
const { Asset, Name, TimePointSec } = require('@wharfkit/antelope')
const { substract } = require('./utils/wharfkit-ext')

const ERR_SYMBOL_ALREADY_EXISTS =
  'eosio_assert: token with symbol already exists'

const ERR_AUTH_MISSING = _account => `missing required authority ${_account}`

const ERR_LOCKBOX_OR_BRIDGE_ONLY =
  'eosio_assert: recipient must be the lockbox or a supported bridge'

const active = _account => `${_account}@active`

const getSymbolCodeRaw = _asset => Asset.from(_asset).symbol.code.value.value

const getAccountCodeRaw = _account => Name.from(_account).value.value

const round = (_value, _decimals) =>
  Math.round(_value * 10 ** _decimals) / 10 ** _decimals

describe('xerc20.token', () => {
  const symbol = 'TKN'
  const account = `${symbol.toLowerCase()}.token`
  const maxSupply = `500000000 ${symbol}`
  const blockchain = new Blockchain()
  const DURATION = 24 * 60 * 60 // 1 day

  const evil = 'evil'
  const issuer = 'issuer'
  const recipient = 'recipient'
  const bridge = 'bridge'

  let xerc20
  before(async () => {
    blockchain.createAccounts(issuer, account, bridge, evil, recipient)
    xerc20 = deploy(blockchain, account, 'contracts/xerc20.token')
  })

  it('Should create a token successfully', async () => {
    await xerc20.actions.create([issuer, maxSupply]).send()
    const scope = getSymbolCodeRaw(maxSupply)
    const primaryKey = scope

    const row = xerc20.tables.stat(scope).getTableRow(primaryKey)

    expect(row).to.be.deep.equal({
      supply: `0 ${symbol}`,
      max_supply: maxSupply,
      issuer: issuer,
    })
  })

  it('Should revert when creating a token with the same symbol', async () => {
    const action = xerc20.actions.create([account, maxSupply]).send()
    await expectToThrow(action, ERR_SYMBOL_ALREADY_EXISTS)
  })

  it('Should set the lockbox successfully', async () => {
    const lockbox = 'lockbox.enf'
    const lockboxTable = 'lockbox'
    blockchain.createAccount(lockbox)
    await xerc20.actions.setlockbox([lockbox]).send()

    const property = xerc20.tables
      .lockbox()
      .getTableRow(getAccountCodeRaw(lockboxTable))

    expect(property).to.be.equal(lockbox)
  })

  it('Should set the limits correctly', async () => {
    const mintingLimit = `1000 ${symbol}`
    const burningLimit = `600 ${symbol}`
    const timestamp = TimePointSec.fromMilliseconds(Date.now())

    blockchain.setTime(timestamp)
    await xerc20.actions.setlimits([bridge, mintingLimit, burningLimit]).send()

    const scope = getAccountCodeRaw(account)
    const primaryKey = getAccountCodeRaw(bridge)
    const rows = xerc20.tables.bridges(scope).getTableRows(primaryKey)

    const expectedTimestamp = timestamp.toMilliseconds() / 1000
    const expectedMintingRate = round(
      Asset.from(mintingLimit).value / DURATION,
      7,
    ).toString()
    const expectedBurningRate = round(
      Asset.from(burningLimit).value / DURATION,
      7,
    ).toString()

    expect(rows).to.have.length(1)
    expect(rows[0]).to.be.deep.equal({
      account: bridge,
      minting_timestamp: expectedTimestamp,
      minting_rate: expectedMintingRate,
      minting_current_limit: mintingLimit,
      minting_max_limit: mintingLimit,
      burning_timestamp: expectedTimestamp,
      burning_rate: expectedBurningRate,
      burning_current_limit: burningLimit,
      burning_max_limit: burningLimit,
    })
  })

  it('Should revert when the account minting tokens is not among the allowed bridges', async () => {
    const memo = ''
    const quantity = `10 ${symbol}`
    let action = xerc20.actions
      .mint([bridge, recipient, quantity, memo])
      .send(active(evil))
    await expectToThrow(action, ERR_AUTH_MISSING(bridge))
  })

  it('Should mint the tokens to a specific recipient', async () => {
    const memo = ''
    const quantity = `10 ${symbol}`
    const timestamp = TimePointSec.fromMilliseconds(1726133966067)

    blockchain.setTime(timestamp)

    const bridgeLimitsBefore = xerc20.tables
      .bridges(getAccountCodeRaw(account))
      .getTableRows(getAccountCodeRaw(bridge))

    await xerc20.actions
      .mint([bridge, recipient, quantity, memo])
      .send(active(bridge))

    const balance = xerc20.tables
      .accounts(getAccountCodeRaw(recipient))
      .getTableRow(getSymbolCodeRaw(maxSupply))

    const bridgeLimits = xerc20.tables
      .bridges(getAccountCodeRaw(account))
      .getTableRows(getAccountCodeRaw(bridge))
    const expectedTimestamp = timestamp.toMilliseconds() / 1000

    const difference = substract(
      bridgeLimitsBefore[0].minting_current_limit,
      quantity,
    )

    expect(balance).to.be.deep.equal({ balance: quantity })
    expect(bridgeLimits).to.have.length(1)
    expect(bridgeLimits[0].minting_current_limit).to.be.equal(
      String(difference),
    )
    expect(bridgeLimits[0].minting_timestamp).to.be.equal(expectedTimestamp)
  })

  it('Should revert when the account burning the tokens is not a bridge', async () => {
    const memo = ''
    const quantity = `10 ${symbol}`

    const action = xerc20.actions
      .burn([bridge, quantity, memo])
      .send(active(evil))

    await expectToThrow(action, ERR_AUTH_MISSING(bridge))
  })

  it('Should burn the previously minted quantity successfully', async () => {
    const memo = ''
    const quantity = `10 ${symbol}`

    const bridgeLimitsBefore = xerc20.tables
      .bridges(getAccountCodeRaw(account))
      .getTableRows(getAccountCodeRaw(bridge))

    await xerc20.actions
      .transfer([recipient, bridge, quantity, memo])
      .send(active(recipient))
    await xerc20.actions.burn([bridge, quantity, memo]).send(active(bridge))

    const bridgeLimits = xerc20.tables
      .bridges(getAccountCodeRaw(account))
      .getTableRows(getAccountCodeRaw(bridge))

    const scope = getAccountCodeRaw(recipient)
    const primaryKey = getSymbolCodeRaw(maxSupply)
    const row = xerc20.tables.accounts(scope).getTableRow(primaryKey)
    const difference = substract(
      bridgeLimitsBefore[0].burning_current_limit,
      quantity,
    )

    expect(row).to.be.deep.equal({
      balance: `0 ${symbol}`,
    })
    expect(bridgeLimits[0].burning_current_limit).to.be.equal(
      String(difference),
    )
  })
})
