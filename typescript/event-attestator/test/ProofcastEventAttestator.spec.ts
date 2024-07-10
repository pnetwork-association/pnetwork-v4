import { Event } from 'ethers'

import { Chains } from '../src/Chains'
import { ProofcastEventAttestator } from '../src/ProofcastEventAttestator'

describe('Proofcast Event Attestator Tests', () => {
  test('Should generate a statement and a signature correctly', async () => {
    const privateKey =
      'dfcc79a57e91c42d7eea05f82a08bd1b7e77f30236bb7c56fe98d3366a1929c4'
    const blockHash =
      '0xa880cb2ab67ec9140db0f6de238b34d4108f6fab99315772ee987ef9002e0e63'
    const transactionHash =
      '0x11365bbee18058f12c27236e891a66999c4325879865303f785854e9169c257a'
    const address = '0x2946259E0334f33A064106302415aD3391BeD384'
    const topics = [
      '0x289ca1b08b8acb2ac02d0c5e8610fd8c0222f15b3089f0b7e7f7f284a23325aa',
      '0x0000000000000000000000000000000000000000000000000000000000000000',
    ]
    const data =
      '0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000000000000000000000000000051a240271ab8ab9f9a21c82d9a85396b704e164d0000000000000000000000000000000000000000000000000000000000007a6a00000000000000000000000000000000000000000000000000000000000026fc2b5ad5c4795c026514f8317c7a215e218dccd6cf00000000000000000000000000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000140000000000000000000000000000000000000000000000000000000000000002a307836383133456239333632333732454546363230306633623164624333663831393637316342413639000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000'

    const ea = new ProofcastEventAttestator({
      version: 0x01,
      protocolId: 0x01,
      chainId: Chains.Hardhat,
      privateKey,
    })

    const event = {
      address,
      topics,
      data,
      blockHash,
      transactionHash,
    } as unknown as Event

    const expectedSignature =
      '0x8758e833b0e3db8189644a7b1e660e07b9429a36f5929e7192697d21e8ea762c3e3ed6545f2c2bd1a62131e4a0a32e344f23a8a9d52b422a9a2b6c27803f17f51b'

    expect(ea.sign(event)).toStrictEqual(expectedSignature)
  })
})
