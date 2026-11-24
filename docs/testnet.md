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
https://stellar.expert/explorer/testnet/tx/d586bd597a768ce10dbe7d2ef1e8073b4cd523b10c7dbbcbb8dfddb7b7ee6395
