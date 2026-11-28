<div align="center">

# 🌱 Grow

### Remittances on Stellar with built-in savings.

*Your money arrives in seconds, and a part of it takes root.*

[![Stellar](https://img.shields.io/badge/Stellar-Mainnet%20beta-3ECAD6?logo=stellar&logoColor=white)](https://stellar.expert/explorer/public/contract/CCFVDG2UZ2IJBXMHVFKVLWLJ6Z2JBTJWNXFNIA2VWACNA6IFUKKOMTJD)
[![Soroban](https://img.shields.io/badge/Soroban-Rust-C8A84B?logo=rust&logoColor=white)](https://soroban.stellar.org)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs)](https://nextjs.org)
[![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com)
[![Bun](https://img.shields.io/badge/Bun-1.x-000000?logo=bun)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-5C9E55.svg)](#license)

**[Open the app (mainnet beta)](https://grow-mainnet.vercel.app)** · [Demo video](https://youtu.be/HmXsgK5MCFU) · [Testnet app](https://grow-green-one.vercel.app) · [Contract on stellar.expert](https://stellar.expert/explorer/public/contract/CCFVDG2UZ2IJBXMHVFKVLWLJ6Z2JBTJWNXFNIA2VWACNA6IFUKKOMTJD)

</div>

---

## Live

| | Mainnet (beta, real USDC) | Testnet (demo) |
| --- | --- | --- |
| App | https://grow-mainnet.vercel.app | https://grow-green-one.vercel.app |
| Contract `yield_splitter` | [`CCFVDG2U…MTJD`](https://stellar.expert/explorer/public/contract/CCFVDG2UZ2IJBXMHVFKVLWLJ6Z2JBTJWNXFNIA2VWACNA6IFUKKOMTJD) | [`CBEQUA2E…ZCYA`](https://stellar.expert/explorer/testnet/contract/CBEQUA2ET4XTZAMDB3ZOB6MUOA2B6ACZ6TV2GCDHFTETKBVG7TMBZCYA) |
| USDC | Circle `USDC:GA5Z…KZVN` | test `USDC:GATA…` |
| Demo video | [watch](https://youtu.be/HmXsgK5MCFU) | |

How each contract function is called from the app (screen, file and line) and
the first mainnet transactions: [docs/mainnet.md](docs/mainnet.md#functions-used-from-the-app).

> ⚠️ **Beta:** Grow has not been audited. Savings held per person are capped at
> 100 USDC during the beta. Use small amounts.

## How to use it

1. **Connect a wallet** (Freighter, xBull, Lobstr, Albedo…) set to **Mainnet**,
   with a little XLM for fees, at https://grow-mainnet.vercel.app.
2. **Receive → add USDC** (the trustline) if the wallet doesn't hold USDC yet.
3. **Settings → choose your split** (**Save split on-chain**), for example 70% to your wallet and 30% to
   savings, and save it on-chain. Anyone who sends you USDC through Grow is split
   by this ratio.
4. **Send → One person** to send USDC (or XLM). **Several people** pays up to 10
   at once; **Recurring** sends every week or month.
5. **Overview → "Savings in Grow"**: **Set aside** USDC from your wallet, **Withdraw**
   it back, or **Pay** a school, clinic or landlord straight from savings.
6. **Earmarked**: set money aside for a specific payee; the family pays it, or
   it comes back to you after it expires.
7. **/stats** shows public on-chain usage of the contract.

Every transaction is built by the API, signed by your wallet in the browser and
visible on [stellar.expert](https://stellar.expert/explorer/public/contract/CCFVDG2UZ2IJBXMHVFKVLWLJ6Z2JBTJWNXFNIA2VWACNA6IFUKKOMTJD).

---

## The problem

People around the world send hundreds of billions of dollars in remittances every
year. The money arrives and gets spent, and the families receiving it rarely have
a simple, safe way to set part of it aside.

## The solution

**Grow** is a remittance dApp on Stellar. A sender pays **USDC** through a
**Soroban smart contract** that splits it by the recipient's own ratio: the
spendable share lands in the recipient's wallet instantly (cash-out ready through
a SEP-24 anchor), and the rest is **saved for them** on-chain. Recipients can
withdraw their savings any time, or move USDC into a vault
([DeFindex](https://docs.defindex.io/) → [Blend](https://docs.blend.capital/))
from the same dashboard.

```
   Sender ──USDC──▶  yield_splitter.receive(from, to, amount)   (Soroban)
                                     │  split by the recipient's ratio
                  ┌──────── 70% ─────┴───── 30% ─────────┐
                  ▼                                       ▼
      Recipient wallet (USDC)                Savings held for the recipient
      spendable · cash-out (SEP-24)          withdraw_savings() any time
                                                          │
                                                          ▼  from the wallet
                                             DeFindex vault → Blend pool
```

The split ratio is chosen by each recipient and can change anytime.

---

## Features

- 🔗 **On-chain split**: a Soroban (Rust) contract pays the spendable share
  straight to the recipient and keeps only their savings, emitting typed events.
- 🌾 **Savings that can grow**: withdraw savings any time, and deposit USDC into
  a DeFindex vault backed by a Blend lending pool.
- 👨‍👩‍👧 **Several people, one signature**: pay up to 10 family members at once,
  each split by their own choice.
- 🔁 **Recurring remittances**: approve once, send every week or month; cancel anytime.
- 🏷️ **Earmarked payments**: set money aside for school fees or a clinic; the
  family pays it straight to them, or it comes back if unused.
- 🛡️ **Beta guardrails**: per-recipient savings cap, deposit pause switch
  (withdrawals always open) and admin upgrade for fixes.
- 👛 **Any Stellar wallet**: Freighter, xBull, Albedo, Lobstr, Hana… via the
  [Stellar Wallets Kit](https://stellarwalletskit.dev/).
- 🏦 **Fiat on/off-ramp**: SEP-10 auth + SEP-24 interactive deposit/withdraw
  (testnet reference anchor).
- 🎚️ **Configurable**: set your spendable/savings ratio on-chain from the dashboard.
- 🪪 **Wallet-signed, key-safe**: the API builds unsigned transactions and the
  browser wallet signs. No private keys ever leave the user.

---

## Tech stack

| Layer | Technology |
| --- | --- |
| **Smart contract** | Soroban · Rust (`soroban-sdk` 23) |
| **Frontend** | Next.js 16 (App Router) · React 19 · Tailwind CSS 4 |
| **Backend** | NestJS 11 · Postgres (Supabase) via `postgres.js` |
| **Stellar** | `@stellar/stellar-sdk`, Stellar Wallets Kit, SEP-10/24 |
| **Vault** | `@blend-capital/blend-sdk`, `@defindex/sdk` |
| **Tooling** | Bun workspaces · TypeScript · Prettier |

---

## Monorepo

```
grow/
├── apps/
│   ├── web/          Next.js: landing + dApp dashboard
│   └── api/          NestJS: anchor, splits, vault, persistence
├── packages/
│   ├── contracts/    Soroban: yield_splitter (Rust) + deploy script
│   └── shared/       Design tokens, domain types, network config
└── …
```

| Package | Purpose |
| --- | --- |
| [`apps/web`](apps/web) | Landing page + the dApp (connect wallet, balances, split, send, savings, vault) |
| [`apps/api`](apps/api) | SEP-10/24 anchor proxy, contract reads & tx building, vault, remittances, stats |
| [`packages/contracts`](packages/contracts) | The `yield_splitter` Soroban contract + tests + deploy script |
| [`packages/shared`](packages/shared) | Grow design tokens, shared types, validation and network constants |

---

## Getting started

**Prerequisites:** [Bun](https://bun.sh) ≥ 1.1, [Node.js](https://nodejs.org) ≥ 22.12
(see `.nvmrc`), and (for the contract) the
[Stellar CLI](https://developers.stellar.org/docs/tools/cli) + Rust with the
`wasm32v1-none` target.

```bash
# 1. Install
bun install

# 2. Configure
cp .env.example apps/api/.env        # fill in your values
#   apps/web/.env.local → NEXT_PUBLIC_API_URL, NEXT_PUBLIC_STELLAR_NETWORK

#    .env.example carries working testnet values (contract, vault, Blend pool).
#    In the app: Receive → fund XLM, add USDC, then "Get test USDC".

# 3. Run everything (web :3000 + api :3001)
bun run dev

#   …or individually
bun run web
bun run api          # Swagger at http://localhost:3001/api/docs
```

### Deploy the contract

```bash
cd packages/contracts
bun run deploy       # builds, deploys with the constructor; prints the contract id
```

Mainnet needs an explicit identity and confirmation, see
[packages/contracts](packages/contracts/README.md#deploy).

See [docs/mainnet.md](docs/mainnet.md) for the mainnet runbook and deployment log,
[docs/testnet.md](docs/testnet.md) for testnet details,
[docs/architecture.md](docs/architecture.md) for how the pieces fit and
[docs/security.md](docs/security.md) for the threat model and monitoring plan.

---

## Smart contract: `yield_splitter`

| Function | Description |
| --- | --- |
| `__constructor(admin, token, user_cap)` | Runs with the deploy (no front-runnable init) |
| `set_split(user, spendable_bps)` | Recipient picks their spendable % (basis points) |
| `receive(from, to, amount)` | Pay the spendable share to `to`, hold the savings for `to` |
| `send_batch(from, payments)` | Pay several family members with one signature |
| `create_schedule` · `run_schedule` · `cancel_schedule` | Recurring remittances from a one-time token allowance |
| `create_pledge` · `release_pledge` · `refund_pledge` | Conditional remittances: money earmarked for a payee such as a school |
| `deposit_savings(user, amount)` | Recipient sets aside their own USDC into savings |
| `withdraw_savings(to, amount)` | Recipient withdraws savings to their wallet |
| `pay_from_savings(user, to, amount)` | Recipient pays a school, clinic or landlord straight from savings |
| `set_user_cap` · `set_paused` · `recover_token` · `upgrade` | Admin guardrails (withdrawals are never paused) |
| `position(user)` · `config()` | Read savings + ratio, and the contract settings |

**Events:** 15 typed events for splits, remittances, savings, schedules, pledges and admin actions (see [docs/architecture.md](docs/architecture.md))
&nbsp;·&nbsp; **Tests:** `cd packages/contracts && cargo test` (74 passing, 78 with the upgrade and mainnet-budget tests via `bun run test:upgrade`)

---

## API

Base URL `http://localhost:3001/api` · interactive docs at `/api/docs`.

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/health` | Service + database status |
| `GET` | `/accounts/:address` · `/accounts/:address/payments` | Balances, trustline, history |
| `POST` | `/remittances/preview` | Preview the spendable/savings split |
| `POST` | `/remittances` | Record a remittance by tx hash (verified on-chain) |
| `GET` | `/remittances?address=` | Remittances sent or received by an address |
| `GET` | `/splits/config` · `/splits/:address` | Contract settings and a recipient's position |
| `POST` | `/splits/{ratio,receive,withdraw}/build` | Build unsigned set-split / receive / withdraw txs |
| `POST` | `/splits/submit` | Submit a signed transaction |
| `GET` | `/vault/apy` | Live vault rate (DeFindex → Blend) |
| `GET` | `/stats` | Public on-chain usage: volume, remittances, savings held |
| `POST` | `/vault/{deposit,withdraw}/build` | DeFindex deposit/withdraw by USDC amount |
| `POST` | `/anchor/sep10/*` · `/anchor/sep24/*` | SEP-10 auth + SEP-24 deposit/withdraw |

---

## Roadmap

- [x] Mainnet beta: contract, API and app live with per-person caps
- [x] Recurring remittances, batch payments and earmarked payments
- [x] DeFindex vault + Blend pool on testnet
- [ ] DeFindex vault on mainnet (shown as a preview today)
- [ ] Contract-native vault deposits (savings flow into DeFindex from the contract)
- [ ] SEP-24 cash-out with a mainnet anchor
- [ ] Multisig admin and an upgrade timelock
- [ ] Third-party security audit

---

## License

[MIT](LICENSE) © Grow

---

## 🚀 Ship It: Stellar Builder Challenge

**23–27 de noviembre de 2026 · Meta: Grow Beta en vivo en la mainnet de Stellar**

Durante este Boot Camp de una semana, llevaremos Grow de un prototipo en testnet a una beta real y funcional en mainnet. El alcance es pequeño a propósito: lanzar algo real, seguro y utilizable.

### Qué lanzamos el 27 de noviembre

- ✅ Contrato `yield_splitter` desplegado en **Stellar mainnet** ([`CCFVDG2U…MTJD`](https://stellar.expert/explorer/public/contract/CCFVDG2UZ2IJBXMHVFKVLWLJ6Z2JBTJWNXFNIA2VWACNA6IFUKKOMTJD)), con tope de 100 USDC de ahorro por persona
- ✅ App en vivo: https://grow-mainnet.vercel.app (demo: [video](https://youtu.be/HmXsgK5MCFU))
- ✅ Flujo principal de punta a punta: conectar wallet → elegir proporción → enviar USDC → ahorrar, retirar y pagar desde el ahorro
- ✅ API desplegada en mainnet, conectada al contrato y a Postgres (Supabase)
- ✅ Probado con transacciones reales desde la app: las 5 funciones principales, con sus links en [docs/mainnet.md](docs/mainnet.md#functions-used-from-the-app)
- ⏳ Vault de rendimiento (DeFindex → Blend): funciona en testnet; en mainnet se muestra como vista previa hasta verificarlo

### Plan día por día

| Día | Fecha  | Objetivo                                                           |
|-----|--------|--------------------------------------------------------------------|
| 1   | 23 nov | Definir el alcance y documentar el plan en el README               |
| 2   | 24 nov | Configuración de mainnet, USDC y topes de depósito en el contrato  |
| 3   | 25 nov | Conectar el vault de rendimiento y definir variables de entorno    |
| 4   | 26 nov | Desplegar contrato y API, hacer una transacción real de prueba     |
| 5   | 27 nov | Lanzamiento beta con usuarios, demo y push final a `main`          |

### Fuera del alcance (por ahora)

- Retiro a moneda local con SEP-24 en mainnet (próximamente)
- Auditoría de seguridad de terceros
- Vault de DeFindex en mainnet

> ⚠️ **Aviso beta:** Grow no ha sido auditado. Usa solo montos pequeños.


