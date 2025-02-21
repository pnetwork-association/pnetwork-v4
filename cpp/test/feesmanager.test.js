const { expect } = require('chai')
const { Blockchain, expectToThrow } = require('@eosnetwork/vert')
const { deploy } = require('./utils/deploy')
const { Asset } = require('@wharfkit/antelope')
const {
  active,
  precision,
  getAccountCodeRaw,
  getSymbolCodeRaw,
} = require('./utils/eos-ext')
const errors = require('./utils/errors')
const { substract } = require('./utils/wharfkit-ext')
const { getTokenBalance } = require('./utils/get-token-balance')

describe('Feesmanager testing', () => {
  const symbol = 'TKN'
  const precision4 = precision(4)
  const maxSupply = '500000000.0000'
  const token = {
    symbol: symbol,
    account: `${symbol.toLowerCase()}.token`,
    maxSupply: `${maxSupply} ${symbol}`,
    contract: undefined,
  }
  const token2 = {
    symbol: 'TKM',
    account: `tkm.token`,
    maxSupply: `${maxSupply} TKM`,
    contract: undefined,
  }
  const xerc20 = {
    symbol: `X${symbol}`,
    account: `x${symbol.toLowerCase()}.token`,
    maxSupply: `${maxSupply} X${symbol}`,
    contract: undefined,
  }

  const feesmanager = {
    account: 'feesmanager',
    contract: undefined,
  }

  const user = 'user'
  const evil = 'evil'
  const issuer = 'issuer'
  const bridge = 'bridge'
  const recipient = 'recipient'
  const securitycouncil = 'seccouncil'
  const node1 = 'nodeone'
  const node2 = 'nodetwo'

  beforeEach(async () => {
    const blockchain = new Blockchain()
    blockchain.createAccounts(
      user,
      evil,
      issuer,
      node1,
      recipient,
      securitycouncil,
    )
    feesmanager.contract = deploy(
      blockchain,
      feesmanager.account,
      'contracts/build/feesmanager',
    )
    token.contract = deploy(
      blockchain,
      token.account,
      'contracts/build/eosio.token',
    )
    token2.contract = deploy(
      blockchain,
      token2.account,
      'contracts/build/eosio.token',
    )
    xerc20.contract = deploy(
      blockchain,
      xerc20.account,
      'contracts/build/xerc20.token',
    )
  })

  describe('feesmanager::setallowance', () => {
    it('Should reject if not authorized', async () => {
      const allowanceValue = '100.0000 TKN'
      const action = feesmanager.contract.actions
        .setallowance([node1, token.account, allowanceValue])
        .send(active(evil))

      await expectToThrow(action, errors.AUTH_MISSING(feesmanager.account))
    })

    it('Should reject if allowance set is bigger than feesmanager balance', async () => {
      const allowanceValue = '200.0000 TKN'
      const feesmanagerBalance = '100.0000 TKN'
      const assetSymbol =
        Asset.from(feesmanagerBalance).symbol.code.value.toString()

      await token.contract.actions.create([issuer, token.maxSupply]).send()

      const balanceBefore = token.contract.tables
        .accounts(getAccountCodeRaw(feesmanager.account))
        .getTableRow(assetSymbol)
      expect(balanceBefore).to.equal(undefined)

      await token.contract.actions
        .issue([issuer, feesmanagerBalance, ''])
        .send(active(issuer))
      await token.contract.actions
        .transfer([issuer, feesmanager.account, feesmanagerBalance, ''])
        .send(active(issuer))

      const balance = token.contract.tables
        .accounts(getAccountCodeRaw(feesmanager.account))
        .getTableRow(assetSymbol)
      expect(balance).to.be.deep.equal({
        balance: feesmanagerBalance,
      })

      const action = feesmanager.contract.actions
        .setallowance([node1, token.account, allowanceValue])
        .send(active(feesmanager.account))

      await expectToThrow(action, errors.INSUFFICIENT_BALANCE_SET)
    })

    it('Should set the correct allowance', async () => {
      const allowanceValue = '100.0000 TKN'
      const feesmanagerBalance = '100.0000 TKN'

      await token.contract.actions.create([issuer, token.maxSupply]).send()
      await token.contract.actions
        .issue([issuer, feesmanagerBalance, ''])
        .send(active(issuer))
      await token.contract.actions
        .transfer([issuer, feesmanager.account, feesmanagerBalance, ''])
        .send(active(issuer))
      await feesmanager.contract.actions
        .setallowance([node1, token.account, allowanceValue])
        .send(active(feesmanager.account))

      const assetSymbol =
        Asset.from(allowanceValue).symbol.code.value.toString()
      const allowance = feesmanager.contract.tables
        .allowances(getAccountCodeRaw(node1))
        .getTableRow(assetSymbol)
      expect(allowance).to.be.deep.equal({
        node_allowance: allowanceValue,
        token: token.account,
      })
    })

    it('Should update the correct allowance', async () => {
      const allowanceValue = '100.0000 TKN'
      const feesmanagerBalance = '400.0000 TKN'

      await token.contract.actions.create([issuer, token.maxSupply]).send()
      await token.contract.actions
        .issue([issuer, feesmanagerBalance, ''])
        .send(active(issuer))
      await token.contract.actions
        .transfer([issuer, feesmanager.account, feesmanagerBalance, ''])
        .send(active(issuer))
      await feesmanager.contract.actions
        .setallowance([node1, token.account, allowanceValue])
        .send(active(feesmanager.account))

      const assetSymbol =
        Asset.from(allowanceValue).symbol.code.value.toString()
      const allowance = feesmanager.contract.tables
        .allowances(getAccountCodeRaw(node1))
        .getTableRow(assetSymbol)
      expect(allowance).to.be.deep.equal({
        node_allowance: allowanceValue,
        token: token.account,
      })

      const updatedAllowanceValue = '300.0000 TKN'
      await feesmanager.contract.actions
        .setallowance([node1, token.account, updatedAllowanceValue])
        .send(active(feesmanager.account))

      const updatedAllowance = feesmanager.contract.tables
        .allowances(getAccountCodeRaw(node1))
        .getTableRow(assetSymbol)
      expect(updatedAllowance).to.be.deep.equal({
        node_allowance: updatedAllowanceValue,
        token: token.account,
      })
    })
  })

  describe('feesmanager::incallowance', () => {
    it('Should reject if not authorized', async () => {
      const allowanceValue = '100.0000 TKN'
      const action = feesmanager.contract.actions
        .incallowance([node1, token.account, allowanceValue])
        .send(active(evil))

      await expectToThrow(action, errors.AUTH_MISSING(feesmanager.account))
    })

    it('Should reject if allowance plus inc value is bigger than feesmanager balance', async () => {
      const allowanceValue = '100.0000 TKN'
      const feesmanagerBalance = '100.0000 TKN'
      const assetSymbol =
        Asset.from(feesmanagerBalance).symbol.code.value.toString()

      await token.contract.actions.create([issuer, token.maxSupply]).send()
      await token.contract.actions
        .issue([issuer, feesmanagerBalance, ''])
        .send(active(issuer))
      await token.contract.actions
        .transfer([issuer, feesmanager.account, feesmanagerBalance, ''])
        .send(active(issuer))

      await feesmanager.contract.actions
        .setallowance([node1, token.account, allowanceValue])
        .send(active(feesmanager.account))

      const balance = token.contract.tables
        .accounts(getAccountCodeRaw(feesmanager.account))
        .getTableRow(assetSymbol)
      expect(balance).to.be.deep.equal({
        balance: feesmanagerBalance,
      })

      const updatedAllowanceValue = '1.0000 TKN'
      const action = feesmanager.contract.actions
        .incallowance([node1, token.account, updatedAllowanceValue])
        .send(active(feesmanager.account))

      await expectToThrow(action, errors.INSUFFICIENT_BALANCE_INC)
    })

    it('Should increase the allowance', async () => {
      const allowanceValue = '100.0000 TKN'
      const feesmanagerBalance = '400.0000 TKN'

      await token.contract.actions.create([issuer, token.maxSupply]).send()
      await token.contract.actions
        .issue([issuer, feesmanagerBalance, ''])
        .send(active(issuer))
      await token.contract.actions
        .transfer([issuer, feesmanager.account, feesmanagerBalance, ''])
        .send(active(issuer))
      await feesmanager.contract.actions
        .setallowance([node1, token.account, allowanceValue])
        .send(active(feesmanager.account))

      const assetSymbol =
        Asset.from(allowanceValue).symbol.code.value.toString()
      const allowance = feesmanager.contract.tables
        .allowances(getAccountCodeRaw(node1))
        .getTableRow(assetSymbol)
      expect(allowance).to.be.deep.equal({
        node_allowance: allowanceValue,
        token: token.account,
      })

      const updatedAllowanceValue = '300.0000 TKN'
      await feesmanager.contract.actions
        .incallowance([node1, token.account, updatedAllowanceValue])
        .send(active(feesmanager.account))

      const updatedAllowance = feesmanager.contract.tables
        .allowances(getAccountCodeRaw(node1))
        .getTableRow(assetSymbol)
      const expectedAllowanceValue = '400.0000 TKN'
      expect(updatedAllowance).to.be.deep.equal({
        node_allowance: expectedAllowanceValue,
        token: token.account,
      })
    })
  })

  describe('feesmanager::withdrawto', () => {
    it('Should reject if no allowance found', async () => {
      const tokenSymbol = Asset.from(`0.000 ${token.symbol}`).symbol
      const action = feesmanager.contract.actions
        .withdrawto([node1, token.account, tokenSymbol])
        .send(active(feesmanager.account))

      await expectToThrow(action, errors.NO_ALLOWANCE_SET)
    })

    it('Should withdraw to the node', async () => {
      const feesmanagerBalance = '100.0000 TKN'
      await token.contract.actions.create([issuer, token.maxSupply]).send()
      await token.contract.actions
        .issue([issuer, feesmanagerBalance, ''])
        .send(active(issuer))
      await token.contract.actions
        .transfer([issuer, feesmanager.account, feesmanagerBalance, ''])
        .send(active(issuer))

      const allowanceValue = '100.0000 TKN'
      await feesmanager.contract.actions
        .setallowance([node1, token.account, allowanceValue])
        .send(active(feesmanager.account))

      const assetSymbol = Asset.from(allowanceValue).symbol
      const assetSymbolCode = assetSymbol.code.value.toString()
      const allowance = feesmanager.contract.tables
        .allowances(getAccountCodeRaw(node1))
        .getTableRow(assetSymbolCode)
      expect(allowance).to.be.deep.equal({
        node_allowance: allowanceValue,
        token: token.account,
      })

      const feesmanagerBalanceBefore = await token.contract.tables
        .accounts(getAccountCodeRaw(feesmanager.account))
        .getTableRows()
      const nodeBalanceBefore = await token.contract.tables
        .accounts(getAccountCodeRaw(node1))
        .getTableRows()
      const allowanceBefore = feesmanager.contract.tables
        .allowances(getAccountCodeRaw(node1))
        .getTableRow(assetSymbolCode)
      expect(feesmanagerBalanceBefore[0]).to.be.deep.equal({
        balance: feesmanagerBalance,
      })
      expect(nodeBalanceBefore[0]).to.be.deep.equal(undefined)
      expect(allowanceBefore).to.be.deep.equal({
        node_allowance: allowanceValue,
        token: token.account,
      })

      await feesmanager.contract.actions
        .withdrawto([node1, token.account, assetSymbol])
        .send(active(feesmanager.account))

      console.log(feesmanager.contract.bc.console);
      const feesmanagerBalanceAfter = await token.contract.tables
        .accounts(getAccountCodeRaw(feesmanager.account))
        .getTableRows()
      const nodeBalanceAfter = await token.contract.tables
        .accounts(getAccountCodeRaw(node1))
        .getTableRows()
      const allowanceAfter = feesmanager.contract.tables
        .allowances(getAccountCodeRaw(node1))
        .getTableRow(assetSymbolCode)
      expect(feesmanagerBalanceAfter[0]).to.be.deep.equal({
        balance: '0.0000 TKN',
      })
      expect(nodeBalanceAfter[0]).to.be.deep.equal({
        balance: feesmanagerBalance,
      })
      expect(allowanceAfter).to.be.deep.equal({
        node_allowance: '0.0000 TKN',
        token: token.account,
      })
    })
  })

  describe('feesmanager::withdrawmtto', () => {
    it('Should withdraw multiple tokens to the node', async () => {
      const feesmanagerBalance = "50.0000 TKN"
      const feesmanagerBalance2 = "50.0000 TKM"
      await token.contract.actions
        .create([issuer, token.maxSupply]).send()
      await token.contract.actions
        .issue([issuer, feesmanagerBalance, ''])
        .send(active(issuer))
      await token.contract.actions
        .transfer([issuer, feesmanager.account, feesmanagerBalance, ''])
        .send(active(issuer))
      
      await token2.contract.actions
        .create([issuer, token2.maxSupply]).send()
      await token2.contract.actions
        .issue([issuer, feesmanagerBalance2, ''])
        .send(active(issuer))
      await token2.contract.actions
        .transfer([issuer, feesmanager.account, feesmanagerBalance2, ''])
        .send(active(issuer))

      const allowanceValue1 = "50.0000 TKN"
      await feesmanager.contract.actions
        .setallowance([node1, token.account, allowanceValue1])
        .send(active(feesmanager.account))

      const allowanceValue2 = "50.0000 TKM"
      await feesmanager.contract.actions
        .setallowance([node1, token2.account, allowanceValue2])
        .send(active(feesmanager.account))

      const assetSymbol1 = Asset.from(allowanceValue1).symbol
      const assetSymbol1Code = assetSymbol1.code.value.toString()
      const allowance1 = feesmanager.contract.tables.allowances(getAccountCodeRaw(node1)).getTableRow(assetSymbol1Code)
      expect(allowance1).to.be.deep.equal({
        node_allowance: allowanceValue1,
        token: token.account,
      })

      const assetSymbol2 = Asset.from(allowanceValue2).symbol
      const assetSymbol2Code = assetSymbol2.code.value.toString()
      const allowance2 = feesmanager.contract.tables.allowances(getAccountCodeRaw(node1)).getTableRow(assetSymbol2Code)
      expect(allowance2).to.be.deep.equal({
        node_allowance: allowanceValue2,
        token: token2.account,
      })

      const feesmanagerBalanceBefore = await token.contract.tables.accounts(getAccountCodeRaw(feesmanager.account)).getTableRows()
      const nodeBalanceBefore1 = await token.contract.tables.accounts(getAccountCodeRaw(node1)).getTableRows()
      const allowanceBefore1 = feesmanager.contract.tables.allowances(getAccountCodeRaw(node1)).getTableRow(assetSymbol1Code)
      expect(feesmanagerBalanceBefore[0]).to.be.deep.equal({
        balance: feesmanagerBalance,
      })
      expect(nodeBalanceBefore1[0]).to.be.deep.equal(undefined)
      expect(allowanceBefore1).to.be.deep.equal({
        node_allowance: allowanceValue1,
        token: token.account,
      })

      await feesmanager.contract.actions
        .withdrawmtto([node1, [token.account, token2.account], [assetSymbol1, assetSymbol2]])
        .send(active(feesmanager.account))

      console.log(feesmanager.contract.bc.console)
      const feesmanagerBalanceAfter = await token.contract.tables.accounts(getAccountCodeRaw(feesmanager.account)).getTableRows()
      const nodeBalanceAfter = await token.contract.tables.accounts(getAccountCodeRaw(node1)).getTableRows()
      const allowanceAfter = feesmanager.contract.tables.allowances(getAccountCodeRaw(node1)).getTableRow(assetSymbol1Code)
      console.log('aa', feesmanagerBalanceAfter[0])
      expect(feesmanagerBalanceAfter[0]).to.be.deep.equal({
        balance: "0.0000 TKN",
      })
      expect(nodeBalanceAfter[0]).to.be.deep.equal({
        balance: feesmanagerBalance,
      })
      expect(allowanceAfter).to.be.deep.equal({
        node_allowance: "0.0000 TKN",
        token: token.account,
      })

      const feesmanagerBalance2After = await token2.contract.tables.accounts(getAccountCodeRaw(feesmanager.account)).getTableRows()
      const nodeBalance2After = await token2.contract.tables.accounts(getAccountCodeRaw(node1)).getTableRows()
      const allowance2After = feesmanager.contract.tables.allowances(getAccountCodeRaw(node1)).getTableRow(assetSymbol2Code)
      console.log('aa', feesmanagerBalance2After[0])
      expect(feesmanagerBalance2After[0]).to.be.deep.equal({
        balance: "0.0000 TKM",
      })
      expect(nodeBalance2After[0]).to.be.deep.equal({
        balance: feesmanagerBalance2,
      })
      expect(allowance2After).to.be.deep.equal({
        node_allowance: "0.0000 TKM",
        token: token2.account,
      })
    })
  })
})
