const { Blockchain, nameToBigInt } = require('@eosnetwork/vert')
const { Name } = require('@wharfkit/antelope')
const { deploy } = require('./utils/deploy')
const { expect } = require('chai')

describe('XERC20 testing', () => {
  const symbol = 'TKN'
  const account = 'tkn.token'
  const accountActive = `${account}@active`
  const blockchain = new Blockchain()

  let xerc20
  before(async () => {
    // blockchain.createAccounts(owner)
    blockchain.createAccount(account)
    xerc20 = deploy(blockchain, account, 'contracts/xerc20')
  })

  it('Should initialize storage properly', async () => {
    await xerc20.actions.init([symbol]).send(accountActive)

    const x = Name.from(account)
    console.log(contract.bc.console)
    const supply = xerc20.tables.supply().getTableRow(nameToBigInt('supply'))

    expect(supply).to.be.equal(0)
  })
})
