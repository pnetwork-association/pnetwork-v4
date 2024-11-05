const { Protocols } = require('../src/Protocols')
const { Versions } = require('../src/Versions')
const { Chains } = require('../src/Chains')
const { ProofcastEventAttestator } = require('../src/ProofcastEventAttestator')

describe('Proofcast Event Attestator Tests', () => {
  const privateKey =
    'dfcc79a57e91c42d7eea05f82a08bd1b7e77f30236bb7c56fe98d3366a1929c4'

  test('Should sign an EVM event successfully', async () => {
    const blockHash =
      '0x658d5ae6a577714c7507e7b5911d26429280d6a0922a2be3f4502d577985527a'
    const transactionHash =
      '0x9b3b567ec90fc3a263f1784f57f942ac52ab4e609c23ba794de944fc1b512d34'
    const address = '0x87415715056da7a5eb1a30e53c4f4d20b44db71d'
    const topics = [
      '0x9b706941b48091a1c675b439064f40b9d43c577d9c7134cce93179b9b0bf2a52',
      '0x0000000000000000000000000000000000000000000000000000000000000000',
    ]
    const data =
      '0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000ea000000000000000000000000000000000000000000000000000000000000000000000000000000000000000051a240271ab8ab9f9a21c82d9a85396b704e164d0000000000000000000000000000000000000000000000000000000000007a6a00000000000000000000000000000000000000000000000000000000000026fc0000000000000000000000002b5ad5c4795c026514f8317c7a215e218dccd6cf000000000000000000000000000000000000000000000000000000000000002a30783638313345623933363233373245454636323030663362316462433366383139363731634241363900000000000000000000000000000000000000000000'

    const ea = new ProofcastEventAttestator({
      version: Versions.V1,
      protocolId: Protocols.Evm,
      chainId: Chains(Protocols.Evm).Mainnet,
      privateKey,
    })

    const event = {
      address,
      topics,
      data,
      blockHash,
      transactionHash,
    }

    const expectedSignature =
      '0x5b838b1283851a1fa35ba79ea39bb74b0bf7ec7d3c0bcb96d3879e28d291c8e348a74ff321b0e02fa3960fc1fec2ddc2e49738a77d0f9f1a596312b6bb03b8f01c'

    expect(ea.formatEvmSignature(ea.sign(event))).toStrictEqual(
      expectedSignature,
    )
  })

  it('Should sign en EOS event successfully', async () => {
    const blockHash =
      '179ed57f474f446f2c9f6ea6702724cdad0cf26422299b368755ed93c0134a35'
    const transactionHash =
      '27598a45ee610287d85695f823f8992c10602ce5bf3240ee20635219de4f734f'

    const account = 'adapter'
    const action = 'swap'

    // We are going to extract this = require( the a subfield of the)
    // official data
    const data = {
      event_bytes:
        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000746b6e2e746f6b656e00000000000000000000000000000000000000000000000000000000000000380000000000000000000000000000000000000000000000008a88f6dc465640000000000000000000000000000000000000000000000000000000000075736572000000000000000000000000000000000000000000000000000000000000002a307836386262656436613437313934656666316366353134623530656139313839353539376663393165',
    }

    const ea = new ProofcastEventAttestator({
      version: Versions.V1,
      protocolId: Protocols.Eos,
      chainId: Chains(Protocols.Eos).Mainnet,
      privateKey,
    })

    const event = {
      blockHash,
      transactionHash,
      account,
      action,
      data,
    }

    const expectedSignature =
      '0x1b546cb297b24aab5b445756f1d0beece3dad851d2cbd8d973f89f69e83f82b77016c87be815fa95bf25d37fb10c3f884cb200d38495e2d1c1bb686e9de38842a5'

    expect(ea.formatEosSignature(ea.sign(event))).toStrictEqual(
      expectedSignature,
    )
  })
})
