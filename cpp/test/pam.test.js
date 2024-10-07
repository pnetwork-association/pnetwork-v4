const { deploy } = require('./utils/deploy')
const { Blockchain, expectToThrow } = require('@eosnetwork/vert')
const { getMetadataSample } = require('./utils/get-metadata-sample')
const { getOperationSample } = require('./utils/get-operation-sample')
const { active } = require('./utils/eos-ext')

describe('PAM testing', () => {
  let pam
  const user = 'user'
  const name = 'pam'
  const blockchain = new Blockchain()
  before(async () => {
    blockchain.createAccounts(user)
    pam = deploy(blockchain, name, 'contracts/build/test.pam')
  })
  describe('pam::isauthorized', () => {
    it('Should authorize the operation successfully', async () => {
      const operation = getOperationSample()
      const metadata = getMetadataSample()

      await pam.actions.isauthorized([operation, metadata]).send(active(user))
    })
  })
})
