const {
  setCode,
  setBalance,
  loadFixture,
} = require('@nomicfoundation/hardhat-network-helpers')
const {
  Chains,
  Versions,
  Protocols,
  ProofcastEventAttestator,
} = require('@pnetwork/event-attestator')
const { expect } = require('chai')
const { ZeroAddress, zeroPadValue } = require('ethers')
const hre = require('hardhat')

const ERC1820BYTES = require('./bytecodes/ERC1820.js')
const Operation = require('./utils/Operation.js')
const { decodeSwapEvent } = require('./utils/decode-swap-event.js')
const { deployProxy } = require('./utils/deploy-proxy.js')
const { deploy } = require('./utils/deploy.js')
const { SWAP_TOPIC, getSwapEvent } = require('./utils/get-swap-event.js')
const { getUpgradeOpts } = require('./utils/get-upgrade-opts.js')
const { upgradeProxy } = require('./utils/upgrade-proxy.js')

const ERC1820 = '0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24'
const deployERC1820 = () => setCode(ERC1820, ERC1820BYTES)

;['', 'NoGSN'].map(_useGSN => {
  describe(`Adapter Test Units (${_useGSN})`, () => {
    ;[false, true].map(_isNative => {
      const setup = async () => {
        const [owner, admin, minter, recipient, user, evil, securityCouncil] =
          await hre.ethers.getSigners()
        const name = 'Token A'
        const symbol = 'TKN A'
        const supply = 100000000
        const originChainId = '0x10000000'
        const mintingLimit = 10000
        const burningLimit = 20000

        await deployERC1820()

        const pToken = await deployProxy(hre, `PToken${_useGSN}`, admin, [
          `p${name}`,
          `p${symbol}`,
          owner.address,
          originChainId,
        ])

        const opts = getUpgradeOpts(owner, _useGSN)
        const pTokenV2 = await upgradeProxy(
          hre,
          pToken,
          `XERC20PToken${_useGSN}Compat`,
          opts,
          admin,
        )

        const erc20 = _isNative
          ? { target: ZeroAddress }
          : await deploy(hre, 'ERC20Test', [name, symbol, supply])

        const lockbox = await deploy(hre, 'XERC20Lockbox', [
          pTokenV2.target,
          erc20.target,
          _isNative,
        ])

        const erc20Bytes = zeroPadValue(erc20.target, 32)

        const chainId = Chains(Protocols.Evm).Hardhat
        const eventAttestator = new ProofcastEventAttestator({
          version: Versions.V1,
          protocolId: Protocols.Evm,
          chainId: chainId,
        })

        if (!_isNative) await erc20.connect(owner).transfer(user, 10000)

        const feesManager = await deploy(hre, 'FeesManager', [securityCouncil])
        const PAM = await deploy(hre, 'PAM', [])
        const adapter = await deploy(hre, 'Adapter', [
          pTokenV2.target,
          erc20Bytes,
          _isNative,
          feesManager,
          PAM,
        ])

        const attestation = '0x'
        await PAM.setTopicZero(zeroPadValue(originChainId, 32), SWAP_TOPIC)
        await PAM.setTeeSigner(eventAttestator.publicKey, attestation)
        await PAM.setEmitter(
          zeroPadValue(Chains(Protocols.Evm).Hardhat, 32),
          zeroPadValue(adapter.target, 32),
        )

        await pTokenV2.connect(owner).setLockbox(lockbox)
        await pTokenV2
          .connect(owner)
          .setLimits(adapter, mintingLimit, burningLimit)

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

      describe(`swap (native = ${_isNative})`, () => {
        it('Should perform a swap successfully', async () => {
          let {
            user,
            recipient,
            adapter,
            erc20,
            pTokenV2,
            lockbox,
            feesManager,
          } = await loadFixture(setup)
          const data = '0x'
          const amount = 4000n
          const FEE_DIVISOR = await adapter.FEE_DIVISOR()
          const FEE_BASIS_POINTS = await adapter.FEE_BASIS_POINTS()
          const fees = (amount * FEE_BASIS_POINTS) / FEE_DIVISOR
          const destinationChainId = zeroPadValue('0x01', 32)
          const balancePre = _isNative
            ? await hre.ethers.provider.getBalance(user)
            : await erc20.balanceOf(user)
          const expectedNonce = 0

          adapter = await adapter.connect(user)

          let tx
          if (_isNative) {
            tx = adapter.swap(
              erc20.target,
              amount,
              destinationChainId,
              recipient.address,
              data,
              {
                value: amount,
              },
            )
          } else {
            await erc20.connect(user).approve(adapter, amount)
            tx = adapter.swap(
              erc20.target,
              amount,
              destinationChainId,
              recipient.address,
              data,
            )
          }

          const receipt = await (await tx).wait(0)

          const balancePost = _isNative
            ? await hre.ethers.provider.getBalance(user)
            : await erc20.balanceOf(user)

          const lockboxBalance = _isNative
            ? await hre.ethers.provider.getBalance(lockbox)
            : await erc20.balanceOf(lockbox)

          const swapLog = receipt.logs.find(log => log.topics[0] === SWAP_TOPIC)
          expect(swapLog).to.not.be.undefined

          const decodedData = decodeSwapEvent(swapLog.data)

          expect(decodedData.erc20).to.equal(
            hre.ethers.zeroPadValue(erc20.target.toLowerCase(), 32),
          )
          expect(decodedData.destinationChainId).to.equal(destinationChainId)
          expect(decodedData.amount).to.equal(amount - fees)
          expect(decodedData.sender).to.equal(
            hre.ethers.zeroPadValue(user.address.toLowerCase(), 32),
          )
          expect(decodedData.recipient).to.equal(recipient.address)
          expect(decodedData.data).to.equal(data)

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

      describe(`settle (native = ${_isNative})`, () => {
        it('Should settle the operation correctly', async () => {
          const {
            owner,
            user,
            PAM,
            recipient,
            erc20,
            adapter,
            lockbox,
            eventAttestator,
          } = await loadFixture(setup)

          const nonce = 0
          const data = '0x'
          const amount = 4000n

          const adapterTest = await deploy(hre, 'AdapterTest', [])
          const event = await generateSwapEvent(
            adapterTest,
            nonce,
            erc20,
            Chains(Protocols.Evm).Hardhat,
            amount,
            user.address,
            recipient.address,
            data,
          )

          if (_isNative) {
            await setBalance(lockbox.target, hre.ethers.toBeHex(amount))
          } else {
            await erc20.connect(owner).transfer(lockbox, amount)
          }

          const metadata = [
            eventAttestator.getEventPreImage(event),
            eventAttestator.formatEvmSignature(eventAttestator.sign(event)),
          ]

          const decodedEvent = decodeSwapEvent(event.data)

          const operation = new Operation({
            blockId: event.blockHash,
            txId: event.transactionHash,
            originChainId: Chains(Protocols.Evm).Hardhat,
            ...decodedEvent,
          })

          await PAM.setTopicZero(
            zeroPadValue(Chains(Protocols.Evm).Hardhat, 32),
            SWAP_TOPIC,
          )
          await PAM.setEmitter(
            zeroPadValue(Chains(Protocols.Evm).Hardhat, 32),
            zeroPadValue(adapterTest.target, 32),
          )

          // Fees are taken since we are unwrapping the token
          const tx = adapter.settle(operation.serialize(), metadata)

          await expect(tx)
            .to.emit(lockbox, 'Withdraw')
            .withArgs(recipient, amount)
          if (!_isNative)
            await expect(tx)
              .to.emit(erc20, 'Transfer')
              .withArgs(lockbox, recipient, amount)
          const eventId = eventAttestator.getEventId(event)
          await expect(tx).to.emit(adapter, 'Settled').withArgs(eventId)

          if (_isNative) {
            await expect(tx).to.changeEtherBalance(lockbox, -amount)
            await expect(tx).to.changeEtherBalance(recipient, amount)
          } else {
            await expect(tx).to.changeTokenBalance(erc20, lockbox, -amount)
            await expect(tx).to.changeTokenBalance(erc20, recipient, amount)
          }
        })
      })
    })
  })
})
