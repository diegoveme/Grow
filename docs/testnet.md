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
| `upgrade` | [cf0f00e7…](https://stellar.expert/explorer/testnet/tx/cf0f00e709db5444dbe97b520df4eb5c696585b63f0cfae2ab09ade26b484cc8) | Admin swapped in the code with `pay_from_savings` |
| `pay_from_savings` | [e49c3d40…](https://stellar.expert/explorer/testnet/tx/e49c3d40b3c23eec0a02029839b0fd5722f83b1ccacc67c52cef5a6dbe372243) | Recipient paid 5 from savings straight to another account |
| `send_batch` | [5f9e681d…](https://stellar.expert/explorer/testnet/tx/5f9e681ddf68bc4de4f0644c330eee7540f2c1621b0403649078e276b4c5aa19) | One signature paid two people, each split by their own ratio |
| `create_schedule` | [c1ff3e0d…](https://stellar.expert/explorer/testnet/tx/c1ff3e0d030eead0714ebf17d5c02ec5ff2ae852f652a8a5c49fa43edbbab3bd) | 5 every 60s, 2 runs, after a token approve |
| `run_schedule` | [acbdc2d5…](https://stellar.expert/explorer/testnet/tx/acbdc2d5a3ddcdabbc8ee95361fd5641f62c834e88738be93986f31a3c41faaf) | First run, triggered by someone other than the sender |
| `create_pledge` | [85e47c13…](https://stellar.expert/explorer/testnet/tx/85e47c139fa986edd1f98200a0969b2ea420a6662f6d50700347b71a9011a9a0) | 4 earmarked for a payee, released by the beneficiary |
| `release_pledge` | [1304fde4…](https://stellar.expert/explorer/testnet/tx/1304fde438e93ce3b142707ff6016fdc0481b81d1290b2d605d5b67072f3d61e) | Beneficiary paid the payee directly |
| `refund_pledge` | [54260153…](https://stellar.expert/explorer/testnet/tx/542601535f2568237dc773c1e8f2d161faa5ae5fec92465477d09d93d2d6fdc2) | An expired, unused pledge went back to its sender |
| `recover_token` | [d4673c30…](https://stellar.expert/explorer/testnet/tx/d4673c30085ecf9c39bfeceb533d91df9bb4a728e512c8a8dd3a7b4066ed000c) | Admin returned XLM sent to the contract by mistake |

All of them were built by the Grow API and signed by the account named in the
call. Tests for each function live in
`packages/contracts/contracts/yield_splitter/src/test.rs`.

## App deployment on testnet (use this one)

The contract the app is configured for, with the same USDC the DeFindex
vault uses, so savings can move into the vault.

| Piece | Testnet id |
| --- | --- |
| yield_splitter | [CBEQUA2E…MBZCYA](https://stellar.expert/explorer/testnet/contract/CBEQUA2ET4XTZAMDB3ZOB6MUOA2B6ACZ6TV2GCDHFTETKBVG7TMBZCYA) (cap 100 USDC per recipient) |
| USDC (SAC) | `CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU`, classic `USDC:GATALTGTWIOT6BUDBCZM3Q4OQ4BO2COLOAZ7IYSKPLC2PMSOPPGF5V56` |
| DeFindex vault (USDC, Blend strategy) | `CBMVK2JK6NTOT2O4HNQAIQFJY232BHKGLIMXDVQVHIIZKDACXDFZDWHN` |
| Blend pool behind the strategy | `CCEBVDYM32YNYCVNRXQKDFFPISJJCV557CDZEIRBEE4NCV4KHPQ44HGF` |

`.env.example` already carries these values. Testnet USDC has no faucet we
can call, but it trades against XLM on the DEX: in the app, Receive → Testnet
faucet → "Get test USDC" swaps 100 XLM after the USDC trustline.

End-to-end check on this deployment: a 10 USDC remittance split 7/3
([7d34a7d3…](https://stellar.expert/explorer/testnet/tx/7d34a7d308df17c0eb31d827d7d14a84047b44661ec00d236a63f944bfb37abd)),
then the 3 saved moved into the vault with `withdraw_savings`
([f12c5a97…](https://stellar.expert/explorer/testnet/tx/f12c5a9788c11fdd25f7f8d8e55446402937788f0fb38a8f345dd566802e74ff))
and a vault deposit
([e374e7e6…](https://stellar.expert/explorer/testnet/tx/e374e7e6d0b384243e587f848bf9735f4deb210686d55d016f0e81da95b73fab)).
