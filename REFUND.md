# Refund Process for Mistaken Operations

## Overview

The **pNetwork V4** repository provides a decentralized bridging solution for transferring assets between different blockchain networks, such as EOS and Ethereum. However, mistakes can occur when users enter incorrect destination details. This document outlines the process for token owners to refund user funds in such cases.

## Refund Process

If a user mistakenly enters incorrect destination details while bridging assets, the refund process can be initiated by the token owner. The steps are as follows:

### 1. Identify the Mistaken Transaction

The token owner should first gather details about the incorrect transaction, including:

- **Transaction hash**
- **Source blockchain and address**
- **Destination blockchain and address (incorrectly provided)**
- **Intended destination address**
- **Amount and asset details (XERC20 account details)**

### 2. Verify Ownership and Mistake

The token owner should validate the claim by:

- Checking the blockchain transaction records
- Validate the mistake is real and tokens are actually locked in the contract
- Confirming the user’s request through additional security measures, if necessary

### 3. Initiate Refund (Token Owner Actions)

Once verified, the token owner can proceed with refunding process. Calling X the quantity of funds to recover
the process can be summarized as follows:

1. Set XERC20 minting limit to X
2. Mint X tokens to a secure account we have access (may be the same as the one interacting with the contracts)
3. Transfer the tokens to the XERC20 Lockbox contract
4. The Lockbox contract will return to the account that has sent the XERC20 the relative collateral denominated in the unwrapped ERC20 token
5. Once the collateral is in our control, transfer X amount of the ERC20 token to the sender of the operation
6. Refund has been completed

Please look into the following section for the right contract calls for each step on each protocol.

#### On EOS

1. Call `xtoken::setlimits` with the active account controlling the `xtoken` contract and set X as the minting limit parameter
2. Call `xtoken::mint` specifying the `to` destination account where the XERC20 token are minted to
3. Call `xtoken::transfer` using the lockbox account as destination and the correct quantity to recover
4. Collateral will be assigned to the `from` account calling `xtoken::transfer`.
5. Call `token::transfer` using the operation sender as destination account with the correct quantity
6. Refund completed

#### On Ethereum

1. Call `XERC20.setLimits()` with the owner key setting the minting limit to the quantity needed to recover
2. Call `XERC20.mint()` specifying our account as destination (an EOA we control) and the correct quantity
3. Call `XERC20.approve()` specifying the XERC20 Lockbox as spender
4. Call `XERC20Lockbox.withdraw()` by specifying the amount to withdraw (the ERC20 will be transferred to the EOA calling the withdraw() function)
5. Call ERC20.transfer() transferring the funds to the Operation.sender EOA
6. Refund completed

### 4. Notify the User

Once the refund has been processed, the token owner should provide confirmation to the user, including:

- A new transaction hash for the refund
- Expected confirmation time
