const helpers = require('@nomicfoundation/hardhat-network-helpers')
const {
  Chains,
  ProofcastEventAttestator,
  Protocols,
  Versions,
} = require('@pnetwork/event-attestator')
const { expect } = require('chai')
const hre = require('hardhat')
const { zeroPadValue } = require('ethers')

const Operation = require('../utils/Operation.js')
const { decodeSwapEvent } = require('../utils/decode-swap-event.js')
const { deploy } = require('../utils/deploy.js')
const { SWAP_TOPIC, getSwapEvent } = require('../utils/get-swap-event.js')
const { padLeft32 } = require('../utils/pad-left-32.js')
const {
  deployXERC20,
  deployXERC20Lockbox,
} = require('../utils/xerc20-factory-deploy.js')
const Erc20Abi = require('./abi/eth/ERC20.json')

const ADDRESS_USDC_TOKEN = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' // USDC on ETH

const conditionalDescribe = process.env['FORK'] ? describe : describe.skip



conditionalDescribe(
  'Forked Testing - Precision check',
  () => {
    const attestation = '0x'
    const mintingLimit = hre.ethers.parseEther('500000')
    const burningLimit = hre.ethers.parseEther('500000')
    const swapAmount = 10000000n // precision 6
    const destinationChainId = padLeft32(Chains(Protocols.Evm).Hardhat)
    const userdata = '0x'
    const isNative = false
    const ethUser = '0x52aa899454998be5b000ad077a46bbe360f4e497'
    const bscUser = '0xA4d91823a4bb1075fCdA9f36d7FBC0b58f5C7D42'

    let erc20,
    adapterEth,
    adapterBsc,
    ethRpc,
    ethBlockToForkFrom,
    owner,
    securityCouncil,
    user,
    pamBsc,
    recipient,
    feesManagerBsc,
    eventAttestator,
    bscEventAttestator,
    swapMetadata,
    swapOperation,
    fees,
    name,
    symbol

    before(async () => {
      [owner, recipient, securityCouncil, pamBsc, feesManagerBsc] = 
        await hre.ethers.getSigners()

      const version = Versions.V1
      const protocolId = Protocols.Evm
      eventAttestator = new ProofcastEventAttestator({
          version,
          protocolId,
          chainId: Chains(Protocols.Evm).Mainnet,
      })
      bscEventAttestator = new ProofcastEventAttestator({
        version,
        protocolId,
        chainId: Chains(Protocols.Evm).Bsc,
      })
    })
    
    describe('Precision check', () => {
      let lockboxEth, xerc20, pamEth, feesManagerEth, factory, expectedAmountOnBsc
      before(async () => {
        
        // await helpers.setBalance(pnetwork.address, oneEth)
      })
      
      it('Should deploy on Mainnet', async () => {
        ethRpc = hre.config.networks.ethFork.url
        ethBlockToForkFrom = 20369499 // 2024-07-23 15:22
        await helpers.reset(ethRpc, ethBlockToForkFrom)
        erc20 = await hre.ethers.getContractAt(Erc20Abi, ADDRESS_USDC_TOKEN)
        name = `p${await erc20.name()}`
        symbol = `p${await erc20.symbol()}`

        factory = await deploy(hre, 'XERC20Factory', [])
        xerc20 = await deployXERC20(hre, factory, name, symbol)
        lockboxEth = await deployXERC20Lockbox(
          hre,
          factory,
          xerc20,
          erc20,
          isNative,
        )

        pamEth = await deploy(hre, 'PAM', [])
        feesManagerEth = await deploy(hre, 'FeesManager', [securityCouncil])

        adapterEth = await deploy(hre, 'Adapter', [
          xerc20.target,
          zeroPadValue(ADDRESS_USDC_TOKEN, 32),
          isNative,
          feesManagerEth,
          pamEth,
        ])

        await xerc20.setLimits(adapterEth, mintingLimit, burningLimit)
      })

      it('Should swap on Mainnet', async () => {
        
        user = await hre.ethers.getImpersonatedSigner(ethUser)

        await erc20.connect(user).approve(adapterEth, swapAmount)
        const ethSwaptx = await adapterEth
          .connect(user)
          .swap(
            erc20,
            swapAmount,
            destinationChainId,
            recipient.address,
            userdata,
          )
        const ethSwapEvent = await getSwapEvent(ethSwaptx)
        swapMetadata = [
          eventAttestator.getEventPreImage(ethSwapEvent),
          eventAttestator.formatEvmSignature(eventAttestator.sign(ethSwapEvent)),
        ]
        const ethDecodedEvent = decodeSwapEvent(ethSwapEvent.data)
        swapOperation = new Operation({
          blockId: ethSwapEvent.blockHash,
          txId: ethSwapEvent.transactionHash,
          originChainId: Chains(Protocols.Evm).Mainnet,
          nonce: ethSwapEvent.topics[1],
          ...ethDecodedEvent,
        })
      })

      it('Should settle on Bsc', async () => {
        const bscRpc = hre.config.networks.bscFork.url
        const bscBlockToForkFrom = 43336397 // 2024-10-22 09:25
        await helpers.reset(bscRpc, bscBlockToForkFrom)
        user = await hre.ethers.getImpersonatedSigner(bscUser)

        const factory = await deploy(hre, 'XERC20Factory', [])
        xerc20 = await deployXERC20(hre, factory, 'pUSDC', 'pUSDC')

        pamEth = await deploy(hre, 'PAM', [])
        await pamEth.setTeeSigner(eventAttestator.publicKey, attestation)
        await pamEth.setEmitter(
          padLeft32(Chains(Protocols.Evm).Mainnet),
          padLeft32(adapterEth.target),
        )
        await pamEth.setTopicZero(
          padLeft32(Chains(Protocols.Evm).Mainnet),
          SWAP_TOPIC,
        )
        feesManagerEth = await deploy(hre, 'FeesManager', [securityCouncil])

        adapterBsc = await deploy(hre, 'Adapter', [
          xerc20.target,
          zeroPadValue(ADDRESS_USDC_TOKEN, 32),
          isNative,
          feesManagerEth,
          pamEth,
        ])

        await xerc20.setLimits(adapterBsc, mintingLimit, burningLimit)

        await adapterBsc
          .connect(user)
          .settle(swapOperation.serialize(), swapMetadata)

        const recipientXerc20Balance = await xerc20.balanceOf(recipient.address)
        fees = swapAmount * 175n / 100000n
        expectedAmountOnBsc = swapAmount - fees
        expect(recipientXerc20Balance).to.be.equal(expectedAmountOnBsc)
      })

      it('Should swap on Bsc', async () => {
        await xerc20.connect(recipient).approve(adapterBsc, expectedAmountOnBsc)
        const bscSwapTx = await adapterBsc
          .connect(recipient)
          .swap(
            xerc20,
            expectedAmountOnBsc,
            destinationChainId,
            ethUser,
            userdata,
          )
        
        const bscSwapEvent = await getSwapEvent(bscSwapTx)
        swapMetadata = [
          bscEventAttestator.getEventPreImage(bscSwapEvent),
          bscEventAttestator.formatEvmSignature(bscEventAttestator.sign(bscSwapEvent)),
        ]
        const bscDecodedEvent = decodeSwapEvent(bscSwapEvent.data)
        swapOperation = new Operation({
          blockId: bscSwapEvent.blockHash,
          txId: bscSwapEvent.transactionHash,
          originChainId: Chains(Protocols.Evm).Bsc,
          nonce: bscSwapEvent.topics[1],
          ...bscDecodedEvent,
        })
      })

      it('Should settle on Mainnet with the correct amount', async () => {
        ethRpc = hre.config.networks.ethFork.url
        ethBlockToForkFrom = 21888821 // 2025-02-20 17:50
        await helpers.reset(ethRpc, ethBlockToForkFrom)
        erc20 = await hre.ethers.getContractAt(Erc20Abi, ADDRESS_USDC_TOKEN)

        user = await hre.ethers.getImpersonatedSigner(ethUser)

        factory = await deploy(hre, 'XERC20Factory', [])
        xerc20 = await deployXERC20(hre, factory, name, symbol)
        lockboxEth = await deployXERC20Lockbox(
          hre,
          factory,
          xerc20,
          erc20,
          isNative,
        )

        pamEth = await deploy(hre, 'PAM', [])
        await pamEth.setTeeSigner(bscEventAttestator.publicKey, attestation)
        await pamEth.setEmitter(
          padLeft32(Chains(Protocols.Evm).Bsc),
          padLeft32(adapterBsc.target),
        )
        await pamEth.setTopicZero(
          padLeft32(Chains(Protocols.Evm).Bsc),
          SWAP_TOPIC,
        )
        feesManagerEth = await deploy(hre, 'FeesManager', [securityCouncil])

        adapterEth = await deploy(hre, 'Adapter', [
          xerc20.target,
          zeroPadValue(ADDRESS_USDC_TOKEN, 32),
          isNative,
          feesManagerEth,
          pamEth,
        ])

        await xerc20.setLimits(adapterEth, mintingLimit, burningLimit)

        fees = expectedAmountOnBsc * 175n / 100000n
        expectedAmountOnMainnet = expectedAmountOnBsc - fees

        // replenish the lockbox as the previous swap on eth is lost due to hh reset
        await erc20.connect(user).approve(adapterEth, expectedAmountOnMainnet)
        await adapterEth
          .connect(user)
          .swap(
            erc20,
            expectedAmountOnMainnet,
            padLeft32(Chains(Protocols.Evm).Hardhat),
            recipient.address,
            userdata,
          )
        
        const userXerc20BalanceBeforeSettle = await erc20.balanceOf(user.address)

        await adapterEth
          .connect(user)
          .settle(swapOperation.serialize(), swapMetadata)

        const userXerc20BalanceAfterSettle = await erc20.balanceOf(user.address)
        
        expect(userXerc20BalanceAfterSettle).to.be.equal(userXerc20BalanceBeforeSettle + expectedAmountOnMainnet)

        // const tx6 = await lockboxEth
        //   .connect(user)
        //   .withdrawTo(10000000n, user.address)
        
      })
    
    })
  }
)