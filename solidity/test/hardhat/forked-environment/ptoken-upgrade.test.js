const helpers = require('@nomicfoundation/hardhat-network-helpers')
const {
  Chains,
  ProofcastEventAttestator,
  Protocols,
  Versions,
} = require('@pnetwork/event-attestator')
const { expect } = require('chai')
const hre = require('hardhat')

const Operation = require('../utils/Operation.js')
const { decodeSwapEvent } = require('../utils/decode-swap-event.js')
const { deploy } = require('../utils/deploy.js')
const { SWAP_TOPIC, getSwapEvent } = require('../utils/get-swap-event.js')
const { getUpgradeOpts } = require('../utils/get-upgrade-opts.js')
const { padLeft32 } = require('../utils/pad-left-32.js')
const { upgradeProxy } = require('../utils/upgrade-proxy.js')
const {
  deployXERC20,
  deployXERC20Lockbox,
} = require('../utils/xerc20-factory-deploy.js')
const PTokenAbi = require('./abi/bsc/PToken.json')
const Erc20Abi = require('./abi/eth/ERC20.json')
const VaultAbi = require('./abi/eth/Vault.json')

const ADDRESS_PTOKEN_V1_VAULT = '0xe396757ec7e6ac7c8e5abe7285dde47b98f22db8' // vault on ETH
const ADDRESS_ERC20_TOKEN = '0x1fe24f25b1cf609b9c4e7e12d802e3640dfa5e43' // CGG on ETH
const ADDRESS_PTOKEN = '0x1613957159e9b0ac6c80e824f7eea748a32a0ae2' // CGG on BSC
const ADDRESS_PTOKEN_PROXY_ADMIN_OWNER =
  '0x4388ce1dAeF1758Fc94f4912b642bA095866bA00' // CGG on BSC
const ADDRESS_PNETWORK_SIGNER = '0x341aA660fD5c280F5a9501E3822bB4a98E816D1b'

// NOTE: this test suite is meant to be run all at once
// Filtering tests through test.only directive may result
// into tests failures and wrong behaviour
//
// NOTE: Flow order is from top to bottom
const conditionalDescribe = process.env['FORK'] ? describe : describe.skip

