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
  describe(`Testing upgrade from 'PToken${_useGSN}'`, () => {
    describe('Storage Layout invariance checks', () => {
      const name = 'pToken A'
      const symbol = 'pTKN A'
      const originChainId = '0x10000000'

      it('Should not detect any storage violation', async () => {
        // Set the registry
        await deployERC1820()

        const [_, admin] = await hre.ethers.getSigners()
        const pToken = await deployProxy(hre, `PToken${_useGSN}`, admin, [
          name,
          symbol,
          admin.address,
          originChainId,
        ])

        expect(
          await validateUpgrade(
            hre,
            `XERC20PToken${_useGSN}Compat`,
            pToken.target,
          ),
        )
      })
    })

    describe('Tests units', () => {
      const setup = async () => {
        const [owner, admin, minter, recipient, user, evil, bridge] =
          await hre.ethers.getSigners()
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

        return { owner, admin, minter, recipient, user, evil, bridge, pToken }
      }

      it('Should mint some pTokens before upgrade', async () => {
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
        const { owner, admin, minter, recipient, pToken } =
          await loadFixture(setup)
        const value = 100
        await pToken.connect(owner).grantMinterRole(minter)
        await pToken.connect(minter).mint(recipient, value)

        expect(await pToken.balanceOf(recipient)).to.be.equal(value)

        const opts = getUpgradeOpts(owner)
        const pTokenV2 = await upgradeProxy(
          hre,
          pToken,
          `XERC20PToken${_useGSN}Compat`,
          opts,
          admin,
        )

        expect(await pTokenV2.balanceOf(recipient)).to.be.equal(value)
      })

      describe('Cumulative tests after pToken contract upgrade', () => {
        let owner, admin, user, evil, bridge, lockbox, pToken, pTokenV2

        const oneDay = 60n * 60n * 24n
        const mintingRatePerSecond = 3n
        const burningRatePerSecond = 2n
        const mintingLimit = mintingRatePerSecond * oneDay
        const burningLimit = burningRatePerSecond * oneDay

        before(async () => {
          const env = await loadFixture(setup)
          owner = env.owner
          admin = env.admin
          user = env.user
          evil = env.evil
          bridge = env.bridge
          pToken = env.pToken

          const opts = getUpgradeOpts(owner)
          pTokenV2 = await upgradeProxy(
            hre,
            pToken,
            `XERC20PToken${_useGSN}Compat`,
            opts,
            admin,
          )

          expect(await pTokenV2.owner()).to.be.equal(owner.address)
        })

        it('Should revert when trying to call initializeV2', async () => {
          const initError = 'Initializable: contract is already initialized'
          await expect(
            pTokenV2.connect(admin).initializeV2(evil),
          ).to.be.revertedWith(initError)

          await expect(
            pTokenV2.connect(owner).initializeV2(evil),
          ).to.be.revertedWith(initError)

          await expect(
            pTokenV2.connect(evil).initializeV2(evil),
          ).to.be.revertedWith(initError)
        })

        it('Only the admin can upgrade the contract', async () => {
          const snapshot = await helpers.takeSnapshot()
          const opts = {}
          await expect(
            upgradeProxy(
              hre,
              pTokenV2,
              `XERC20PToken${_useGSN}Compat`,
              opts,
              owner,
            ),
          ).to.be.reverted

          await expect(
            upgradeProxy(
              hre,
              pTokenV2,
              `XERC20PToken${_useGSN}Compat`,
              opts,
              evil,
            ),
          ).to.be.reverted

          await expect(
            upgradeProxy(
              hre,
              pTokenV2,
              `XERC20PToken${_useGSN}Compat`,
              opts,
              admin,
            ),
          ).to.not.be.reverted
          await snapshot.restore()
        })

        it('Only the owner can set limits', async () => {
          const tx = pTokenV2
            .connect(evil)
            .setLimits(bridge, mintingLimit, burningLimit)

          await expect(tx).to.be.revertedWith(
            'Ownable: caller is not the owner',
          )

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

        it('Bridge parameters should be set correctly', async () => {
          const bridgeParams = await pTokenV2.bridges(bridge)
          const bridgeMintingParams = bridgeParams[0]
          const bridgeBurningParams = bridgeParams[1]

          expect(bridgeMintingParams).to.include.members([
            mintingRatePerSecond,
            mintingLimit,
            mintingLimit,
          ])

          expect(bridgeBurningParams).to.include.members([
            burningRatePerSecond,
            burningLimit,
            burningLimit,
          ])
        })

        it('Should get the correct bridge params after minting and burning', async () => {
          const amount = 100n
          await pTokenV2.connect(bridge).mint(user, amount)
          await pTokenV2.connect(user).approve(bridge, amount)
          await pTokenV2.connect(bridge).burn(user, amount)

          const bridgeParams = await pTokenV2.bridges(bridge)

          expect(bridgeParams[0]).to.include.members([
            mintingRatePerSecond,
            mintingLimit,
            mintingLimit - amount,
          ])
          expect(bridgeParams[1]).to.include.members([
            burningRatePerSecond,
            burningLimit,
            burningLimit - amount,
          ])
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

          const tx = pTokenV2.connect(evil).setLockbox(lockbox)
          await expect(tx).to.be.revertedWith(
            'Ownable: caller is not the owner',
          )

          await expect(pTokenV2.connect(owner).setLockbox(lockbox))
            .to.emit(pTokenV2, 'LockboxSet')
            .withArgs(lockbox)
        })

        it('Should revert when going over the max minting/burning limits', async () => {
          const seconds = 100n
          const bridgeParams = await pTokenV2.bridges(bridge)
          const [lastMintBlockTs, , , currentMintingLimit] = bridgeParams[0]

          await helpers.time.increaseTo(lastMintBlockTs + seconds)

          const remainingMintAmount =
            currentMintingLimit + seconds * mintingRatePerSecond + 1n

          await expect(
            pTokenV2.connect(bridge).mint(user, remainingMintAmount),
          ).to.be.revertedWithCustomError(
            pTokenV2,
            'IXERC20_NotHighEnoughLimits',
          )

          // Transfer the whole amount in order to burn
          await pTokenV2.connect(bridge).mint(user, mintingLimit)

          const [, , , currentBurningLimit] = bridgeParams[1]

          const remainingBurnLimit =
            currentBurningLimit + seconds * burningRatePerSecond + 1n

          await pTokenV2.connect(user).approve(bridge, remainingBurnLimit)

          await expect(
            pTokenV2
              .connect(bridge)
              ['burn(address,uint256)'](user, remainingBurnLimit),
          ).to.be.revertedWithCustomError(
            pTokenV2,
            'IXERC20_NotHighEnoughLimits',
          )
        })

        it('Should lower the limit successfully', async () => {
          const snapshot = await helpers.takeSnapshot()
          const bridge2 = (await hre.ethers.getSigners())[10]
          await pTokenV2
            .connect(owner)
            .setLimits(bridge2, mintingLimit, burningLimit)

          const amount = 100n

          // Mint and burn some tokens
          await pTokenV2.connect(bridge2).mint(user, amount)
          await pTokenV2.connect(user).approve(bridge2, amount)

          await pTokenV2.connect(bridge2)['burn(address,uint256)'](user, amount)

          let bridgeParams = await pTokenV2.bridges(bridge2)

          expect(bridgeParams[0]).to.include.members([
            mintingRatePerSecond,
            mintingLimit,
            mintingLimit - amount,
          ])

          expect(bridgeParams[1]).to.include.members([
            burningRatePerSecond,
            burningLimit,
            burningLimit - amount,
          ])

          const newMintingLimit = mintingLimit - amount
          const newMintingRate = newMintingLimit / oneDay
          const newBurningLimit = burningLimit - amount
          const newBurningRate = newBurningLimit / oneDay

          await expect(
            pTokenV2
              .connect(owner)
              .setLimits(bridge2, newMintingLimit, newBurningLimit),
          )
            .to.emit(pTokenV2, 'BridgeLimitsSet')
            .withArgs(newMintingLimit, newBurningLimit, bridge2)

          bridgeParams = await pTokenV2.bridges(bridge2)

          expect(bridgeParams[0]).to.include.members([
            newMintingRate,
            newMintingLimit,
            newMintingLimit,
          ])

          expect(bridgeParams[1]).to.include.members([
            newBurningRate,
            newBurningLimit,
            newBurningLimit,
          ])

          await snapshot.restore()
        })

        it('Should raise the limit successfully', async () => {
          const snapshot = await helpers.takeSnapshot()
          const bridge2 = (await hre.ethers.getSigners())[10]
          await pTokenV2
            .connect(owner)
            .setLimits(bridge2, mintingLimit, burningLimit)

          const amount = 100n

          // Mint and burn some tokens
          await pTokenV2.connect(bridge2).mint(user, amount)
          await pTokenV2.connect(user).approve(bridge2, amount)
          await pTokenV2.connect(bridge2)['burn(address,uint256)'](user, amount)

          let bridgeParams = await pTokenV2.bridges(bridge2)

          expect(bridgeParams[0]).to.include.members([
            mintingRatePerSecond,
            mintingLimit,
            mintingLimit - amount,
          ])

          expect(bridgeParams[1]).to.include.members([
            burningRatePerSecond,
            burningLimit,
            burningLimit - amount,
          ])

          const newMintingLimit = mintingLimit + amount
          const newMintingRate = newMintingLimit / oneDay
          const newBurningLimit = burningLimit + amount
          const newBurningRate = newBurningLimit / oneDay

          await expect(
            pTokenV2
              .connect(owner)
              .setLimits(bridge2, newMintingLimit, newBurningLimit),
          )
            .to.emit(pTokenV2, 'BridgeLimitsSet')
            .withArgs(newMintingLimit, newBurningLimit, bridge2)

          bridgeParams = await pTokenV2.bridges(bridge2)

          expect(bridgeParams[0]).to.include.members([
            newMintingRate,
            newMintingLimit,
            newMintingLimit,
          ])

          expect(bridgeParams[1]).to.include.members([
            newBurningRate,
            newBurningLimit,
            newBurningLimit,
          ])

          await snapshot.restore()
        })
      })
    })
  })
})
