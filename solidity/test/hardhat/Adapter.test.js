import helpers, { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { expect } from 'chai'
import { ZeroAddress } from 'ethers/constants'
import hre from 'hardhat'

import ERC1820BYTES from './bytecodes/ERC1820.cjs'
import { deployProxy } from './utils/deploy-proxy.cjs'
import { deploy } from './utils/deploy.cjs'
import { getUpgradeOpts } from './utils/get-upgrade-opts.cjs'
import { upgradeProxy } from './utils/upgrade-proxy.cjs'

const ERC1820 = '0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24'
const deployERC1820 = () => helpers.setCode(ERC1820, ERC1820BYTES)

;[''].map(_useGSN => {
  ;[''].map(_isNative => {
    describe.only(`Adapter swap${_isNative} Tests Units - ${_useGSN}`, () => {
      const setup = async () => {
        const [owner, minter, recipient, user, evil, bridge] =
          await hre.ethers.getSigners()
        const name = 'Token A'
        const symbol = 'TKN A'
        const supply = 1000000
        const originChainId = '0x10000000'

        await deployERC1820()

        const pToken = await deployProxy(hre, `PToken${_useGSN}`, [
          `p${name}`,
          `p${symbol}`,
          owner.address,
          originChainId,
        ])

        const opts = getUpgradeOpts(owner, _useGSN)
        const pTokenV2 = await upgradeProxy(
          hre,
          pToken,
          `PTokenV2${_useGSN}`,
          opts,
        )

        const isNative = _isNative == 'Native'
        const registry = await deploy(hre, 'XERC20Registry', [])
        const erc20 = isNative
          ? ZeroAddress
          : await deploy(hre, 'ERC20Test', [name, symbol, supply])

        const adapter = await deploy(hre, 'Adapter', [registry.target])
        const lockbox = await deploy(hre, 'XERC20Lockbox', [
          erc20.target,
          pTokenV2.target,
          isNative,
        ])

        return {
          owner,
          minter,
          recipient,
          user,
          evil,
          adapter,
          erc20,
          pTokenV2,
        }
      }

      it('Should perform a swap successfully', async () => {
        let { user, recipient, adapter, erc20, pTokenV2 } =
          await loadFixture(setup)
        const amount = 100
        const destinationChainId = hre.ethers.zeroPadBytes('0x01', 32)

        adapter = await adapter.connect(user)
        if (_isNative) {
          await expect(
            adapter.swapNative(destinationChainId, recipient, {
              value: amount,
            }),
          ).to.emit(adapter, 'Swap')
        } else {
          await expect(
            adapter.swap(erc20, amount, destinationChainId, recipient.address),
          ).to.emit(adapter, 'Swap')
        }
      })
    })
  })
})
