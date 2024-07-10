import helpers, { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { expect } from 'chai'
import { zeroPadValue } from 'ethers'
import { ZeroAddress } from 'ethers/constants'
import hre from 'hardhat'

import ERC1820BYTES from './bytecodes/ERC1820.cjs'
import { deployProxy } from './utils/deploy-proxy.cjs'
import { deploy } from './utils/deploy.cjs'
import { getUpgradeOpts } from './utils/get-upgrade-opts.cjs'
import { upgradeProxy } from './utils/upgrade-proxy.cjs'

const ERC1820 = '0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24'
const deployERC1820 = () => helpers.setCode(ERC1820, ERC1820BYTES)

;['', 'NoGSN'].map(_useGSN => {
  ;['', 'Native'].map(_isNative => {
    describe.only(`Adapter swap${_isNative} Tests Units ${_useGSN}`, () => {
      const setup = async () => {
        const [owner, minter, recipient, user, evil] =
          await hre.ethers.getSigners()
        const name = 'Token A'
        const symbol = 'TKN A'
        const supply = 100000000
        const originChainId = '0x10000000'
        const mintingLimit = 10000
        const burningLimit = 20000
        const basisPoints = 2000
        const minFee = 0

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
        const feesManager = await deploy(hre, 'FeesManager', [])
        const registry = await deploy(hre, 'XERC20Registry', [])
        const erc20 = isNative
          ? { target: ZeroAddress }
          : await deploy(hre, 'ERC20Test', [name, symbol, supply])

        const adapter = await deploy(hre, 'Adapter', [registry.target])
        const lockbox = await deploy(hre, 'XERC20Lockbox', [
          pTokenV2.target,
          erc20.target,
          isNative,
        ])

        const erc20Bytes = zeroPadValue(erc20.target, 32)

        await feesManager.setFee(pTokenV2, minFee, basisPoints)
        await registry.grantRole(await registry.REGISTRAR_ROLE(), owner)
        await registry.registerXERC20(erc20Bytes, pTokenV2)
        await pTokenV2.setFeesManager(feesManager)
        await pTokenV2.setLockbox(lockbox)
        await pTokenV2.setLimits(adapter, mintingLimit, burningLimit)

        if (!_isNative) await erc20.connect(owner).transfer(user, 10000)

        return {
          owner,
          minter,
          recipient,
          user,
          evil,
          adapter,
          erc20,
          erc20Bytes,
          pTokenV2,
          lockbox,
          feesManager,
        }
      }

      it('Should perform a swap successfully', async () => {
        let {
          user,
          recipient,
          adapter,
          erc20,
          erc20Bytes,
          pTokenV2,
          lockbox,
          feesManager,
        } = await loadFixture(setup)
        const amount = 4000
        const fees = amount * 0.002
        const destinationChainId = zeroPadValue('0x01', 32)
        const balancePre = _isNative
          ? await hre.ethers.provider.getBalance(user)
          : await erc20.balanceOf(user)
        const expectedNonce = 0
        const expectedData = '0x'

        adapter = await adapter.connect(user)

        let tx
        if (_isNative) {
          tx = adapter['swapNative(uint256,string)'](
            destinationChainId,
            recipient.address,
            {
              value: amount,
            },
          )
        } else {
          await erc20.connect(user).approve(adapter, amount)
          tx = adapter.swap(
            erc20,
            amount,
            destinationChainId,
            recipient.address,
          )
        }

        await expect(tx)
          .to.emit(adapter, 'Swap')
          .withArgs(expectedNonce, [
            expectedNonce,
            erc20Bytes,
            destinationChainId,
            amount - fees,
            user.address,
            recipient.address,
            expectedData,
          ])

        const balancePost = _isNative
          ? await hre.ethers.provider.getBalance(user)
          : await erc20.balanceOf(user)

        const lockboxBalance = _isNative
          ? await hre.ethers.provider.getBalance(lockbox)
          : await erc20.balanceOf(lockbox)
        const receipt = await (await tx).wait(0)
        const gas = _isNative ? receipt.gasUsed * receipt.gasPrice : 0n
        expect(balancePost).to.be.equal(balancePre - gas - BigInt(amount))
        expect(lockboxBalance).to.be.equal(amount)
        expect(await pTokenV2.balanceOf(feesManager)).to.be.equal(fees)
      })
    })
  })
})