conditionalDescribe(
  'Forked Testing - PToken v1 upgrade on BSC and subsequent pegout to Ethereum',
  () => {
    const oneEth = hre.ethers.toBeHex(hre.ethers.parseEther('1'))
    const mintingLimit = hre.ethers.parseEther('500000')
    const burningLimit = hre.ethers.parseEther('500000')
    const swapAmount = hre.ethers.parseEther('10000')
    const userdata = '0x'

    let erc20,
      adapterEth,
      adapterBsc,
      owner,
      securityCouncil,
      user,
      pamBsc,
      recipient,
      feesManagerBsc,
      eventAttestator,
      swapMetadata,
      swapOperation,
      fees

    before(async () => {
      ;[owner, recipient, securityCouncil, pamBsc, feesManagerBsc] =
        await hre.ethers.getSigners()

      const version = Versions.V1
      const protocolId = Protocols.Evm
      const chainId = Chains(Protocols.Evm).Bsc
      eventAttestator = new ProofcastEventAttestator({
        version,
        protocolId,
        chainId,
      })
    })

    describe('Binance Smart Chain - swap()', () => {
      let ptoken, proxyAdminOwner, ptokenv2
      before(async () => {
        const rpc = hre.config.networks.bscFork.url
        const blockToForkFrom = 43336397 // 2024-10-22 09:25
        await helpers.reset(rpc, blockToForkFrom)

        user = await hre.ethers.getImpersonatedSigner(
          '0x816a99530B0f272Bb6ba4913b8952249f8d2E21b',
        )

        await helpers.setBalance(user.address, oneEth)
        ptoken = await hre.ethers.getContractAt(PTokenAbi, ADDRESS_PTOKEN)
        proxyAdminOwner = await hre.ethers.getImpersonatedSigner(
          ADDRESS_PTOKEN_PROXY_ADMIN_OWNER,
        )
        adapterBsc = await deploy(hre, 'Adapter', [
          ptoken.target,
          ADDRESS_ERC20_TOKEN,
          feesManagerBsc,
          pamBsc,
        ])

        await helpers.setBalance(proxyAdminOwner.address, oneEth)
      })

      it('Should upgrade the ptoken successfully', async () => {
        const userBalance = await ptoken.balanceOf(user)

        const useGSN = ptoken.setTrustedSigner != undefined ? '' : 'NoGSN'
        const opts = getUpgradeOpts(proxyAdminOwner, useGSN)

        ptokenv2 = await upgradeProxy(
          hre,
          ptoken,
          `XERC20PToken${useGSN}Compat`,
          opts,
          proxyAdminOwner,
        )

        expect(await ptokenv2.balanceOf(user)).to.be.equal(userBalance)
      })

      it('Should apply the required setup and perform a swap to Ethereum', async () => {
        // We use HH chainid here instead of Mainnet because we don't have
        // the possibility to force it when forking.
        const destinationChainId = padLeft32(Chains(Protocols.Evm).Hardhat)
        const ptokenOwner = await hre.ethers.getImpersonatedSigner(
          await ptokenv2.owner(),
        )

        await ptokenv2
          .connect(ptokenOwner)
          .setLimits(adapterBsc, mintingLimit, burningLimit)

        const userBalancePre = await ptokenv2.balanceOf(user)
        await ptokenv2.connect(user).approve(adapterBsc, swapAmount)
        const tx = await adapterBsc
          .connect(user)
          .swap(
            ptokenv2,
            swapAmount,
            destinationChainId,
            recipient.address,
            userdata,
          )

        const swapEvent = await getSwapEvent(tx)

        swapMetadata = [
          eventAttestator.getEventPreImage(swapEvent),
          eventAttestator.formatEvmSignature(eventAttestator.sign(swapEvent)),
        ]

        const decodedEvent = decodeSwapEvent(swapEvent.data)
        swapOperation = new Operation({
          blockId: swapEvent.blockHash,
          txId: swapEvent.transactionHash,
          originChainId: Chains(Protocols.Evm).Bsc,
          nonce: swapEvent.topics[1],
          ...decodedEvent,
        })

        const FEES_DIVISOR = await adapterBsc.FEE_DIVISOR()
        const FEES_BP = await adapterBsc.FEE_BASIS_POINTS()
        fees = (swapAmount * FEES_BP) / FEES_DIVISOR
        expect(await ptokenv2.balanceOf(user)).to.be.equal(
          userBalancePre - swapAmount,
        )
        expect(await ptokenv2.balanceOf(feesManagerBsc)).to.be.equal(fees)
      })
    })

    describe('Ethereum mainnet - collateral migration', () => {
      let vault, pnetwork, collateral
      let lockboxEth, xerc20, pamEth, feesManagerEth
      before(async () => {
        const rpc = hre.config.networks.ethFork.url
        const blockToForkFrom = 20369499 // 2024-07-23 15:22
        await helpers.reset(rpc, blockToForkFrom)

        erc20 = await hre.ethers.getContractAt(Erc20Abi, ADDRESS_ERC20_TOKEN)

        const name = `p${await erc20.name()}`
        const symbol = `p${await erc20.symbol()}`
        const isNative = false

        const factory = await deploy(hre, 'XERC20Factory', [])
        xerc20 = await deployXERC20(hre, factory, name, symbol)
        lockboxEth = await deployXERC20Lockbox(
          hre,
          factory,
          xerc20,
          erc20,
          isNative,
        )

        vault = await hre.ethers.getContractAt(
          VaultAbi,
          ADDRESS_PTOKEN_V1_VAULT,
        )
        pnetwork = await hre.ethers.getImpersonatedSigner(
          ADDRESS_PNETWORK_SIGNER,
        )
        pamEth = await deploy(hre, 'PAM', [])
        feesManagerEth = await deploy(hre, 'FeesManager', [securityCouncil])

        adapterEth = await deploy(hre, 'Adapter', [
          xerc20.target,
          ADDRESS_ERC20_TOKEN,
          feesManagerEth,
          pamEth,
        ])

        await xerc20.setLimits(adapterEth, mintingLimit, burningLimit)
        await helpers.setBalance(pnetwork.address, oneEth)
      })

      it('Should transfer all the funds to the lockbox', async () => {
        collateral = await erc20.balanceOf(vault)
        await vault.connect(pnetwork).pegOut(lockboxEth, erc20, collateral)

        expect(await erc20.balanceOf(vault)).to.be.equal(0)
        expect(await erc20.balanceOf(lockboxEth)).to.be.equal(collateral)
      })

      it('Should remove the token for the supported token list', async () => {
        expect(await vault.isTokenSupported(erc20)).to.be.equal(true)

        await vault.connect(pnetwork).removeSupportedToken(erc20)

        expect(await vault.isTokenSupported(erc20)).to.be.equal(false)
      })

      it('Should settle the pegout correctly', async () => {
        const attestation = '0x'

        await pamEth.setTeeSigner(eventAttestator.publicKey, attestation)
        await pamEth.setEmitter(
          padLeft32(Chains(Protocols.Evm).Bsc),
          padLeft32(adapterBsc.target),
        )
        await pamEth.setTopicZero(
          padLeft32(Chains(Protocols.Evm).Bsc),
          SWAP_TOPIC,
        )

        await adapterEth
          .connect(recipient)
          .settle(swapOperation.serialize(), swapMetadata)

        const netAmount = swapAmount - fees

        expect(await erc20.balanceOf(recipient)).to.be.equal(netAmount)
        expect(await erc20.balanceOf(lockboxEth)).to.be.equal(
          collateral - netAmount,
        )
      })
    })
  },
)
