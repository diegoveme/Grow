# Grow on Stellar Testnet

## Network
- Network: TESTNET
- Passphrase: `Test SDF Network ; September 2015`
- Soroban RPC: https://soroban-testnet.stellar.org
- Horizon: https://horizon-testnet.stellar.org

## Contracts
- yield_splitter: [CAI6YBXY…LFVYYC](https://stellar.expert/explorer/testnet/contract/CAI6YBXYA56VKKDQHMIGJDGSFTQJPJZHZODBS3YZCTTPM2UOGNLFVYYC)
- USDC token: [CAQCFVLO…VSRCJU](https://stellar.expert/explorer/testnet/contract/CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU)

## How Grow talks to Stellar
The API uses `@stellar/stellar-sdk` to build unsigned Soroban transactions.
The user's wallet signs them, and `/splits/submit` sends them to the network.

## Testnet transaction
`set_split` called on yield_splitter:
https://stellar.expert/explorer/testnet/tx/3937a3dd78d4a1c140b61bbb9ea320761a2a9eb9f558e408eba609d2a3d08ea0
