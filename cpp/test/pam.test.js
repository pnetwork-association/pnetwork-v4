const { Blockchain, expectToThrow } = require('@eosnetwork/vert')
const {
  Chains,
  ProofcastEventAttestator,
  Protocols,
  Versions,
} = require('@pnetwork/event-attestator')
const {
  no0x,
  deploy,
  errors,
  bytes32,
  getOperation,
  getMetadataSample,
  fromEthersPublicKey,
} = require('./utils')
const { expect } = require('chai')
const { active, getSingletonInstance } = require('./utils/eos-ext')
const { serializeOperation } = require('./utils/get-operation-sample')

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

  const publicKey = fromEthersPublicKey(ea.signingKey.compressedPublicKey)

  const evmSwapAmount = 13
  const evmEmitter = '0x5623D0aF4bfb6F7B18d6618C166d518E4357ceE2'
  const evmTopic0 =
    '0x66756e6473206172652073616675207361667520736166752073616675202e2e'
  const EOSChainId =
    'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906'

  const recipient = 'recipient'

  const attestation = []
  const blockchain = new Blockchain()

  let operation = getOperation({
    blockId:
      '0x21d41bf94358b9252115aee1eb250ef5a644e7fae776b3de508aacda5f4c26fc',
    txId: '0x6be2de7375ad7c18fd5ca3ecc8b70e60c535750b042200070dc36f84175a16d6',
    nonce: 0,
    token: '0xf2e246bb76df876cef8b38ae84130f4f55de395b',
    originChainId: Chains(Protocols.Evm).Mainnet,
    destinationChainId: Chains(Protocols.Eos).Mainnet,
    amount: evmSwapAmount,
    sender: '0x2b5ad5c4795c026514f8317c7a215e218dccd6cf',
    recipient,
    data: '',
  })

  const data = serializeOperation(operation)

  operation = no0x(operation)

  const event = {
    blockHash: operation.blockId,
    transactionHash: operation.txId,
    address: evmEmitter,
    topics: [evmTopic0],
    data,
  }

  const signature = ea.formatEosSignature(ea.sign(event))
  const preimage = ea.getEventPreImage(event)
  const metadata = no0x({ signature, preimage })

  before(async () => {
    blockchain.createAccounts(user, recipient)
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

    it('Should reject when the local chain id is not set', async () => {
      const action = pam.contract.actions
        .isauthorized([operation, metadata])
        .send(active(user))

      await expectToThrow(action, errors.LOCAL_CHAIN_NOT_SET)
    })

    it('Should reject when the public key is not set', async () => {
      await adapter.contract.actions
        .setchainid([EOSChainId])
        .send(active(adapter.account))

      const action = pam.contract.actions
        .isauthorized([operation, metadata])
        .send(active(user))

      await expectToThrow(action, errors.TEE_NOT_SET)
    })

    it('Should reject when the origin_chain_id is not set', async () => {
      await adapter.contract.actions
        .settee([publicKey, attestation])
        .send(active(adapter.account))

      const action = pam.contract.actions
        .isauthorized([operation, metadata])
        .send(active(user))

      await expectToThrow(action, errors.ORIGIN_CHAINID_NOT_REGISTERED)
    })

    it('Should reject if the signature is invalid', async () => {
      await adapter.contract.actions
        .setorigin([
          operation.originChainId,
          no0x(bytes32(evmEmitter)),
          no0x(evmTopic0),
        ])
        .send(active(adapter.account))

      const tmpEA = new ProofcastEventAttestator()
      const wrongKeySignedMetadata = no0x({
        preimage,
        signature: tmpEA.formatEosSignature(tmpEA.signBytes(preimage)),
      })

      const action = pam.contract.actions
        .isauthorized([operation, wrongKeySignedMetadata])
        .send(active(user))

      await expectToThrow(action, errors.INVALID_SIGNATURE)
    })

    it('Should reject if the emitter is different', async () => {
      // Setting the correct key
      await adapter.contract.actions
        .settee([publicKey, attestation])
        .send(active(adapter.account))

      const wrongEmitter = bytes32('0x5123D0aF4bfb6F7B18d6618C166d518E4357ceE2')

      await adapter.contract.actions
        .setorigin([
          operation.originChainId,
          no0x(wrongEmitter),
          no0x(evmTopic0),
        ])
        .send(active(adapter.account))

      const action = pam.contract.actions
        .isauthorized([operation, metadata])
        .send(active(user))

      await expectToThrow(action, errors.UNEXPECTED_EMITTER)
    })

    it('Should reject if the topic zero is different', async () => {
      const wrongTopic0 = no0x(bytes32('0x010203'))

      await adapter.contract.actions
        .setorigin([
          operation.originChainId,
          no0x(bytes32(evmEmitter)),
          wrongTopic0,
        ])
        .send(active(adapter.account))

      const action = pam.contract.actions
        .isauthorized([operation, metadata])
        .send(active(user))

      await expectToThrow(action, errors.UNEXPECTED_TOPIC_ZERO)

      // Should set the correct topic zero
      await adapter.contract.actions
        .setorigin([
          operation.originChainId,
          no0x(bytes32(evmEmitter)),
          no0x(bytes32(evmTopic0)),
        ])
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
          token: no0x(bytes32('0x01')),
        }

        const action = pam.contract.actions
          .isauthorized([wrongOperation, metadata])
          .send(active(user))

        await expectToThrow(action, errors.INVALID_TOKEN_ADDRESS)
      })

      it('Should reject if the destination chain id does not match', async () => {
        const wrongOperation = {
          ...operation,
          destinationChainId: no0x(bytes32('0x01')),
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

      it('Should reject when the sender is different', async () => {
        const wrongOperation = {
          ...operation,
          sender: no0x(bytes32('0x01')),
        }

        action = pam.contract.actions
          .isauthorized([wrongOperation, metadata])
          .send(active(user))

        await expectToThrow(action, errors.INVALID_SENDER)
      })

      it('Should reject when the recipient is different', async () => {
        const wrongOperation = {
          ...operation,
          recipient: 'evil',
        }

        action = pam.contract.actions
          .isauthorized([wrongOperation, metadata])
          .send(active(user))

        await expectToThrow(action, errors.INVALID_RECIPIENT)
      })

      it('Should reject when the recipient is a string too long', async () => {
        const invalid = 'invalidrecipient'
        const wrongOperation = {
          ...operation,
          recipient: invalid,
        }

        const data =
          '0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000f2e246bb76df876cef8b38ae84130f4f55de395baca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906000000000000000000000000000000000000000000000000b469471f801400000000000000000000000000002b5ad5c4795c026514f8317c7a215e218dccd6cf0000000000000000000000000000000000000000000000000000000000000010696e76616c6964726563697069656e74'
        const newEvent = { ...event, data }
        const metadata = {
          preimage: no0x(ea.getEventPreImage(newEvent)),
          signature: no0x(ea.formatEosSignature(ea.sign(newEvent))),
        }

        action = pam.contract.actions
          .isauthorized([wrongOperation, metadata])
          .send(active(user))

        await expectToThrow(action, errors.ACCOUNT_STR_IS_TOO_LONG)
      })

      it('Should reject when the recipient is an invalid account', async () => {
        const wrong = {
          ...operation,
          recipient: 'invalid',
        }
        const data =
          '0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000f2e246bb76df876cef8b38ae84130f4f55de395baca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906000000000000000000000000000000000000000000000000b469471f801400000000000000000000000000002b5ad5c4795c026514f8317c7a215e218dccd6cf0000000000000000000000000000000000000000000000000000000000000007696e76616c6964'
        const newEvent = { ...event, data }
        const metadata = {
          preimage: no0x(ea.getEventPreImage(newEvent)),
          signature: no0x(ea.formatEosSignature(ea.sign(newEvent))),
        }

        action = pam.contract.actions
          .isauthorized([wrong, metadata])
          .send(active(user))

        await expectToThrow(action, errors.INVALID_ACCOUNT)
      })

      it('Should reject when user data is different', async () => {
        const wrong = {
          ...operation,
          data: '001122',
        }

        action = pam.contract.actions
          .isauthorized([wrong, metadata])
          .send(active(user))

        await expectToThrow(action, errors.INVALID_USER_DATA)
      })
      it('Should validate the operation successfully', async () => {
        await pam.contract.actions
          .isauthorized([operation, metadata])
          .send(active(user))

        const expectedEventId =
          '861a9d4acfb2eb75c8093e39ec0af1be4d20a789003c6ec9d2508b2ff1247843'

        expect(pam.contract.bc.console).to.be.equal(expectedEventId)
      })
    })

    it('Should authorize an EOSIO operation successfully', async () => {
      let eosOperation = getOperation({
        local: true,
        nonce: 0,
        blockId:
          '179ed57f474f446f2c9f6ea6702724cdad0cf26422299b368755ed93c0134a35',
        txId: '27598a45ee610287d85695f823f8992c10602ce5bf3240ee20635219de4f734f',
        token: '4,TKN',
        originChainId: Chains(Protocols.Eos).Jungle,
        destinationChainId: Chains(Protocols.Eos).Mainnet,
        amount: 9.9825,
        sender: 'user',
        recipient: 'recipient',
        data: '',
      })

      const eventData = {
        event_bytes: no0x(serializeOperation(eosOperation)),
      }

      eosOperation = no0x(eosOperation)

      const eosEmitter = Buffer.from('adapter')
        .toString('hex')
        .padStart(64, '0')

      const eosTopic0 = Buffer.from('swap').toString('hex').padStart(64, '0')

      const eosEA = new ProofcastEventAttestator({
        version: Versions.V1,
        protocolId: Protocols.Eos,
        chainId: Chains(Protocols.Eos).Jungle,
        privateKey,
      })

      const eosEvent = {
        blockHash: eosOperation.blockId,
        transactionHash: eosOperation.txId,
        account: 'adapter',
        action: 'swap',
        data: eventData,
      }

      await adapter.contract.actions
        .setorigin([eosOperation.originChainId, eosEmitter, eosTopic0])
        .send(active(adapter.account))

      const eosMetadata = no0x(
        getMetadataSample({
          signature: no0x(eosEA.formatEosSignature(eosEA.sign(eosEvent))),
          preimage: no0x(eosEA.getEventPreImage(eosEvent)),
        }),
      )

      await pam.contract.actions
        .isauthorized([eosOperation, eosMetadata])
        .send(active(user))

      const expectedEventId =
        '190635fc5b0d1b2704567e7a1d379dcf9604119fded50de105a1e77f381d3a0e'
      expect(pam.contract.bc.console).to.be.equal(expectedEventId)
    })
  })
})
