const { deploy } = require('./utils/deploy')
const { Blockchain, expectToThrow } = require('@eosnetwork/vert')
const { getEvmPeginMetadataSample } = require('./utils/get-metadata-sample')
const { getEvmPeginOperationSample } = require('./utils/get-operation-sample')
const { active } = require('./utils/eos-ext')

describe('PAM testing', () => {
  let pam
  const user = 'user'
  const name = 'pam'
  const blockchain = new Blockchain()
  before(async () => {
    blockchain.createAccounts(user)
    // pam = deploy(blockchain, name, 'contracts/build/test.pam')
  })
  describe('pam::isauthorized', () => {
    it('Should authorize the operation successfully', async () => {
      const operation = getEvmPeginOperationSample()
      const metadata = getEvmPeginMetadataSample()

      // await pam.actions.isauthorized([operation, metadata]).send(active(user))
    })
  })
})
