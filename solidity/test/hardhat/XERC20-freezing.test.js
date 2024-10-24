import helpers, { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { expect } from 'chai'
import hre from 'hardhat'

import ERC1820BYTES from './bytecodes/ERC1820.cjs'
import { deployProxy } from './utils/deploy-proxy.cjs'
import { getUpgradeOpts } from './utils/get-upgrade-opts.cjs'
import { upgradeProxy } from './utils/upgrade-proxy.cjs'

const ERC1820 = '0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24'
const deployERC1820 = () => helpers.setCode(ERC1820, ERC1820BYTES)

;['', 'NoGSN'].map(_useGSN => {
  describe(`XERC20 ${_useGSN} - Freezing Tests`, () => {
    const setup = async () => {
      const [
        owner,
        admin,
        minter,
        recipient,
        user,
        evil,
        bridge,
        freezingAddress,
      ] = await hre.ethers.getSigners()
      const name = 'pToken A'
      const symbol = 'pTKN A'
      const originChainId = '0x10000000'

      await deployERC1820()

      const pToken = await deployProxy(hre, `PToken${_useGSN}`, admin, [
        name,
        symbol,
        owner.address,
        originChainId,
      ])

      const freezingEnabled = true
      const opts = getUpgradeOpts(owner, freezingEnabled)
      const pTokenV2 = await upgradeProxy(
        hre,
        pToken,
        `XERC20PToken${_useGSN}Compat`,
        opts,
        admin,
      )

      const mintingLimit = 10000
      const burningLimit = 10000
      await pTokenV2.connect(owner).setLimits(owner, mintingLimit, burningLimit)

      return {
        owner,
        admin,
        minter,
        recipient,
        user,
        evil,
        bridge,
        pTokenV2,
        freezingAddress,
      }
    }

    describe('Cumulative tests', () => {
      let owner, recipient, user, evil, pTokenV2, freezingAddress
      const amount = 10
      before(async () => {
        const obj = await loadFixture(setup)
        owner = obj.owner
        recipient = obj.recipient
        user = obj.user
        evil = obj.evil
        pTokenV2 = obj.pTokenV2
        freezingAddress = obj.freezingAddress
      })

      it('Freeze flag should be enabled', async () => {
        expect(await pTokenV2.freezingEnabled()).to.be.true
      })

      it('Should transfer tokens successfully when not Frozen', async () => {
        await pTokenV2.connect(owner).mint(evil, amount)
        await pTokenV2.connect(evil).transfer(recipient, amount)

        expect(await pTokenV2.balanceOf(evil)).to.be.equal(0)
        expect(await pTokenV2.balanceOf(recipient)).to.be.equal(amount)
      })

      it('Only the owner can set the freezing address', async () => {
        await expect(
          pTokenV2.connect(evil).setFreezingAddress(freezingAddress),
        ).to.be.revertedWith('Ownable: caller is not the owner')
      })

      it('Should set the freezing address successfully', async () => {
        await expect(
          pTokenV2.connect(owner).setFreezingAddress(freezingAddress),
        ).to.not.be.reverted
        expect(await pTokenV2.freezingAddress()).to.be.equal(freezingAddress)
      })

      it('Only freezing address can freeze, unfreeze and withdraw', async () => {
        await expect(
          pTokenV2.connect(owner).freezeAddress(evil),
        ).to.be.revertedWith('Only freezing address allowed')

        await expect(
          pTokenV2.connect(owner).unfreezeAddress(evil),
        ).to.be.revertedWith('Only freezing address allowed')

        await expect(
          pTokenV2.connect(owner).withdrawFrozenAssets(evil, owner, amount),
        ).to.be.revertedWith('Only freezing address allowed')
      })

      it('Should freeze an address successfully', async () => {
        await pTokenV2.connect(owner).mint(evil, amount) // stolen amount
        await expect(pTokenV2.connect(freezingAddress).freezeAddress(evil)).to
          .not.be.reverted

        expect(await pTokenV2.frozen(evil)).to.be.true
      })

      it('Frozen address cannot transfer', async () => {
        await expect(
          pTokenV2.connect(evil).transfer(recipient, amount),
        ).to.be.revertedWith('owner is frozen')
      })

      it('Frozen address cannot transfer through approval', async () => {
        await pTokenV2.connect(evil).approve(recipient, amount)

        await expect(
          pTokenV2.connect(recipient).transferFrom(evil, recipient, amount),
        ).to.be.revertedWith('owner is frozen')
      })

      it('Frozen address cannot receive assets', async () => {
        await pTokenV2.connect(owner).mint(recipient, amount)

        await expect(
          pTokenV2.connect(recipient).transfer(evil, amount),
        ).to.be.revertedWith('recipient is frozen')
      })

      it('Should withdraw from the frozen address succesfully', async () => {
        await expect(
          pTokenV2
            .connect(freezingAddress)
            .withdrawFrozenAssets(evil, freezingAddress, amount),
        ).to.not.be.reverted

        expect(await pTokenV2.balanceOf(evil)).to.be.equal(0)
        expect(await pTokenV2.balanceOf(freezingAddress)).to.be.equal(amount)
      })

      it('Should unfreeze an address successfully', async () => {
        await expect(pTokenV2.connect(freezingAddress).unfreezeAddress(evil)).to
          .not.be.reverted

        expect(await pTokenV2.frozen(evil)).to.be.false
      })

      it('Unfrozen address can transfer again', async () => {
        await pTokenV2.connect(owner).mint(evil, amount)

        const balancePre = await pTokenV2.balanceOf(recipient)

        await expect(pTokenV2.connect(evil).transfer(recipient, amount)).to.not
          .be.reverted

        expect(await pTokenV2.balanceOf(evil)).to.be.equal(0)
        expect(await pTokenV2.balanceOf(recipient)).to.be.equal(
          balancePre + BigInt(amount),
        )
      })
    })
  })
})
