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

  const blockchain = new Blockchain()

  const user = 'user'
  const evil = 'evil'
  const issuer = 'issuer'
  const bridge = 'bridge'
  const recipient = 'recipient'
  const securitycouncil = 'seccouncil'
  const node1 = 'nodeone'
  const node2 = 'nodetwo'

  before(async () => {
    blockchain.createAccounts(user, evil, issuer, node1, recipient, securitycouncil)
    feesmanager.contract = deploy(blockchain, feesmanager.account, 'contracts/build/feesmanager')
    token.contract = deploy(blockchain, token.account, 'contracts/build/eosio.token')
    xerc20.contract = deploy(
      blockchain,
      xerc20.account,
      'contracts/build/xerc20.token',
    )
  })

  describe('feesmanager::setallowance', () => {
    it('Should set the correct allowance', async () => {
      const allowanceValue = "100.0000 TKN"

      await feesmanager.contract.actions
        .setallowance([node1, allowanceValue])
        .send(active(feesmanager.account))

      const assetSymbol = Asset.from(allowanceValue).symbol.code.value.toString()
      const allowance = feesmanager.contract.tables.allowances(getAccountCodeRaw(node1)).getTableRow(assetSymbol)
      expect(allowance).to.be.deep.equal({
        allowance_data: allowanceValue,
      })
    })

    it('Should update the correct allowance', async () => {
      const allowanceValue = "100.0000 TKN"
      await feesmanager.contract.actions
        .setallowance([node1, allowanceValue])
        .send(active(feesmanager.account))

      const assetSymbol = Asset.from(allowanceValue).symbol.code.value.toString()
      const allowance = feesmanager.contract.tables.allowances(getAccountCodeRaw(node1)).getTableRow(assetSymbol)
      expect(allowance).to.be.deep.equal({
        allowance_data: allowanceValue,
      })

      const updatedAllowanceValue = "300.0000 TKN"
      await feesmanager.contract.actions
        .setallowance([node1, updatedAllowanceValue])
        .send(active(feesmanager.account))

      const updatedAllowance = feesmanager.contract.tables.allowances(getAccountCodeRaw(node1)).getTableRow(assetSymbol)
      expect(updatedAllowance).to.be.deep.equal({
        allowance_data: updatedAllowanceValue,
      })
    })
  })

  describe('feesmanager::incallowance', () => {
    it('Should increase the allowance', async () => {
      const allowanceValue = "100.0000 TKN"
      await feesmanager.contract.actions
        .setallowance([node1, allowanceValue])
        .send(active(feesmanager.account))

      const assetSymbol = Asset.from(allowanceValue).symbol.code.value.toString()
      const allowance = feesmanager.contract.tables.allowances(getAccountCodeRaw(node1)).getTableRow(assetSymbol)
      expect(allowance).to.be.deep.equal({
        allowance_data: allowanceValue,
      })

      const updatedAllowanceValue = "300.0000 TKN"
      await feesmanager.contract.actions
        .incallowance([node1, updatedAllowanceValue])
        .send(active(feesmanager.account))

      const updatedAllowance = feesmanager.contract.tables.allowances(getAccountCodeRaw(node1)).getTableRow(assetSymbol)
      const expectedAllowanceValue = "400.0000 TKN"
      expect(updatedAllowance).to.be.deep.equal({
        allowance_data: expectedAllowanceValue,
      })
    })
  })

  describe('feesmanager::withdrawto', () => {
    it('Should withdraw to the node', async () => {
      const feesmanagerBalance = "100.0000 TKN" 
      await token.contract.actions
        .create([issuer, token.maxSupply]).send()
      await token.contract.actions
        .issue([issuer, feesmanagerBalance, ''])
        .send(active(issuer))
      await token.contract.actions
        .transfer([issuer, feesmanager.account, feesmanagerBalance, ''])
        .send(active(issuer))

      const allowanceValue = "100.0000 TKN"
      await feesmanager.contract.actions
        .setallowance([node1, allowanceValue])
        .send(active(feesmanager.account))

      const assetSymbol = Asset.from(allowanceValue).symbol.code.value.toString()
      const allowance = feesmanager.contract.tables.allowances(getAccountCodeRaw(node1)).getTableRow(assetSymbol)
      expect(allowance).to.be.deep.equal({
        allowance_data: allowanceValue,
      })

      const feesmanagerBalanceBefore = await token.contract.tables.accounts(getAccountCodeRaw(feesmanager.account)).getTableRows()
      const nodeBalanceBefore = await token.contract.tables.accounts(getAccountCodeRaw(node1)).getTableRows()
      const allowanceBefore = feesmanager.contract.tables.allowances(getAccountCodeRaw(node1)).getTableRow(assetSymbol)
      expect(feesmanagerBalanceBefore[0]).to.be.deep.equal({
        balance: feesmanagerBalance,
      })
      expect(nodeBalanceBefore[0]).to.be.deep.equal(undefined)
      expect(allowanceBefore).to.be.deep.equal({
        allowance_data: allowanceValue,
      })
      
      await feesmanager.contract.actions
        .withdrawto([node1, token.account, allowanceValue])
        .send(active(feesmanager.account))

      const feesmanagerBalanceAfter = await token.contract.tables.accounts(getAccountCodeRaw(feesmanager.account)).getTableRows()
      const nodeBalanceAfter = await token.contract.tables.accounts(getAccountCodeRaw(node1)).getTableRows()
      const allowanceAfter = feesmanager.contract.tables.allowances(getAccountCodeRaw(node1)).getTableRow(assetSymbol)
      expect(feesmanagerBalanceAfter[0]).to.be.deep.equal({
        balance: "0.0000 TKN",
      })
      expect(nodeBalanceAfter[0]).to.be.deep.equal({
        balance: feesmanagerBalance,
      })
      expect(allowanceAfter).to.be.deep.equal({
        allowance_data: "0.0000 TKN",
      })
    })
  })
})
