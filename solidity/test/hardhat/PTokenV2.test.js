import { expect } from 'chai'
import hre from 'hardhat'

import { deployPTokenContract } from './utils/deploy-ptoken-contract.cjs'
import { validateUpgrade } from './utils/validate-upgrade.cjs'

describe('PTokenV2', () => {
  describe('Storage Layout invariance checks', () => {
    it('Should not detect any storage violation', async () => {
      const name = 'pToken A'
      const symbol = 'pTKN A'
      const originChainId = '0x00000000'
      const [admin] = await hre.ethers.getSigners()
      const pToken = await deployPTokenContract(hre, [
        name,
        symbol,
        originChainId,
        admin.address,
      ])
      expect(await validateUpgrade(hre, 'PTokenV2', pToken.address))
    })
  })
})
