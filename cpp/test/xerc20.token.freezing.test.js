const { expect } = require('chai')
const { deploy } = require('./utils/deploy')
const { getSingletonInstance } = require('./utils/eos-ext')
const { Blockchain, expectToThrow } = require('@eosnetwork/vert')
const { active, getAccountCodeRaw, precision } = require('./utils/eos-ext')
const errors = require('./utils/errors')
const { substract } = require('./utils/wharfkit-ext')
const { getAccountsBalances } = require('./utils/get-token-balance')
const { Asset } = require('@wharfkit/antelope')

TABLE_FREEZING_ACCOUNT = 'freezeacc'

describe('xerc20.token - Freezing capabilities tests', () => {
  describe('Cumulative tests', () => {
    const symbol = 'TKN'
    const maxSupply = 500000000
    const blockchain = new Blockchain()

    const user = 'user'
    const evil = 'evil'
    const issuer = 'issuer'
    const recipient = 'recipient'
    const lockbox = 'lockbox'
    const freezingAccount = 'freezer'

    const xerc20 = {
      symbol: `X${symbol}`,
      account: `x${symbol.toLowerCase()}.token`,
      maxSupply: `${maxSupply}.0000 X${symbol}`,
      contract: null,
    }

    const memo = ''
    const evilInitialBalance = `100.0000 ${xerc20.symbol}`
    const stolenAmount = `66.0000 ${xerc20.symbol}`
    const transfereableAmount = substract(evilInitialBalance, stolenAmount)

    before(async () => {
      blockchain.createAccounts(
        user,
        issuer,
        evil,
        recipient,
        lockbox,
        freezingAccount,
      )
      xerc20.contract = deploy(
        blockchain,
        xerc20.account,
        'contracts/build/xerc20.token',
      )
    })

    const initialSetup = async () => {
      const mintingLimit = `1000.0000 ${xerc20.symbol}`
      const burningLimit = `600.0000 ${xerc20.symbol}`

      await xerc20.contract.actions
        .create([issuer, xerc20.maxSupply])
        .send(active(xerc20.account))

      await xerc20.contract.actions
        .setlimits([xerc20.account, mintingLimit, burningLimit])
        .send(active(xerc20.account))

      await xerc20.contract.actions.setlockbox([lockbox]).send()
    }

    it("Only contract's active owner can set the freezing address", async () => {
      await initialSetup()

      let action = xerc20.contract.actions
        .setfreezeacc([freezingAccount])
        .send(active(evil))

      await expectToThrow(action, errors.AUTH_MISSING(xerc20.account))

      await xerc20.contract.actions
        .setfreezeacc([freezingAccount])
        .send(active(xerc20.account))

      const freezingAccountSingleton = getSingletonInstance(
        xerc20.contract,
        TABLE_FREEZING_ACCOUNT,
      )

      expect(freezingAccountSingleton).to.be.equal(freezingAccount)
    })

    it('Only the freezing account can call the freezing actions', async () => {
      const amount = `100.0000 ${xerc20.symbol}`
      let action = xerc20.contract.actions.freeze([user]).send(active(evil))

      await expectToThrow(action, errors.AUTH_MISSING(freezingAccount))

      action = xerc20.contract.actions
        .pullfrozen([user, evil, amount])
        .send(active(evil))

      await expectToThrow(action, errors.AUTH_MISSING(freezingAccount))

      action = xerc20.contract.actions.unfreeze([user]).send(active(evil))

      await expectToThrow(action, errors.AUTH_MISSING(freezingAccount))
    })

    it('Should freeze an account successfully', async () => {
      await xerc20.contract.actions
        .mint([xerc20.account, evil, evilInitialBalance, memo])
        .send(active(xerc20.account))

      await xerc20.contract.actions
        .transfer([evil, recipient, transfereableAmount, memo])
        .send(active(evil))

      let balances = getAccountsBalances([evil, recipient], [xerc20])

      expect(balances[recipient][xerc20.symbol]).to.be.deep.equal(
        transfereableAmount,
      )

      await xerc20.contract.actions.freeze([evil]).send(active(freezingAccount))

      let rows = xerc20.contract.tables
        .frozensacc(getAccountCodeRaw(xerc20.account))
        .getTableRow(getAccountCodeRaw(evil))

      expect(rows.account).to.be.equal(evil)
    })

    it('Should not able to transfer/receive funds after freezing', async () => {
      let action = xerc20.contract.actions
        .transfer([evil, recipient, transfereableAmount, memo])
        .send(active(evil))

      await expectToThrow(action, errors.FROM_ACCOUNT_IS_FROZEN)

      action = xerc20.contract.actions
        .transfer([recipient, evil, transfereableAmount, memo])
        .send(active(evil))

      await expectToThrow(action, errors.TO_ACCOUNT_IS_FROZEN)
    })

    it('Should throw when withdrawing to a freezed account', async () => {
      const action = xerc20.contract.actions
        .pullfrozen([evil, evil, stolenAmount])
        .send(active(freezingAccount))

      await expectToThrow(action, errors.TO_ACCOUNT_IS_FROZEN)
    })

    it('Should withdraw the stolen amount successfully', async () => {
      await xerc20.contract.actions
        .pullfrozen([evil, freezingAccount, stolenAmount])
        .send(active(freezingAccount))

      const after = getAccountsBalances([evil, freezingAccount], [xerc20])

      expect(after[evil][xerc20.symbol]).to.be.deep.equal(
        Asset.from(0, precision(4, xerc20.symbol)),
      )
      expect(after[freezingAccount][xerc20.symbol]).to.be.deep.equal(
        Asset.from(stolenAmount),
      )
    })

    it('Should unfreeze an account successfully', async () => {
      let rows = xerc20.contract.tables
        .frozensacc(getAccountCodeRaw(xerc20.account))
        .getTableRow(getAccountCodeRaw(evil))

      expect(rows.account).to.be.equal(evil)

      await xerc20.contract.actions
        .unfreeze([evil])
        .send(active(freezingAccount))

      rows = xerc20.contract.tables
        .frozensacc(getAccountCodeRaw(xerc20.account))
        .getTableRow(getAccountCodeRaw(evil))

      expect(rows).to.be.undefined
    })
  })
})
