const { Blockchain, expectToThrow } = require('@eosnetwork/vert')
const { deploy } = require('./utils/deploy')
const { expect } = require('chai')
const { Asset, Name } = require('@wharfkit/antelope')

const ERR_SYMBOL_ALREADY_EXISTS =
  'eosio_assert: token with symbol already exists'

const ERR_AUTH_MISSING = _account => `missing required authority ${_account}`

const ERR_ISSUER_ONLY =
  'eosio_assert: tokens can only be issued to issuer account'

const active = _account => `${_account}@active`

const getSymbolCodeRaw = _asset => Asset.from(_asset).symbol.code.value.value

const getAccountCodeRaw = _account => Name.from(_account).value.value

describe('xerc20.token', () => {
  const symbol = 'TKN'
  const account = `${symbol.toLowerCase()}.token`
  const maxSupply = `500000000 ${symbol}`
  const blockchain = new Blockchain()

  const evil = 'evil'
  const issuer = 'issuer'
  const recipient = 'recipient'

  let xerc20
  before(async () => {
    blockchain.createAccounts(issuer, account, evil, recipient)
    xerc20 = deploy(blockchain, account, 'contracts/eosio.token')
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

  it('Should revert when the issuer is not legit', async () => {
    const memo = ''
    const quantity = `10 ${symbol}`
    const action = xerc20.actions
      .issue([recipient, quantity, memo])
      .send(active(evil))
    await expectToThrow(action, ERR_ISSUER_ONLY)
  })

  it('Should mint the tokens to a specific recipient', async () => {
    const memo = ''
    const quantity = `10 ${symbol}`

    await xerc20.actions
      .mint([issuer, recipient, quantity, memo])
      .send(active(issuer))

    const scope = getAccountCodeRaw(recipient)
    const primaryKey = getSymbolCodeRaw(maxSupply)
    const row = xerc20.tables.accounts(scope).getTableRow(primaryKey)

    expect(row).to.be.deep.equal({
      balance: quantity,
    })
  })

  it('Should revert when burning without the owner account', async () => {
    const memo = ''
    const quantity = `10 ${symbol}`

    const action = xerc20.actions
      .burn([recipient, quantity, memo])
      .send(active(evil))

    await expectToThrow(action, ERR_AUTH_MISSING(recipient))
  })

  it('Should burn the previously minted quantity successfully', async () => {
    const memo = ''
    const quantity = `10 ${symbol}`

    await xerc20.actions
      .burn([recipient, quantity, memo])
      .send(active(recipient))

    const scope = getAccountCodeRaw(recipient)
    const primaryKey = getSymbolCodeRaw(maxSupply)
    const row = xerc20.tables.accounts(scope).getTableRow(primaryKey)

    expect(row).to.be.deep.equal({
      balance: `0 ${symbol}`,
    })
  })
})
