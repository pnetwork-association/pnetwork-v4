import { Event } from 'ethers'

import { Chains } from '../src/Chains'
import { ProofcastEventAttestator } from '../src/ProofcastEventAttestator'

describe('Proofcast Event Attestator Tests', () => {
  test('Should generate a statement and a signature correctly', async () => {
    0x2946259e0334f33a064106302415ad3391bed384

    const privateKey =
      'dfcc79a57e91c42d7eea05f82a08bd1b7e77f30236bb7c56fe98d3366a1929c4'
    const blockHash =
      '0x0fe2fb4c587b6cf9c7eff93a8d217ac8e037c4178dc9744eb31aa2dae39a1e41'
    const txHash =
      '0x0fe2fb4c587b6cf9c7eff93a8d217ac8e037c4178dc9744eb31aa2dae39a1e41'
    const address = '0x2946259E0334f33A064106302415aD3391BeD384'
    const topics = [
      '0x26d9f1fabb4e0554841202b52d725e2426dda2be4cafcb362eb73f9fb813d609',
      '0x0000000000000000000000000000000000000000000000000000000000000000',
    ]
    const data =
      '0x00000000000000000000000051a240271ab8ab9f9a21c82d9a85396b704e164d0000000000000000000000000000000000000000000000000000000000007a690000000000000000000000000000000000000000000000000000000000007a6a00000000000000000000000000000000000000000000000000000000000026fc0000000000000000000000002b5ad5c4795c026514f8317c7a215e218dccd6cf00000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000140000000000000000000000000000000000000000000000000000000000000002a307836383133456239333632333732454546363230306633623164624333663831393637316342413639000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000'

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    // const event = {
    //   blockHash,
    //   address,
    //   topics,
    //   data,
    // } as unknown as Event

    // // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const ea = new ProofcastEventAttestator({
      version: 0x00,
      protocolId: 0x01,
      chainId: Chains.Hardhat,
      privateKey,
      blockHash,
      txHash,
    })

    const x = ea.sign({
      address,
      topics,
      data,
    } as unknown as Event)

    console.log(x)
  })
})
