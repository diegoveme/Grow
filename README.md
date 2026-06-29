# 🌱 Raíz

**PayFi remittances on Stellar — your money arrives, and a part of it takes root.**

Raíz is a remittance dApp where the receiving family gets USDC over Stellar and a
configurable fraction automatically flows into a yield vault (DeFindex → Blend),
earning APY while the rest stays instantly spendable. A Soroban smart contract
handles the split on-chain.

> Remittances are a multi-hundred-billion-dollar flow that, once received, earns
> nothing. Raíz turns the savings portion into productive capital — without taking
> away access to the cash.

## How it works

```
Sender ──USDC──▶ Stellar Anchor (SEP-24) ──▶ yield_splitter (Soroban)
                                                   │
                        ┌──────────────────────────┴───────────────┐
                        ▼ 70% spendable                  30% vault ▼
               Recipient wallet (USDC)            DeFindex vault → Blend pool
               cash-out via anchor                earns APY · claim_yield()
```

The split ratio is configurable per user and can be changed anytime.

## Monorepo

| Package | Stack | Purpose |
| --- | --- | --- |
| `apps/web` | Next.js 16 · React 19 · Tailwind 4 | Landing + dApp (wallet, dashboard, send, vault) |
| `apps/api` | NestJS 11 | SEP-10/24 anchor, split & vault orchestration |
| `packages/contracts` | Soroban · Rust | `yield_splitter` smart contract |
| `packages/shared` | TypeScript | Design tokens, domain types, network config |

## Tech

- **Network:** Stellar **Testnet** (Soroban RPC + Horizon)
- **Wallets:** [Stellar Wallets Kit](https://stellarwalletskit.dev/) (Freighter, xBull, Albedo, Lobstr, Hana…)
- **Yield:** [DeFindex](https://docs.defindex.io/) vaults routing into [Blend](https://docs.blend.capital/) lending pools
- **On/off-ramp:** [SEP-24](https://stellar.org/protocol/sep-24) interactive deposit/withdraw
- **Runtime / package manager:** [Bun](https://bun.sh)

## Getting started

```bash
bun install

# run web + api together
bun run dev

# or individually
bun run web     # Next.js dev server
bun run api     # NestJS dev server
```

Copy `.env.example` to `.env` and fill in the testnet values.

## License

MIT
