import helpers from '@nomicfoundation/hardhat-network-helpers'
import { expect } from 'chai'
import hre from 'hardhat'

import erc1820bytes from './bytecodes/ERC1820.cjs'
import { deployProxy } from './utils/deploy-proxy.cjs'
import { validateUpgrade } from './utils/validate-upgrade.cjs'

;['', 'NoGSN'].map(_useGSN => {
  describe(`PTokenV2${_useGSN}`, () => {
    describe('Storage Layout invariance checks', () => {
      const name = 'pToken A'
      const symbol = 'pTKN A'
      const originChainId = '0x10000000'

      it('Should not detect any storage violation', async () => {
        // Set the registry
        const erc1820 = '0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24'
        await helpers.setCode(erc1820, erc1820bytes)

        const [_, admin] = await hre.ethers.getSigners()
        const pToken = await deployProxy(hre, `PToken${_useGSN}`, [
          name,
          symbol,
          admin.address,
          originChainId,
        ])

        expect(await validateUpgrade(hre, `PTokenV2${_useGSN}`, pToken.target))
      })

      it('Should not be possible to upgrade from GSN to non-GSN and viceversa', async () => {
        // Set the registry
        const erc1820 = '0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24'
        await helpers.setCode(erc1820, erc1820bytes)

        const [_, admin] = await hre.ethers.getSigners()
        const pToken = await deployProxy(hre, `PToken${_useGSN}`, [
          name,
          symbol,
          admin.address,
          originChainId,
        ])

        _useGSN = _useGSN === '' ? 'NoGSN' : ''

        try {
          await validateUpgrade(hre, `PTokenV2${_useGSN}`, pToken.target),
            assert.fail('Should never reach here')
        } catch (e) {
          expect(e.message).to.include('New storage layout is incompatible')
        }
      })
    })
  })
})
