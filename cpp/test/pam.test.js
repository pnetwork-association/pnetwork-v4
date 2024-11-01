const { Blockchain, expectToThrow } = require('@eosnetwork/vert')
const {
  Chains,
  ProofcastEventAttestator,
  Protocols,
  Versions,
} = require('@pnetwork/event-attestator')
const { expect } = require('chai')
const { parseUnits, zeroPadValue } = require('ethers')

const {
  deploy,
  errors,
  getMetadataSample,
  getOperationSample,
  hexStringToBytes,
  hexToPublicKey,
  no0x,
} = require('./utils')
const { active, getSingletonInstance } = require('./utils/eos-ext')

describe('PAM testing', () => {
  const user = 'user'

  const pam = {
    account: 'pam',
    contract: null,
  }

  const adapter = {
    account: 'adapter',
    contract: null,
  }

  const privateKey =
    'dfcc79a57e91c42d7eea05f82a08bd1b7e77f30236bb7c56fe98d3366a1929c4'

  const ea = new ProofcastEventAttestator({
    version: Versions.V1,
    protocolId: Protocols.Evm,
    chainId: Chains(Protocols.Evm).Mainnet,
    privateKey,
  })

  const publicKey = hexToPublicKey(ea.signingKey.compressedPublicKey)

  const evmEmitter = hexStringToBytes(
    zeroPadValue('0x5623D0aF4bfb6F7B18d6618C166d518E4357ceE2', 32),
  )
  const evmTopic0 = hexStringToBytes(
    '0x66756e6473206172652073616675207361667520736166752073616675202e2e',
  )

  const attestation = []
  const blockchain = new Blockchain()
  const operation = getOperationSample({
    amount: '9983.0000 TKN',
    token: '000000000000000000000000f2e246bb76df876cef8b38ae84130f4f55de395b',
    chainId: 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906',
  })
  const data =
    '0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000f2e246bb76df876cef8b38ae84130f4f55de395baca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e90600000000000000000000000000000000000000000000000000000000000026ff0000000000000000000000002b5ad5c4795c026514f8317c7a215e218dccd6cf000000000000000000000000000000000000000000000000000000000000002a307836383133456239333632333732454546363230306633623164624333663831393637316342413639'
  const event = {
    blockHash: operation.blockId,
    transactionHash: operation.txId,
    address: evmEmitter,
    topics: [evmTopic0, zeroPadValue('0x', 32)],
    data,
  }

  const signature = no0x(ea.formatEosSignature(ea.sign(event)))
  const preimage = no0x(ea.getEventPreImage(event))
  const metadata = getMetadataSample({ signature, preimage })

  before(async () => {
    blockchain.createAccounts(user)
    pam.contract = deploy(blockchain, pam.account, 'contracts/build/test.pam')
    adapter.contract = deploy(
      blockchain,
      adapter.account,
      'contracts/build/adapter',
    )
  })

  describe('pam::check_authorization', () => {
    it('Should set the adapter contract', async () => {
      await pam.contract.actions
        .setadapter([adapter.account])
        .send(active(pam.account))

      expect(getSingletonInstance(pam.contract, 'adapter')).to.be.equal(
        adapter.account,
      )
    })

    it('Should reject when the public key is not set', async () => {
      const action = pam.contract.actions
        .isauthorized([operation, metadata])
        .send(active(user))

      await expectToThrow(action, errors.SINGLETON_NOT_EXISTING)
    })

    it('Should reject when the origin_chain_id is not set', async () => {
      const anotherEventAttestator = new ProofcastEventAttestator()
      const anotherPublicKey = hexToPublicKey(
        anotherEventAttestator.signingKey.compressedPublicKey,
      )
      await adapter.contract.actions
        .settee([anotherPublicKey, attestation])
        .send(active(adapter.account))

      const action = pam.contract.actions
        .isauthorized([operation, metadata])
        .send(active(user))

      await expectToThrow(action, errors.ORIGIN_CHAINID_NOT_REGISTERED)
    })

    it('Should reject if the signature is invalid', async () => {
      // We will correct these later
      const wrongEmitter = no0x(zeroPadValue('0x010203', 32))
      const wrongTopic0 = no0x(zeroPadValue('0x010203', 32))
      await adapter.contract.actions
        .setorigin([operation.originChainId, wrongEmitter, wrongTopic0])
        .send(active(adapter.account))

      // TODO: change private key and re-enable
      const action = pam.contract.actions
        .isauthorized([operation, metadata])
        .send(active(user))

      await expectToThrow(action, errors.INVALID_SIGNATURE)
    })

    it('Should reject if the emitter is different', async () => {
      // Should set the correct key that have signed the event
      await adapter.contract.actions
        .settee([publicKey, attestation])
        .send(active(adapter.account))

      const action = pam.contract.actions
        .isauthorized([operation, metadata])
        .send(active(user))

      await expectToThrow(action, errors.UNEXPECTED_EMITTER)
    })

    it('Should reject if the topic zero is different', async () => {
      // Should set the correct emitter

      const wrongTopic0 = no0x(zeroPadValue('0x010203', 32))

      await adapter.contract.actions
        .setorigin([operation.originChainId, evmEmitter, wrongTopic0])
        .send(active(adapter.account))

      const action = pam.contract.actions
        .isauthorized([operation, metadata])
        .send(active(user))

      await expectToThrow(action, errors.UNEXPECTED_TOPIC_ZERO)

      // Should set the correct topic zero
      await adapter.contract.actions
        .setorigin([operation.originChainId, evmEmitter, evmTopic0])
        .send(active(adapter.account))
    })

    describe('Operatiion variants', () => {
      it('Should reject if nonce is different', async () => {
        const wrongOperation = {
          ...operation,
          nonce: 1,
        }

        const action = pam.contract.actions
          .isauthorized([wrongOperation, metadata])
          .send(active(user))

        await expectToThrow(action, errors.INVALID_NONCE)
      })

      it('Should reject if token address does not match', async () => {
        const wrongOperation = {
          ...operation,
          token: no0x(zeroPadValue('0x01', 32)),
        }

        const action = pam.contract.actions
          .isauthorized([wrongOperation, metadata])
          .send(active(user))

        await expectToThrow(action, errors.INVALID_TOKEN_ADDRESS)
      })

      it('Should reject if the destination chain id does not match', async () => {
        const wrongOperation = {
          ...operation,
          destinationChainId: no0x(zeroPadValue('0x01', 32)),
        }
        const action = pam.contract.actions
          .isauthorized([wrongOperation, metadata])
          .send(active(user))

        await expectToThrow(action, errors.INVALID_DESTINATION_CHAIN)
      })

      it('Should reject when the amount is different', async () => {
        const wrongOperation = {
          ...operation,
          amount: '1 XTKN',
        }

        const action = pam.contract.actions
          .isauthorized([wrongOperation, metadata])
          .send(active(user))

        await expectToThrow(action, errors.INVALID_AMOUNT)
      })

      // TODO: stuck because amount is not an asset
      // it('Should reject when the sender is different', async () => {
      //   const wrongOperation = {
      //     ...operation,
      //     sender: no0x(zeroPadValue('0x01', 32)),
      //   }

      //   let action
      //   try {
      //     action = await pam.contract.actions
      //       .isauthorized([wrongOperation, metadata])
      //       .send(active(user))
      //   } finally {
      //     console.log(pam.contract.bc.console)
      //   }

      //   await expectToThrow(action, errors.INVALID_SENDER)
      // })

      // TODO: implement
      // it('Should reject if the operation chain id is different from the underlying chain one', async () => {})
    })
  })
})
