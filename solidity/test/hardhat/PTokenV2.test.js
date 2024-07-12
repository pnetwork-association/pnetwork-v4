import helpers, { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { expect } from 'chai'
import { ZeroAddress } from 'ethers/constants'
import hre from 'hardhat'

import ERC1820BYTES from './bytecodes/ERC1820.cjs'
import { deployProxy } from './utils/deploy-proxy.cjs'
import { deploy } from './utils/deploy.cjs'
import { getUpgradeOpts } from './utils/get-upgrade-opts.cjs'
import { upgradeProxy } from './utils/upgrade-proxy.cjs'
import { validateUpgrade } from './utils/validate-upgrade.cjs'

const ERC1820 = '0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24'
const deployERC1820 = () => helpers.setCode(ERC1820, ERC1820BYTES)

;['', 'NoGSN'].map(_useGSN => {
  describe(`PTokenV2${_useGSN}`, () => {
    describe('Storage Layout invariance checks', () => {
      const name = 'pToken A'
      const symbol = 'pTKN A'
      const originChainId = '0x10000000'

      it('Should not detect any storage violation', async () => {
        // Set the registry
        await deployERC1820()

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
        await deployERC1820()

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

    describe('Tests units', () => {
      const setup = async () => {
        const [owner, minter, recipient, user, evil, bridge] =
          await hre.ethers.getSigners()
        const name = 'pToken A'
        const symbol = 'pTKN A'
        const originChainId = '0x10000000'

        await deployERC1820()

        const pToken = await deployProxy(hre, `PToken${_useGSN}`, [
          name,
          symbol,
          owner.address,
          originChainId,
        ])

        return { owner, minter, recipient, user, evil, bridge, pToken }
      }

      it('Should mint some pTokens', async () => {
        const { owner, minter, recipient, pToken } = await loadFixture(setup)

        const value = 100
        await expect(pToken.connect(owner).grantMinterRole(minter)).to.emit(
          pToken,
          'RoleGranted',
        )
        await expect(pToken.connect(minter).mint(recipient, value))
          .to.emit(pToken, 'Transfer')
          .withArgs(ZeroAddress, recipient.address, value)

        expect(await pToken.balanceOf(recipient)).to.be.equal(value)
      })

      it('Should upgrade the ptoken correctly', async () => {
        const { owner, minter, recipient, pToken } = await loadFixture(setup)
        const value = 100
        await pToken.connect(owner).grantMinterRole(minter)
        await pToken.connect(minter).mint(recipient, value)

        const opts = getUpgradeOpts(owner, _useGSN)

        const pTokenV2 = await upgradeProxy(
          hre,
          pToken,
          `PTokenV2${_useGSN}`,
          opts,
        )

        expect(await pTokenV2.balanceOf(recipient)).to.be.equal(100)
      })

      describe('Cumulative tests after pToken contract upgrade', () => {
        let owner,
          admin,
          minter,
          recipient,
          user,
          evil,
          PAM,
          bridge,
          lockbox,
          pToken,
          pTokenV2,
          feesManagerTest

        before(async () => {
          const env = await loadFixture(setup)
          owner = env.owner
          admin = env.admin
          minter = env.minter
          recipient = env.recipient
          user = env.user
          evil = env.evil
          bridge = env.bridge
          pToken = env.pToken

          const opts = getUpgradeOpts(owner, _useGSN)

          pTokenV2 = await upgradeProxy(hre, pToken, `PTokenV2${_useGSN}`, opts)

          expect(await pTokenV2.owner()).to.be.equal(owner.address)
        })

        it('Only the owner can set the fee manager the first time', async () => {
          feesManagerTest = await deploy(hre, 'FeesManagerTest')

          await expect(
            pTokenV2.connect(evil).setFeesManager(feesManagerTest),
          ).to.be.revertedWith('OnlyOwner')

          await expect(pTokenV2.connect(owner).setFeesManager(feesManagerTest))
            .to.emit(pTokenV2, 'FeesManagerChanged')
            .withArgs(feesManagerTest)
        })

        it('Only the fees manager can set the fee manager after the first time', async () => {
          await expect(
            pTokenV2.connect(owner).setFeesManager(feesManagerTest),
          ).to.be.revertedWith('OnlyFeesManager')

          await expect(
            feesManagerTest.setFeesManagerForXERC20(pTokenV2, feesManagerTest),
          )
            .to.emit(pTokenV2, 'FeesManagerChanged')
            .withArgs(feesManagerTest)
        })

        it('Only the owner can set limits', async () => {
          const mintingLimit = 200
          const burningLimit = 300

          await expect(
            pTokenV2
              .connect(evil)
              .setLimits(bridge, mintingLimit, burningLimit),
          ).to.be.revertedWith('Ownable: caller is not the owner')

          await expect(
            pTokenV2
              .connect(owner)
              .setLimits(bridge, mintingLimit, burningLimit),
          )
            .to.emit(pTokenV2, 'BridgeLimitsSet')
            .withArgs(mintingLimit, burningLimit, bridge.address)

          expect(await pTokenV2.mintingMaxLimitOf(bridge.address)).to.be.eq(
            mintingLimit,
          )
          expect(await pTokenV2.burningMaxLimitOf(bridge.address)).to.be.eq(
            burningLimit,
          )
        })

        it('Only the allowed bridge can mint and burn', async () => {
          const value = 100
          await expect(
            pTokenV2.connect(evil).mint(recipient, value),
          ).to.be.revertedWith('IXERC20_NotHighEnoughLimits')

          // Sent to evil in order to make the next assertion
          await expect(pTokenV2.connect(bridge).mint(evil, value))
            .to.emit(pTokenV2, 'Transfer')
            .withArgs(ZeroAddress, evil.address, value)

          await expect(
            pTokenV2.connect(evil)['burn(address,uint256)'](evil, value),
          ).to.be.revertedWith('IXERC20_NotHighEnoughLimits')

          await pTokenV2.connect(evil).approve(bridge, value)
          await expect(
            pTokenV2.connect(bridge)['burn(address,uint256)'](evil, value),
          )
            .to.emit(pTokenV2, 'Transfer')
            .withArgs(evil, ZeroAddress, value)
        })

        it('Only the owner can set the PAM address', async () => {
          PAM = await deploy(hre, 'PAM')

          await expect(
            pTokenV2.connect(evil).setPAM(bridge, PAM),
          ).to.be.revertedWith('Ownable: caller is not the owner')

          await expect(pTokenV2.connect(owner).setPAM(bridge, PAM))
            .to.emit(pTokenV2, 'PAMChanged')
            .withArgs(PAM)
        })

        it('Should return false when the lockbox is not set', async () => {
          expect(await pTokenV2.isLocal()).to.be.equal(false)
        })

        it('Only owner can set the lockbox', async () => {
          const isNative = false
          const erc20 = ZeroAddress
          const xerc20 = pTokenV2
          lockbox = await deploy(hre, 'XERC20Lockbox', [
            xerc20,
            erc20,
            isNative,
          ])

          await expect(
            pTokenV2.connect(evil).setLockbox(lockbox),
          ).to.be.revertedWith('Ownable: caller is not the owner')

          await expect(pTokenV2.connect(owner).setLockbox(lockbox))
            .to.emit(pTokenV2, 'LockboxSet')
            .withArgs(lockbox)
        })

        it('Should return true when the lockbox is set', async () => {
          expect(await pTokenV2.isLocal()).to.be.equal(true)
        })

        it('Should read storage correctly', async () => {
          expect(await pTokenV2.getLockbox()).to.be.equal(lockbox)
          expect(await pTokenV2.getPAM(bridge.address)).to.be.equal(PAM)
          expect(await pTokenV2.getFeesManager()).to.be.equal(feesManagerTest)
        })
      })
    })
  })
})
