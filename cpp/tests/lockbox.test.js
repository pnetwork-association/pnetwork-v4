const { Blockchain, nameToBigInt } = require('@eosnetwork/vert')
const { expect } = require('chai')
const blockchain = new Blockchain()

// Load contract (use paths relative to the root of the project)
const CONTRACT_NAME_LOCKBOX = 'lockbox'
const CONTRACT_NAME_EOSIO = 'eosio.token'

const contracts = {
  lockbox: blockchain.createContract(
    CONTRACT_NAME_LOCKBOX,
    `contracts/${CONTRACT_NAME_LOCKBOX}`,
    true,
  ),
  token: blockchain.createContract(
    CONTRACT_NAME_EOSIO,
    `contracts/${CONTRACT_NAME_EOSIO}`,
    true,
  ),
}

describe('Lockbox contract testing', () => {
  const owner = 'deployer'
  const user = 'user'
  const evil = 'evil'
  const eosToken = 'tkn.token'
  const xerc20 = 'xtkn.token'
  const isNative = false

  beforeEach(async () => {
    blockchain.resetTables()
    const supply = `1000000000.0000 EOS`
    await contracts.token.actions.create(['eosio.token', supply]).send()
    await contracts.token.actions.issue(['eosio.token', supply, '']).send()
    await contracts.token.actions
      .transfer(['eosio.token', owner, '1000.0000 EOS', ''])
      .send()
    await contracts.token.actions
      .transfer(['eosio.token', user, '1000.0000 EOS', ''])
      .send()
    await contracts.token.actions
      .transfer(['eosio.token', evil, '1000.0000 EOS', ''])
      .send()
  })

  it('Should initialize storage properly', async () => {
    blockchain.createAccounts(owner, user, evil, eosToken, xerc20)

    await contracts.lockbox.actions
      .init([xerc20, eosToken, isNative])
      .send(`${owner}@active`)

    const rows = contracts.lockbox.tables
      .storage(nameToBigInt(CONTRACT_NAME_LOCKBOX))
      .getTableRow(nameToBigInt(eosToken))

    const expected = {
      XERC20: xerc20,
      ERC20: eosToken,
      IS_NATIVE: isNative,
    }

    expect(rows).to.be.deep.equal(expected)
  })

  it('Should convert EOS tokens into XERC20 tokens', async () => {})
})
