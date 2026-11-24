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
