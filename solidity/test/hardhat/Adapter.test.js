import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs.js'
import helpers, { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { Chains, ProofcastEventAttestator } from '@pnetwork/event-attestator'
import { expect } from 'chai'
import { ZeroAddress } from 'ethers/constants'
import hre from 'hardhat'

import ERC1820BYTES from './bytecodes/ERC1820.cjs'
import Operation from './utils/Operation.cjs'
import { deployProxy } from './utils/deploy-proxy.cjs'
import { deploy } from './utils/deploy.cjs'
import { getSwapEvent } from './utils/get-swap-event.cjs'
import { getUpgradeOpts } from './utils/get-upgrade-opts.cjs'
import { padLeft32 } from './utils/pad-left-32.cjs'
import { upgradeProxy } from './utils/upgrade-proxy.cjs'

const ERC1820 = '0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24'
const deployERC1820 = () => helpers.setCode(ERC1820, ERC1820BYTES)

;['', 'NoGSN'].map(_useGSN =>
  describe(`Adapter ${_useGSN} Test Units`, () => {
    ;['', 'Native'].map(_isNative => {
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

        const PAM = await deploy(hre, 'PAM', [])

        const erc20Bytes = padLeft32(erc20.target)

        const version = 0x00
        const protocolId = 0x01
        const chainId = Chains.Hardhat
        const eventAttestator = new ProofcastEventAttestator({
          version,
          protocolId,
          chainId,
        })
        const attestation = '0x'
        await PAM.setTeeSigner(eventAttestator.publicKey, attestation)
        await PAM.setEmitter(
          padLeft32(Chains.Hardhat),
          padLeft32(adapter.target),
        )
        await feesManager.setFee(pTokenV2, minFee, basisPoints)
        await registry.grantRole(await registry.REGISTRAR_ROLE(), owner)
        await registry.registerXERC20(erc20Bytes, pTokenV2)
        await pTokenV2.setFeesManager(feesManager)
        await pTokenV2.setLockbox(lockbox)
        await pTokenV2.setLimits(adapter, mintingLimit, burningLimit)
        await pTokenV2.setPAM(adapter, PAM)

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
          PAM,
          lockbox,
          feesManager,
          eventAttestator,
        }
      }

      describe(`swap${_isNative}`, () => {
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
          const destinationChainId = padLeft32('0x01')
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
            .withArgs(expectedNonce, anyValue)

          const balancePost = _isNative
            ? await hre.ethers.provider.getBalance(user)
            : await erc20.balanceOf(user)

          const lockboxBalance = _isNative
            ? await hre.ethers.provider.getBalance(lockbox)
            : await erc20.balanceOf(lockbox)

          const receipt = await (await tx).wait(0)
          // TODO: rm
          // console.log(
          //   'receipt',
          //   receipt.logs.filter(x =>
          //     x.topics.includes(
          //       '0xb7f44fc1e9a3dc73e2b3edcde2016158d1d9449c356f751c6d77d4a20f2abd9b',
          //     ),
          //   ),
          // )
          const gas = _isNative ? receipt.gasUsed * receipt.gasPrice : 0n
          expect(balancePost).to.be.equal(balancePre - gas - BigInt(amount))
          expect(lockboxBalance).to.be.equal(amount)
          expect(await pTokenV2.balanceOf(feesManager)).to.be.equal(fees)
        })
      })

      const generateSwapEvent = async (
        adapterTest,
        nonce,
        erc20,
        destination,
        amount,
        user,
        recipient,
        data,
      ) => {
        return getSwapEvent(
          await adapterTest.swap(
            nonce,
            erc20.target, // keep this: handle when erc20 is the ZeroAddress
            destination,
            amount,
            user,
            recipient,
            data,
          ),
        )
      }

      describe(`settle(${_isNative})`, () => {
        it('Should settle the operation correctly', async () => {
          const {
            owner,
            user,
            PAM,
            recipient,
            erc20,
            pTokenV2,
            adapter,
            lockbox,
            eventAttestator,
            feesManager,
          } = await loadFixture(setup)

          const nonce = 0
          const data = '0x'
          const amount = 4000

          const adapterTest = await deploy(hre, 'AdapterTest', [])
          const event = await generateSwapEvent(
            adapterTest,
            nonce,
            erc20,
            Chains.Hardhat,
            amount,
            user.address,
            recipient.address,
            data,
          )

          if (_isNative) {
            await hre.network.provider.send('hardhat_setBalance', [
              lockbox.target,
              hre.ethers.toBeHex(amount),
            ])
          } else {
            await erc20.connect(owner).transfer(lockbox, amount)
          }

          const metadata = [
            eventAttestator.getEventPreImage(event),
            eventAttestator.sign(event),
          ]

          const eventContent = event.args[1][0]
          const operation = new Operation({
            blockId: event.blockHash,
            txId: event.transactionHash,
            originChainId: Chains.Hardhat,
            eventContent,
          })

          await PAM.setEmitter(
            padLeft32(Chains.Hardhat),
            padLeft32(adapterTest.target),
          )

          // Fees are taken since we are unwrapping the token
          const tx = adapter.settle(operation.serialize(), metadata)
          const fees = BigInt(amount * 0.002)
          const netAmount = BigInt(amount) - fees
          await expect(tx)
            .to.emit(lockbox, 'Withdraw')
            .withArgs(recipient, amount)
          if (!_isNative)
            await expect(tx)
              .to.emit(erc20, 'Transfer')
              .withArgs(lockbox, recipient, netAmount)
          await expect(tx).to.emit(adapter, 'Settled')

          if (_isNative) {
            await expect(tx).to.changeEtherBalance(lockbox, -netAmount)
            await expect(tx).to.changeTokenBalance(pTokenV2, feesManager, fees)
            await expect(tx).to.changeEtherBalance(recipient, netAmount)
          } else {
            await expect(tx).to.changeTokenBalance(erc20, lockbox, -netAmount)
            await expect(tx).to.changeTokenBalance(pTokenV2, feesManager, fees)
            await expect(tx).to.changeTokenBalance(erc20, recipient, netAmount)
          }
        })
      })
    })
  }),
)
