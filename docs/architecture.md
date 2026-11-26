# Grow architecture

Grow is a remittance app on Stellar with built-in savings. A sender pays USDC
through a Soroban contract that splits it by the recipient's own ratio: the
spendable part lands in the recipient's wallet, the rest is saved for them
on-chain and only they can move it. Senders can also pay several people at
once, schedule recurring remittances, and earmark money for a specific payee.

```
 Browser (Next.js static export)                    Stellar
 ┌────────────────────────────────┐                ┌──────────────────────────────┐
 │ wallet (Stellar Wallets Kit)   │── signs XDR ──▶│ Soroban: yield_splitter       │
 │ pages: send, receive, vault,   │                │   remittances, batch,         │
 │   earmarked, activity,         │                │   schedules, pledges, savings │
 │   settings, /stats             │                │ USDC Stellar Asset Contract   │
 └──────────────┬─────────────────┘                │ DeFindex vault + Blend pool   │
                │ JSON (unsigned XDR in/out)        │ Horizon (classic payments)    │
 ┌──────────────▼─────────────────┐                └──────────────┬───────────────┘
 │ API (NestJS)                   │◀── RPC / Horizon ─────────────┘
 │ stellar/  SorobanService,      │
 │           HorizonService       │── SEP-1/10/24 anchor
 │ accounts/ splits/ vault/       │── Postgres (Supabase), optional
 │ remittances/ stats/ anchor/    │
 │ keeper/ (runs due schedules)   │
 └────────────────────────────────┘
```

## Principles

- **Keys never leave the user.** The API only builds unsigned transactions;
  the browser wallet signs and the API submits the signed XDR.
- **The chain is the source of truth.** Balances, savings and the split are
  read from the contract and Horizon. The database only keeps an index
  (remittances verified on-chain, contract events) and can be rebuilt.
- **Minimal custody.** The contract never holds the spendable part. It holds
  savings per recipient and open pledges, both capped per person during the
  beta, and moves savings only on their owner's signature.
- **Network-driven.** Testnet and mainnet differ only in environment
  variables (`.env.example`); mixing them fails at boot or build.

## Components

### Contract: `packages/contracts/contracts/yield_splitter`

| Module | Responsibility |
| --- | --- |
| `lib.rs` | Entry points, limits and the pure `split_amount` |
| `remit.rs` | The one place a remittance moves money: split, cap, transfers, `FundsReceived` |
| `storage.rs` | Keys, TTL rules and every state read/write |
| `events.rs` | 15 events: splits, remittances, savings in/out, schedules, pledges, admin actions (`user_cap_set`, `paused_set`, `token_recovered`, `upgraded`) |
| `errors.rs` / `types.rs` | Error codes; `Payment` (input), `Schedule`, `Pledge`, `Position`, `Config` |

Flows:

1. `receive(from, to, amount)` and `send_batch(from, payments)` (up to 10):
   sender-signed. Each payment is split by its recipient's ratio; the savings
   part is clamped to the recipient's room under the cap and the rest goes to
   their wallet.
2. `create_schedule` / `run_schedule` / `cancel_schedule`: recurring
   remittances pulled from the sender's token allowance. Anyone (the API's
   keeper) can run a due schedule; the terms were signed at creation.
   Interval 1 minute to 92 days, last run at most 170 days after the first.
3. `create_pledge` / `release_pledge` / `refund_pledge`: earmarked money the
   beneficiary pays to a fixed payee within 100 days, or the sender takes
   back after expiry.
4. `deposit_savings`, `withdraw_savings`, `pay_from_savings`: the recipient's
   own top-up, withdrawal and payment straight from savings.
5. Admin: `set_user_cap`, `set_paused` (never blocks exits), `recover_token`
   (never the USDC), `upgrade` (code swap, same id and storage).

### API: `apps/api`

| Module | Responsibility |
| --- | --- |
| `stellar/` | Network clients (`SorobanService`, `HorizonService`) and pure helpers: ScVal args, memo truncation, contract error messages |
| `accounts/` | Balances, the activity feed (classic payments and contract transfers), classic payments, trustline, friendbot |
| `splits/` | Contract reads and unsigned transactions for every user-facing function; the schedule allowance covers all of a sender's open schedules |
| `remittances/` | Off-chain timeline; a remittance is stored only after its transaction is verified on-chain |
| `stats/` | Event indexer (RPC `getEvents` with a persisted cursor) and `GET /api/stats` |
| `vault/` | DeFindex vault deposit/withdraw by USDC amount (direct contract calls), Blend rate |
| `keeper/` | Runs due recurring remittances with a fee-only key |
| `anchor/` | SEP-10/SEP-24 proxy to the configured anchor |
| `config/` | Typed config with per-network defaults and the mixed-network guard |

### Web: `apps/web`

- `lib/api/`: one client module per API domain.
- `lib/hooks/`: data hooks per domain and `useLookup` for input-driven
  queries that must ignore stale responses.
- `lib/anchor.ts`: SEP-10 challenge validation and the SEP-24 flow.
- `components/ui/`: form primitives (`Segmented`, `AmountInput`, fields).
- `components/app/`: domain components (`SavingsCard`, `VaultManage`,
  `TxStatus`, `AnchorPanel`, explorer links).

### Shared: `packages/shared`

Types, validation (`STELLAR_ADDRESS_REGEX`, `AMOUNT_REGEX`), amount math in
stroops and design tokens, used by both the API and the web.

## Data

Postgres tables (created on boot, see `apps/api/src/database/schema.sql`):

- `remittances`: verified remittances, unique by `tx_hash`.
- `contract_events`: indexed contract events, unique by RPC event id.
- `sync_cursors`: the indexer's RPC cursor per contract.

## Deployment

- Web: static export on Vercel (`grow` for testnet, `grow-mainnet` for
  mainnet), both building `main`.
- API: Node 22.12+ on Railway (Railpack; see `railway.json`).
- Procedure and record: [mainnet.md](mainnet.md).
- Contract: `bun run deploy` in `packages/contracts`, constructor runs in the
  deploy transaction. Mainnet requires an explicit identity and
  `CONFIRM_MAINNET=yes`.

See [security.md](security.md) for the threat model and monitoring plan.
