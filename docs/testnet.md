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

> The `yield_splitter` above was deployed with the previous interface
> (`initialize`, `deposit_vault`, `claim_yield`). The current contract uses a
> constructor, pays the spendable share straight to the recipient and adds
> `withdraw_savings`, a savings cap and a pause switch. Redeploy with
> `bun run deploy` in `packages/contracts` and update this page with the new id.

## Current contract interface on testnet

A deployment of the current `yield_splitter`, used for end-to-end tests. It
runs with a throwaway admin and a test asset (`GUSD`) instead of Circle USDC,
so it is not the app's official deployment.

- yield_splitter: [CAWZOG7I…LAIWVW](https://stellar.expert/explorer/testnet/contract/CAWZOG7IXDOBSCSPNMFVA7CUHA2UDW7I7F4WLHMELTNDG62CJDLAIWVW)
- Test token SAC: [CBVXY2XB…X7K2L3K](https://stellar.expert/explorer/testnet/contract/CBVXY2XBXNKTE4ISS5BBFWJDNTIWXDQBX2EOSAJIP2QXBV5EWX7K2L3K)

| Function | Transaction | What happened |
| --- | --- | --- |
| `receive` | [30794ede…](https://stellar.expert/explorer/testnet/tx/30794ede6260422e9bcd51dca5d0d906b89066cd94be61ff8e7a8e0d0aa65436) | 100 sent: 70 to the recipient's wallet, 30 saved |
| `withdraw_savings` | [847fa133…](https://stellar.expert/explorer/testnet/tx/847fa13368cf5fdcc64302f294d210dd63df278acc3815fd070ce6c29fa484bc) | Recipient withdrew the 30 saved |
| `set_split` | [cd7c0c3f…](https://stellar.expert/explorer/testnet/tx/cd7c0c3f76995c945983979d99e4b8c6bad14d786a8eb6e1a4270d769b271ed7) | Recipient chose 100% spendable |
| `upgrade` | [7cccc2ce…](https://stellar.expert/explorer/testnet/tx/7cccc2ced82f9db97b8a0f5c49b02cb69d34343f0c9cb84037ff7c10a7021669) | Admin swapped in the code with `deposit_savings` |
| `deposit_savings` | [60fe348c…](https://stellar.expert/explorer/testnet/tx/60fe348cf9f8b8ce8a4480dd940f008c5809f9c7d4b68740d7aa92ad7ed3aeba) | Recipient set aside 10 of their own |

All of them were built by the Grow API and signed by the account named in the
call. Tests for each function live in
`packages/contracts/contracts/yield_splitter/src/test.rs`.

