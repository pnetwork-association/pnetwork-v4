import { Protocols } from './Protocols.js'

export const Chains = (_prococolId): any => {
  switch (_prococolId) {
    case Protocols.Evm:
      return {
        Gnosis: '0x64',
        Goerli: '0x05',
        Hardhat: '0x7a69',
        Mainnet: '0x01',
        Bsc: '0x38',
      }
    case Protocols.Eos:
      return {
        Mainnet:
          '0xaca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906',
        Jungle:
          '0x73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d',
      }
  }
}
