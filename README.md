# pNetwork v4:

## Overview

**_pNetwork v4 - Plug & Proof_**, represents a transformative shift in the pNetwork architecture, evolving into a generic fully decentralized proving tool designed for broad cross-chain use cases and message passing.

_pTokens_ in pNetwork v4 are revolutionised: **native** **token issuers now have control of their pTokens on any host chain supported by pNetwork.**
This shift is designed to **eliminate any dependencies or lock-in effects** traditionally associated with bridges, handing over ownership and operational control from pNetwork to the protocol/project behind the native token.
This significant evolution marks a pivotal **shift for pNetwork from a canonical bridge to a _bridge enabler_**, greatly increasing its services' flexibility and users' autonomy.

Furthermore, this new standard aims to reduce liquidity fragmentation by improving pToken fungibility, as each whitelisted bridge will mint/burn a **single version of the wrapped pToken**.

Projects have the flexibility to operate pNetwork v4 either as a standalone service or in conjunction with other bridges and validators. This **open and modular approach** enhances security configurations that each pNetwork partner can model based on their needs and preferences.

## Main features

- **Decentralised verification**: Uses one or more verifiers (pNetwork node operators) to ensure the integrity and validity of data across different blockchain networks, in a fully decentralized way.
- **Delegated Ownership and Control**: Implements new token standards (such as [_xERC20_](https://www.xerc20.com/)) that allow token issuers to own and manage their pTokens on each host chain, increasing control and eliminating lock-in effects.
- **Modular Design**: pNetwork v4 offers the ability to operate as a standalone service or alongside other bridges and validators, providing projects with adaptable security and modular configuration based on their needs.
- **Global pTokens**: Ensures that users receive the same pToken when bridging across chains, maintaining a seamless and reliable user experience.
- **Delegated Gas Costs**: Users are now responsible for executing transactions in the destination chain, giving them more control over their transactions and ensuring transparency in gas cost management.

## Technical aspects

pNetwork v4 introduces new on-chain entities:

- **pNetwork Adapter contract:** needed to facilitate the wrapping and unwrapping of the ERC20 token. This would be the entry point for UIs.
- **Lockbox:** vault where the collateral is deposited/released when wrapping/unwrapping ERC20 tokens.
- **pNetwork fee contract:** responsible for holding all the node operator fees.
- **pTokensV2:** the wrapped representation of the ERC20 token on the underlying chain.
- **pNetwork Authorization Module (PAM):** verifies that the operation performed on the destination chain has been authorized by pNetwork Authorization System.

### pNetwork Authorization System

The new architecture expects each **pNetwork node operator to run an off-chain system that detects a swap event** from the originating chain and **delivers a proof** related to the event emitted via an HTTP API.

The UI will be responsible for picking this data and submitting it to the pNetwork authorization module to finalise the swap on the destination chain.

### Network supported

pNetwork v4 aims to extend support across **all chains currently compatible with pNetwork**, with the potential to expand to additional networks. Given the extensive changes and the adoption of innovative approaches in v4, integration might initially be challenging for some long-tail or technically distinct chains, particularly where core components such as the xERC20 standard are missing.

The first release of pNetwork v4 will primarily support EVM based chains, ensuring robust and efficient implementation. The main chains to be included are:

- Ethereum
- BNB chain
- Gnosis
- Polygon

## Stay tuned!

This project is currently being developed and this page will be updated in the coming days, stay tuned!
