import helpers, { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import assert from 'assert'
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

;['XERC20', 'PTokenV2NoGSN', 'PTokenV2'].map(_tokenKind => {
  describe(`${_tokenKind}`, () => {
    const _useGSN = _tokenKind.includes('NoGSN') ? 'NoGSN' : ''

    if (_tokenKind.includes('PToken')) {
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

          expect(
            await validateUpgrade(hre, `PTokenV2${_useGSN}`, pToken.target),
          )
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

          const notUseGSN = _useGSN === '' ? 'NoGSN' : ''

          try {
            await validateUpgrade(hre, `PTokenV2${notUseGSN}`, pToken.target),
              assert.fail('Should never reach here')
          } catch (e) {
            expect(e.message).to.include('New storage layout is incompatible')
          }
        })
      })
    }

    describe.only('Tests units', () => {
      const setup = async () => {
        const [owner, minter, recipient, user, evil, bridge] =
          await hre.ethers.getSigners()
        const name = 'pToken A'
        const symbol = 'pTKN A'
        const originChainId = '0x10000000'

        await deployERC1820()

        const pToken =
          _tokenKind == 'XERC20'
            ? await deploy(hre, 'XERC20', [name, symbol, ZeroAddress])
            : await deployProxy(hre, `PToken${_useGSN}`, [
                name,
                symbol,
                owner.address,
                originChainId,
              ])

        return { owner, minter, recipient, user, evil, bridge, pToken }
      }

      if (_tokenKind.includes('PToken')) {
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
      }

      describe('Cumulative tests after pToken contract upgrade or when using XERC20', () => {
        let owner,
          admin,
          user,
          minter,
          recipient,
          evil,
          PAM,
          bridge,
          lockbox,
          pToken,
          pTokenV2,
          feesManagerTest

        const oneDay = 60n * 60n * 24n
        const mintingRatePerSecond = 3n
        const burningRatePerSecond = 2n
        const mintingLimit = mintingRatePerSecond * oneDay
        const burningLimit = burningRatePerSecond * oneDay

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

          pTokenV2 = _tokenKind.includes('PToken')
            ? await upgradeProxy(hre, pToken, `PTokenV2${_useGSN}`, opts)
            : pToken

          expect(await pTokenV2.owner()).to.be.equal(owner.address)
        })

        it('Anyone can set the fee manager the first time', async () => {
          feesManagerTest = await deploy(hre, 'FeesManagerTest')

          await expect(pTokenV2.connect(user).setFeesManager(feesManagerTest))
            .to.emit(pTokenV2, 'FeesManagerChanged')
            .withArgs(feesManagerTest)

          expect(await pTokenV2.getFeesManager()).to.be.equal(feesManagerTest)
        })

        it('Only the fees manager can set the fee manager after the first time', async () => {
          const oldFeesManager = feesManagerTest

          feesManagerTest = await deploy(hre, 'FeesManagerTest')

          const tx = pTokenV2.connect(owner).setFeesManager(feesManagerTest)

          if (_tokenKind === 'XERC20') {
            await expect(tx).to.be.revertedWithCustomError(
              pTokenV2,
              'OnlyFeesManager',
            )
          } else {
            await expect(tx).to.be.revertedWith('OnlyFeesManager')
          }

          await expect(
            oldFeesManager.setFeesManagerForXERC20(pTokenV2, feesManagerTest),
          )
            .to.emit(pTokenV2, 'FeesManagerChanged')
            .withArgs(feesManagerTest)

          expect(await pTokenV2.getFeesManager()).to.be.equal(feesManagerTest)
        })

        it('Only the owner can set limits', async () => {
          const tx = pTokenV2
            .connect(evil)
            .setLimits(bridge, mintingLimit, burningLimit)

          if (_tokenKind === 'XERC20') {
            await expect(tx).to.be.revertedWithCustomError(
              pTokenV2,
              'OwnableUnauthorizedAccount',
            )
          } else {
            await expect(tx).to.be.revertedWith(
              'Ownable: caller is not the owner',
            )
          }

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

          if (_tokenKind === 'XERC20') {
            await pTokenV2.connect(bridge).burn(user, amount)
          } else {
            await pTokenV2
              .connect(bridge)
              ['burn(address,uint256)'](user, amount)
          }

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

        it('Only the owner can set the PAM address', async () => {
          PAM = await deploy(hre, 'PAM')

          const tx = pTokenV2.connect(evil).setPAM(bridge, PAM)

          if (_tokenKind === 'XERC20') {
            await expect(tx).to.be.revertedWithCustomError(
              pTokenV2,
              'OwnableUnauthorizedAccount',
            )
          } else {
            await expect(tx).to.be.revertedWith(
              'Ownable: caller is not the owner',
            )
          }

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

          const tx = pTokenV2.connect(evil).setLockbox(lockbox)
          if (_tokenKind === 'XERC20') {
            await expect(tx).to.be.revertedWithCustomError(
              pTokenV2,
              'OwnableUnauthorizedAccount',
            )
          } else {
            await expect(tx).to.be.revertedWith(
              'Ownable: caller is not the owner',
            )
          }

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

        it('Should revert when going over the max minting/burning limits', async () => {
          const seconds = 100n
          const bridgeParams = await pTokenV2.bridges(bridge)
          const [lastMintBlockTs, , , currentMintingLimit] = bridgeParams[0]

          await helpers.time.increaseTo(lastMintBlockTs + seconds)

          const remainingMintAmount =
            currentMintingLimit + seconds * mintingRatePerSecond + 1n

          if (_tokenKind === 'XERC20') {
            await expect(
              pTokenV2.connect(bridge).mint(user, remainingMintAmount),
            ).to.be.revertedWithCustomError(
              pTokenV2,
              'IXERC20_NotHighEnoughLimits',
            )
          } else {
            await expect(
              pTokenV2.connect(bridge).mint(user, remainingMintAmount),
            ).to.be.revertedWith('IXERC20_NotHighEnoughLimits')
          }

          // Transfer the whole amount in order to burn
          await pTokenV2.connect(bridge).mint(user, mintingLimit)

          const [, , , currentBurningLimit] = bridgeParams[1]

          const remainingBurnLimit =
            currentBurningLimit + seconds * burningRatePerSecond + 1n

          await pTokenV2.connect(user).approve(bridge, remainingBurnLimit)

          if (_tokenKind === 'XERC20') {
            await expect(
              pTokenV2
                .connect(bridge)
                ['burn(address,uint256)'](user, remainingBurnLimit),
            ).to.be.revertedWithCustomError(
              pTokenV2,
              'IXERC20_NotHighEnoughLimits',
            )
          } else {
            await expect(
              pTokenV2
                .connect(bridge)
                ['burn(address,uint256)'](user, remainingBurnLimit),
            ).to.be.revertedWith('IXERC20_NotHighEnoughLimits')
          }
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

        it('Should revert with `No implemented`', async () => {
          await helpers.time.increase(oneDay)

          if (_tokenKind === 'PTokenV2') {
            const amount = 100n
            await pTokenV2.connect(bridge).mint(user, amount)
            await pTokenV2.connect(user).approve(bridge, amount)

            await expect(
              pTokenV2.connect(bridge)['burn(uint256,bytes)'](amount, '0x'),
            ).to.revertedWith('Not implemented')
          }
        })
      })
    })
  })
})
