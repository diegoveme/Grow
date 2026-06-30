<div align="center">

# 🌱 Grow

### Remittances on Stellar that pay you back.

*Your money arrives in seconds — and a part of it takes root, earning yield on its own.*

[![Stellar](https://img.shields.io/badge/Stellar-Testnet-3ECAD6?logo=stellar&logoColor=white)](https://stellar.org)
[![Soroban](https://img.shields.io/badge/Soroban-Rust-C8A84B?logo=rust&logoColor=white)](https://soroban.stellar.org)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs)](https://nextjs.org)
[![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com)
[![Bun](https://img.shields.io/badge/Bun-1.x-000000?logo=bun)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-5C9E55.svg)](#license)

</div>

---

## The problem

People around the world send hundreds of billions of dollars in remittances every
year. The money arrives, gets spent, and earns **nothing** in between. The families
receiving it have no easy on-ramp to the yield the rest of the financial world takes
for granted.

## The solution

**Grow** is a remittance dApp on Stellar. A family receives **USDC** instantly, and a
**configurable fraction** automatically flows into a yield vault
([DeFindex](https://docs.defindex.io/) → [Blend](https://docs.blend.capital/)),
earning APY — while the rest stays instantly spendable and cash-out-ready through a
SEP-24 anchor. A **Soroban smart contract** performs the split on-chain.

```
                       ┌──────────────────────────────────────────────┐
   Sender ──USDC──▶    │  Stellar Anchor (SEP-24)  ─────────────────▶  │
                       └──────────────────────────────────────────────┘
                                            │
                                            ▼
                            ┌───────────────────────────────┐
                            │   yield_splitter  (Soroban)    │
                            │   receive() → split(ratio)     │
                            └───────────────────────────────┘
                                            │
                    ┌───────────── 70% ─────┴───── 30% ──────────────┐
                    ▼                                                 ▼
        Recipient wallet (USDC)                          DeFindex vault → Blend pool
        spendable · cash-out                             earns APY · claim_yield()
```

The split ratio is chosen by each recipient and can change anytime.

---

## Features

- 🔗 **On-chain split** — a Soroban (Rust) contract custodies funds, splits each
  remittance per the recipient's ratio, and emits typed events.
- 🌾 **Automatic yield** — the savings portion routes into a DeFindex vault backed by
  a Blend lending pool.
- 👛 **Any Stellar wallet** — Freighter, xBull, Albedo, Lobstr, Hana… via the
  [Stellar Wallets Kit](https://stellarwalletskit.dev/).
- 🏦 **Fiat on/off-ramp** — SEP-10 auth + SEP-24 interactive deposit/withdraw.
- 🎚️ **Configurable** — set your spendable/vault ratio on-chain from the dashboard.
- 🪪 **Wallet-signed, key-safe** — the API builds unsigned transactions; the browser
  wallet signs. No private keys ever leave the user.

---

## Tech stack

| Layer | Technology |
| --- | --- |
| **Smart contract** | Soroban · Rust (`soroban-sdk` 23) |
| **Frontend** | Next.js 16 (App Router) · React 19 · Tailwind CSS 4 |
| **Backend** | NestJS 11 · Postgres (Supabase) via `postgres.js` |
| **Stellar** | `@stellar/stellar-sdk`, Stellar Wallets Kit, SEP-10/24 |
| **Yield** | `@blend-capital/blend-sdk`, `@defindex/sdk` |
| **Tooling** | Bun workspaces · TypeScript · Prettier |

---

## Monorepo

```
raíz/
├── apps/
│   ├── web/          Next.js — landing + dApp dashboard
│   └── api/          NestJS — anchor, splits, vault, persistence
├── packages/
│   ├── contracts/    Soroban — yield_splitter (Rust) + deploy script
│   └── shared/       Design tokens, domain types, network config
└── …
```

| Package | Purpose |
| --- | --- |
| [`apps/web`](apps/web) | Landing page + the dApp (connect wallet, balances, split, send, vault) |
| [`apps/api`](apps/api) | SEP-10/24 anchor proxy, contract reads & tx building, yield, remittances |
| [`packages/contracts`](packages/contracts) | The `yield_splitter` Soroban contract + tests + testnet deploy |
| [`packages/shared`](packages/shared) | Raíz design tokens, shared types, testnet constants |

---

## Getting started

**Prerequisites:** [Bun](https://bun.sh) ≥ 1.1, and (for the contract) the
[Stellar CLI](https://developers.stellar.org/docs/tools/cli) + Rust with the
`wasm32v1-none` target.

```bash
# 1. Install
bun install

# 2. Configure
cp .env.example apps/api/.env        # fill in your values
#   apps/web/.env.local → NEXT_PUBLIC_API_URL, NEXT_PUBLIC_STELLAR_NETWORK

# 3. Run everything (web :3000 + api :3001)
bun run dev

#   …or individually
bun run web
bun run api          # Swagger at http://localhost:3001/api/docs
```

### Deploy the contract to testnet

```bash
cd packages/contracts
bun run deploy       # builds, deploys, initializes; prints the contract id
```

> A reference deployment lives on **Stellar testnet**:
> `CAI6YBXYA56VKKDQHMIGJDGSFTQJPJZHZODBS3YZCTTPM2UOGNLFVYYC`

---

## Smart contract — `yield_splitter`

| Function | Description |
| --- | --- |
| `initialize(admin, token)` | One-time setup (admin + USDC token) |
| `set_split(user, spendable_bps)` | Recipient picks their spendable % (basis points) |
| `receive(from, to, amount)` | Pull USDC, split per ratio, credit balances |
| `deposit_vault(to)` | Move the earmarked portion toward the yield vault |
| `claim_yield(to, amount)` | Record accrued yield as claimable |
| `withdraw(to, amount)` | Withdraw spendable USDC |
| `position(user)` | Read balances + ratio |

**Events:** `FundsReceived` · `VaultDeposited` · `YieldClaimed` · `SplitSet`
&nbsp;·&nbsp; **Tests:** `cd packages/contracts && cargo test` (10 passing)

---

## API

Base URL `http://localhost:3001/api` · interactive docs at `/api/docs`.

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/health` | Service + database status |
| `POST` | `/remittances/preview` | Preview the spendable/vault split |
| `GET·POST` | `/remittances` | List / record remittances |
| `GET` | `/splits/:address` | On-chain position for an address |
| `POST` | `/splits/*/build` | Build unsigned set-split / receive / withdraw txs |
| `POST` | `/splits/submit` | Submit a signed transaction |
| `GET` | `/vault/apy` | Live vault APY (DeFindex → Blend) |
| `POST` | `/anchor/sep10/*` · `/anchor/sep24/*` | SEP-10 auth + SEP-24 deposit/withdraw |

---

## Roadmap

- [ ] Live DeFindex vault + Blend pool wiring on testnet
- [ ] Recurring/streamed remittances
- [ ] In-app cash-out UX polish for SEP-24
- [ ] Mainnet readiness & audit

---

## License

[MIT](LICENSE) © Raíz
