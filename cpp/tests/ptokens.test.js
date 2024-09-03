const eoslime = require('eoslime').init('local')
const assert = require('assert')

const TOKEN_WASM_PATH = './contracts/ptokens.token.wasm'
const TOKEN_ABI_PATH = './contracts/ptokens.token.abi'

describe('EOSIO Token', function () {
  // Increase mocha(testing framework) time, otherwise tests fails
  this.timeout(15000)

  let tokenContract
  let tokensIssuer
  let tokensHolder
  let tokensReceiver
  let malicious

  let accountsTable
  let statTable

  before(async () => {
    const accounts = await eoslime.Account.createRandoms(4)
    tokensIssuer = accounts[0]
    tokensHolder = accounts[1]
    tokensReceiver = accounts[2]
    malicious = accounts[3]
  })

  beforeEach(async () => {
    /*
            `deploy` creates for you a new account behind the scene
            on which the contract code is deployed

            You can access the contract account as -> tokenContract.executor
        */
    tokenContract = await eoslime.Contract.deploy(
      TOKEN_WASM_PATH,
      TOKEN_ABI_PATH,
    )
    accountsTable = tokenContract.tables.accounts
    statTable = tokenContract.tables.stat
  })

  it('Should create a new token', async () => {
    await tokenContract.actions.create([
      tokensIssuer.name,
      '1000000000.0000 SYS',
    ])

    /*
            You have access to the EOS(eosjs) instance:
                eoslime.Provider.eos
        */
    const tokenInitialization =
      await tokenContract.provider.eos.getCurrencyStats(
        tokenContract.name,
        'SYS',
      )

    assert.equal(
      tokenInitialization.SYS.max_supply,
      '1000000000.0000 SYS',
      'Incorrect tokens supply',
    )
    assert.equal(
      tokenInitialization.SYS.issuer,
      tokensIssuer.name,
      'Incorrect tokens issuer',
    )

    const stats = await statTable.scope('SYS').find()
    assert.equal(stats.length, 1)
    assert.equal(stats[0].supply, '0.0000 SYS')
    assert.equal(stats[0].max_supply, '1000000000.0000 SYS')
    assert.equal(stats[0].issuer, tokensIssuer.name)
  })

  it('Should issue tokens', async () => {
    await tokenContract.actions.create([
      tokensIssuer.name,
      '1000000000.0000 SYS',
    ])
    await tokenContract.actions.issue(
      [tokensHolder.name, '100.0000 SYS', 'memo'],
      { from: tokensIssuer },
    )

    const holderBalance = await tokensHolder.getBalance(
      'SYS',
      tokenContract.name,
    )
    assert.equal(holderBalance[0], '100.0000 SYS', 'Incorrect holder balance')

    const stats = await statTable.scope('SYS').find()
    assert.equal(stats.length, 1)
    assert.equal(stats[0].supply, '100.0000 SYS')
    assert.equal(stats[0].max_supply, '1000000000.0000 SYS')
    assert.equal(stats[0].issuer, tokensIssuer.name)
  })

  it('Should not issue more than max supply tokens', async () => {
    await tokenContract.actions.create([tokensIssuer.name, '1000.0000 SYS'])
    try {
      await tokenContract.actions.issue(
        [tokensHolder.name, '1001.0000 SYS', 'memo'],
        { from: tokensIssuer },
      )
      assert.fail()
    } catch (err) {
      assert(err.includes('quantity exceeds available supply'))
    }
  })

  it('Should retire tokens', async () => {
    await tokenContract.actions.create([
      tokensIssuer.name,
      '1000000000.0000 SYS',
    ])
    await tokenContract.actions.issue(
      [tokensIssuer.name, '100.0000 SYS', 'memo'],
      { from: tokensIssuer },
    )
    await tokenContract.actions.issue(
      [tokensHolder.name, '100.0000 SYS', 'memo'],
      { from: tokensIssuer },
    )

    let holderBalance = await tokensIssuer.getBalance('SYS', tokenContract.name)
    assert.equal(holderBalance[0], '100.0000 SYS', 'Incorrect holder balance')
    let stats = await statTable.scope('SYS').find()
    assert.equal(stats.length, 1)
    assert.equal(stats[0].supply, '200.0000 SYS')
    assert.equal(stats[0].max_supply, '1000000000.0000 SYS')
    assert.equal(stats[0].issuer, tokensIssuer.name)

    await tokenContract.actions.retire(['50.0000 SYS', ''], {
      from: tokensIssuer,
    })

    holderBalance = await tokensIssuer.getBalance('SYS', tokenContract.name)
    assert.equal(holderBalance[0], '50.0000 SYS', 'Incorrect holder balance')
    stats = await statTable.scope('SYS').find()
    assert.equal(stats.length, 1)
    assert.equal(stats[0].supply, '150.0000 SYS')
    assert.equal(stats[0].max_supply, '1000000000.0000 SYS')
    assert.equal(stats[0].issuer, tokensIssuer.name)
  })

  it('Should not retire tokens if issuer has not enough balance', async () => {
    await tokenContract.actions.create([
      tokensIssuer.name,
      '1000000000.0000 SYS',
    ])
    await tokenContract.actions.issue(
      [tokensIssuer.name, '100.0000 SYS', 'memo'],
      { from: tokensIssuer },
    )
    await tokenContract.actions.issue(
      [tokensHolder.name, '100.0000 SYS', 'memo'],
      { from: tokensIssuer },
    )

    let holderBalance = await tokensIssuer.getBalance('SYS', tokenContract.name)
    assert.equal(holderBalance[0], '100.0000 SYS', 'Incorrect holder balance')
    let stats = await statTable.scope('SYS').find()
    assert.equal(stats.length, 1)
    assert.equal(stats[0].supply, '200.0000 SYS')
    assert.equal(stats[0].max_supply, '1000000000.0000 SYS')
    assert.equal(stats[0].issuer, tokensIssuer.name)

    try {
      await tokenContract.actions.retire(['101.0000 SYS', ''], {
        from: tokensIssuer,
      })
      assert.fail()
    } catch (err) {
      assert(err.includes('overdrawn balance'))
      holderBalance = await tokensIssuer.getBalance('SYS', tokenContract.name)
      assert.equal(holderBalance[0], '100.0000 SYS', 'Incorrect holder balance')
      stats = await statTable.scope('SYS').find()
      assert.equal(stats.length, 1)
      assert.equal(stats[0].supply, '200.0000 SYS')
      assert.equal(stats[0].max_supply, '1000000000.0000 SYS')
      assert.equal(stats[0].issuer, tokensIssuer.name)
    }
  })

  it('Should transfer tokens', async () => {
    await tokenContract.actions.create([
      tokensIssuer.name,
      '1000000000.0000 SYS',
    ])
    await tokenContract.actions.issue(
      [tokensHolder.name, '100.0000 SYS', 'memo'],
      { from: tokensIssuer },
    )

    const stats = await statTable.scope('SYS').find()
    assert.equal(stats.length, 1)
    assert.equal(stats[0].supply, '100.0000 SYS')
    assert.equal(stats[0].max_supply, '1000000000.0000 SYS')
    assert.equal(stats[0].issuer, tokensIssuer.name)

    let holderBalance = await tokensHolder.getBalance('SYS', tokenContract.name)
    let receiverBalance = await tokensReceiver.getBalance(
      'SYS',
      tokenContract.name,
    )
    assert.equal(holderBalance[0], '100.0000 SYS', 'Incorrect holder balance')
    assert.equal(receiverBalance.length, 0, 'Incorrect receiver balance')

    await tokenContract.actions.transfer(
      [tokensHolder.name, tokensReceiver.name, '75.0000 SYS', ''],
      { from: tokensHolder },
    )

    holderBalance = await tokensHolder.getBalance('SYS', tokenContract.name)
    receiverBalance = await tokensReceiver.getBalance('SYS', tokenContract.name)
    assert.equal(holderBalance[0], '25.0000 SYS', 'Incorrect holder balance')
    assert.equal(
      receiverBalance[0],
      '75.0000 SYS',
      'Incorrect receiver balance',
    )

    const holderAccount = await accountsTable.scope(tokensHolder.name).find()
    assert.equal(holderAccount[0].balance, '25.0000 SYS')
    const receiverAccount = await accountsTable
      .scope(tokensReceiver.name)
      .find()
    assert.equal(receiverAccount[0].balance, '75.0000 SYS')
  })

  it('Should fail transfer if more than available balance', async () => {
    await tokenContract.actions.create([
      tokensIssuer.name,
      '1000000000.0000 SYS',
    ])
    await tokenContract.actions.issue(
      [tokensHolder.name, '100.0000 SYS', 'memo'],
      { from: tokensIssuer },
    )

    const stats = await statTable.scope('SYS').find()
    assert.equal(stats.length, 1)
    assert.equal(stats[0].supply, '100.0000 SYS')
    assert.equal(stats[0].max_supply, '1000000000.0000 SYS')
    assert.equal(stats[0].issuer, tokensIssuer.name)

    let holderBalance = await tokensHolder.getBalance('SYS', tokenContract.name)
    let receiverBalance = await tokensReceiver.getBalance(
      'SYS',
      tokenContract.name,
    )
    assert.equal(holderBalance[0], '100.0000 SYS', 'Incorrect holder balance')
    assert.equal(receiverBalance.length, 0, 'Incorrect receiver balance')

    eoslime.tests.expectAssert(
      tokenContract.actions.transfer(
        [tokensHolder.name, tokensReceiver.name, '150.0000 SYS', ''],
        { from: tokensHolder },
      ),
    )

    holderBalance = await tokensHolder.getBalance('SYS', tokenContract.name)
    receiverBalance = await tokensReceiver.getBalance('SYS', tokenContract.name)
    assert.equal(holderBalance[0], '100.0000 SYS', 'Incorrect holder balance')
    assert.equal(receiverBalance.length, 0, 'Incorrect receiver balance')
  })

  it('Should redeem (redeem)', async () => {
    await tokenContract.actions.create([
      tokensIssuer.name,
      '1000000000.0000 SYS',
    ])
    await tokenContract.actions.issue(
      [tokensHolder.name, '100.0000 SYS', 'memo'],
      { from: tokensIssuer },
    )

    let stats = await statTable.scope('SYS').find()
    assert.equal(stats.length, 1)
    assert.equal(stats[0].supply, '100.0000 SYS')
    assert.equal(stats[0].max_supply, '1000000000.0000 SYS')
    assert.equal(stats[0].issuer, tokensIssuer.name)

    let holderBalance = await tokensHolder.getBalance('SYS', tokenContract.name)
    await tokenContract.actions.redeem([tokensHolder.name, '10.0000 SYS', ''], {
      from: tokensHolder,
    })
    holderBalance = await tokensHolder.getBalance('SYS', tokenContract.name)
    assert.equal(holderBalance[0], '90.0000 SYS', 'Incorrect holder balance')

    stats = await statTable.scope('SYS').find()
    assert.equal(stats.length, 1)
    assert.equal(stats[0].supply, '90.0000 SYS')
    assert.equal(stats[0].max_supply, '1000000000.0000 SYS')
    assert.equal(stats[0].issuer, tokensIssuer.name)

    const accounts = await accountsTable.scope(tokensHolder.name).find()
    assert.equal(accounts[0].balance, '90.0000 SYS')
  })

  it('Should redeem (redeem2)', async () => {
    await tokenContract.actions.create([
      tokensIssuer.name,
      '1000000000.0000 SYS',
    ])
    await tokenContract.actions.issue(
      [tokensHolder.name, '100.0000 SYS', 'memo'],
      { from: tokensIssuer },
    )

    let stats = await statTable.scope('SYS').find()
    assert.equal(stats.length, 1)
    assert.equal(stats[0].supply, '100.0000 SYS')
    assert.equal(stats[0].max_supply, '1000000000.0000 SYS')
    assert.equal(stats[0].issuer, tokensIssuer.name)

    let holderBalance = await tokensHolder.getBalance('SYS', tokenContract.name)
    await tokenContract.actions.redeem2(
      [tokensHolder.name, '10.0000 SYS', '', '0xc0ffee', '0x123abc'],
      { from: tokensHolder },
    )
    holderBalance = await tokensHolder.getBalance('SYS', tokenContract.name)
    assert.equal(holderBalance[0], '90.0000 SYS', 'Incorrect holder balance')

    stats = await statTable.scope('SYS').find()
    assert.equal(stats.length, 1)
    assert.equal(stats[0].supply, '90.0000 SYS')
    assert.equal(stats[0].max_supply, '1000000000.0000 SYS')
    assert.equal(stats[0].issuer, tokensIssuer.name)

    const accounts = await accountsTable.scope(tokensHolder.name).find()
    assert.equal(accounts[0].balance, '90.0000 SYS')
  })

  it('Should not redeem negative quantity (redeem)', async () => {
    await tokenContract.actions.create([
      tokensIssuer.name,
      '1000000000.0000 SYS',
    ])
    await tokenContract.actions.issue(
      [tokensHolder.name, '100.0000 SYS', 'memo'],
      { from: tokensIssuer },
    )

    let stats = await statTable.scope('SYS').find()
    assert.equal(stats.length, 1)
    assert.equal(stats[0].supply, '100.0000 SYS')
    assert.equal(stats[0].max_supply, '1000000000.0000 SYS')
    assert.equal(stats[0].issuer, tokensIssuer.name)

    let holderBalance = await tokensHolder.getBalance('SYS', tokenContract.name)
    try {
      await tokenContract.actions.redeem(
        [tokensHolder.name, '-10.0000 SYS', ''],
        { from: tokensHolder },
      )
      assert.fail()
    } catch (err) {
      assert(err.includes('must redeem positive quantity'))
      holderBalance = await tokensHolder.getBalance('SYS', tokenContract.name)
      assert.equal(holderBalance[0], '100.0000 SYS', 'Incorrect holder balance')

      stats = await statTable.scope('SYS').find()
      assert.equal(stats.length, 1)
      assert.equal(stats[0].supply, '100.0000 SYS')
      assert.equal(stats[0].max_supply, '1000000000.0000 SYS')
      assert.equal(stats[0].issuer, tokensIssuer.name)

      const accounts = await accountsTable.scope(tokensHolder.name).find()
      assert.equal(accounts[0].balance, '100.0000 SYS')
    }
  })

  it('Should not redeem negative quantity (redeem2)', async () => {
    await tokenContract.actions.create([
      tokensIssuer.name,
      '1000000000.0000 SYS',
    ])
    await tokenContract.actions.issue(
      [tokensHolder.name, '100.0000 SYS', 'memo'],
      { from: tokensIssuer },
    )

    let stats = await statTable.scope('SYS').find()
    assert.equal(stats.length, 1)
    assert.equal(stats[0].supply, '100.0000 SYS')
    assert.equal(stats[0].max_supply, '1000000000.0000 SYS')
    assert.equal(stats[0].issuer, tokensIssuer.name)

    let holderBalance = await tokensHolder.getBalance('SYS', tokenContract.name)
    try {
      await tokenContract.actions.redeem2(
        [tokensHolder.name, '-10.0000 SYS', '', '0xc0ffee', '0x123abc'],
        { from: tokensHolder },
      )
      assert.fail()
    } catch (err) {
      assert(err.includes('must redeem positive quantity'))
      holderBalance = await tokensHolder.getBalance('SYS', tokenContract.name)
      assert.equal(holderBalance[0], '100.0000 SYS', 'Incorrect holder balance')

      stats = await statTable.scope('SYS').find()
      assert.equal(stats.length, 1)
      assert.equal(stats[0].supply, '100.0000 SYS')
      assert.equal(stats[0].max_supply, '1000000000.0000 SYS')
      assert.equal(stats[0].issuer, tokensIssuer.name)

      const accounts = await accountsTable.scope(tokensHolder.name).find()
      assert.equal(accounts[0].balance, '100.0000 SYS')
    }
  })

  it('Should not redeem on behalf of another account (redeem)', async () => {
    await tokenContract.actions.create([
      tokensIssuer.name,
      '1000000000.0000 SYS',
    ])
    await tokenContract.actions.issue(
      [tokensHolder.name, '100.0000 SYS', 'memo'],
      { from: tokensIssuer },
    )
    await tokenContract.actions.issue(
      [malicious.name, '100.0000 SYS', 'memo'],
      { from: tokensIssuer },
    )

    let stats = await statTable.scope('SYS').find()
    assert.equal(stats.length, 1)
    assert.equal(stats[0].supply, '200.0000 SYS')
    assert.equal(stats[0].max_supply, '1000000000.0000 SYS')
    assert.equal(stats[0].issuer, tokensIssuer.name)

    let holderBalance = await tokensHolder.getBalance('SYS', tokenContract.name)
    try {
      await tokenContract.actions.redeem(
        [tokensHolder.name, '10.0000 SYS', ''],
        { from: malicious },
      )
      assert.fail()
    } catch (err) {
      assert(err.includes(`missing authority of ${tokensHolder.name}`))
      holderBalance = await tokensHolder.getBalance('SYS', tokenContract.name)
      assert.equal(holderBalance[0], '100.0000 SYS', 'Incorrect holder balance')

      stats = await statTable.scope('SYS').find()
      assert.equal(stats.length, 1)
      assert.equal(stats[0].supply, '200.0000 SYS')
      assert.equal(stats[0].max_supply, '1000000000.0000 SYS')
      assert.equal(stats[0].issuer, tokensIssuer.name)

      const accounts = await accountsTable.scope(tokensHolder.name).find()
      assert.equal(accounts[0].balance, '100.0000 SYS')
    }
  })

  it('Should not redeem on behalf of another account (redeem2)', async () => {
    await tokenContract.actions.create([
      tokensIssuer.name,
      '1000000000.0000 SYS',
    ])
    await tokenContract.actions.issue(
      [tokensHolder.name, '100.0000 SYS', 'memo'],
      { from: tokensIssuer },
    )
    await tokenContract.actions.issue(
      [malicious.name, '100.0000 SYS', 'memo'],
      { from: tokensIssuer },
    )

    let stats = await statTable.scope('SYS').find()
    assert.equal(stats.length, 1)
    assert.equal(stats[0].supply, '200.0000 SYS')
    assert.equal(stats[0].max_supply, '1000000000.0000 SYS')
    assert.equal(stats[0].issuer, tokensIssuer.name)

    let holderBalance = await tokensHolder.getBalance('SYS', tokenContract.name)
    try {
      await tokenContract.actions.redeem2(
        [tokensHolder.name, '10.0000 SYS', '', '0xc0ffee', '0x123abc'],
        { from: malicious },
      )
      assert.fail()
    } catch (err) {
      assert(err.includes(`missing authority of ${tokensHolder.name}`))
      holderBalance = await tokensHolder.getBalance('SYS', tokenContract.name)
      assert.equal(holderBalance[0], '100.0000 SYS', 'Incorrect holder balance')

      stats = await statTable.scope('SYS').find()
      assert.equal(stats.length, 1)
      assert.equal(stats[0].supply, '200.0000 SYS')
      assert.equal(stats[0].max_supply, '1000000000.0000 SYS')
      assert.equal(stats[0].issuer, tokensIssuer.name)

      const accounts = await accountsTable.scope(tokensHolder.name).find()
      assert.equal(accounts[0].balance, '100.0000 SYS')
    }
  })

  it('Should open and close', async () => {
    await tokenContract.actions.create([
      tokensIssuer.name,
      '1000000000.0000 SYS',
    ])
    await tokenContract.actions.open(
      [tokensHolder.name, '4,SYS', tokensHolder.name],
      { from: tokensHolder },
    )
    let accounts = await accountsTable.scope(tokensHolder.name).find()
    assert.equal(accounts[0].balance, '0.0000 SYS')
    await tokenContract.actions.close([tokensHolder.name, '4,SYS'], {
      from: tokensHolder,
    })
    accounts = await accountsTable.scope(tokensHolder.name).find()
    assert.equal(accounts.length, 0)
  })

  it('Should throw if tokens quantity is negative', async () => {
    await tokenContract.actions.create([
      tokensIssuer.name,
      '1000000000.0000 SYS',
    ])
    const INVALID_ISSUING_AMOUNT = '-100.0000 SYS'
    try {
      await tokenContract.actions.issue(
        [tokensHolder.name, INVALID_ISSUING_AMOUNT, 'memo'],
        { from: tokensIssuer },
      )
      assert.fail()
    } catch (err) {
      assert(err.includes('must issue positive quantity'))
      const holderBalance = await tokensHolder.getBalance(
        'SYS',
        tokenContract.name,
      )
      assert.equal(holderBalance.length, 0, 'Incorrect holder balance')
    }
  })
})
