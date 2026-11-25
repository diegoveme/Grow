# Grow architecture

Grow is a remittance app on Stellar with built-in savings. A sender pays USDC
through a Soroban contract that splits it by the recipient's own ratio: the
spendable part lands in the recipient's wallet, the rest is saved for them
on-chain and only they can withdraw it.

```
 Browser (Next.js static export)                    Stellar
 ┌────────────────────────────────┐                ┌──────────────────────────────┐
 │ wallet (Stellar Wallets Kit)   │── signs XDR ──▶│ Soroban: yield_splitter       │
 │ pages: send, savings, vault,   │                │   receive / deposit_savings / │
 │   activity, settings, /stats   │                │   withdraw_savings / set_split│
 └──────────────┬─────────────────┘                │ USDC Stellar Asset Contract   │
                │ JSON (unsigned XDR in/out)        │ Horizon (classic payments)    │
 ┌──────────────▼─────────────────┐                └──────────────┬───────────────┘
 │ API (NestJS)                   │◀── RPC / Horizon ─────────────┘
 │ stellar/  SorobanService,      │
 │           HorizonService       │── DeFindex API (vault txs, APY)
 │ accounts/ splits/ vault/       │── SEP-1/10/24 anchor
 │ remittances/ stats/ anchor/    │── Postgres (Supabase), optional
 └────────────────────────────────┘
```

## Principles

- **Keys never leave the user.** The API only builds unsigned transactions;
  the browser wallet signs and the API submits the signed XDR.
- **The chain is the source of truth.** Balances, savings and the split are
  read from the contract and Horizon. The database only keeps an index
  (remittances verified on-chain, contract events) and can be rebuilt.
- **Minimal custody.** The contract never holds the spendable part. It holds
  savings per recipient, capped per recipient during the beta, and moves them
  only back to their owner.
- **Network-driven.** Testnet and mainnet differ only in environment
  variables (`.env.example`).

## Components

### Contract: `packages/contracts/contracts/yield_splitter`

| Module | Responsibility |
| --- | --- |
| `lib.rs` | Entry points and the pure `split_amount` |
| `storage.rs` | Keys, TTL rules and every state read/write |
| `events.rs` | `SplitSet`, `FundsReceived`, `SavingsDeposited`, `SavingsWithdrawn`, `UserCapSet`, `PausedSet` |
| `errors.rs` / `types.rs` | Error codes, `Position` and `Config` views |

Flows:

1. `receive(from, to, amount)`: sender-signed. Reads `to`'s split, checks the
   pause switch and the savings cap, transfers the spendable part straight to
   `to` and the savings part to the contract.
2. `deposit_savings(user, amount)` / `withdraw_savings(to, amount)`:
   recipient-signed top-up and withdrawal.
3. Admin: `set_user_cap`, `set_paused` (never blocks withdrawals),
   `upgrade` (code swap, same id and storage).

### API: `apps/api`

| Module | Responsibility |
| --- | --- |
| `stellar/` | Network clients (`SorobanService`, `HorizonService`) and pure helpers: ScVal args, memo truncation, contract error messages |
| `accounts/` | Balances, the activity feed (classic payments and contract transfers), classic payments, trustline, friendbot |
| `splits/` | Contract reads and unsigned transactions for every user-facing function |
| `remittances/` | Off-chain timeline; a remittance is stored only after its `receive` tx is verified on-chain |
| `stats/` | Event indexer (RPC `getEvents` with a persisted cursor) and `GET /api/stats` |
| `vault/` | DeFindex vault deposit/withdraw by USDC amount, rate |
| `anchor/` | SEP-10/SEP-24 proxy to the configured anchor |

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

- `remittances`: verified `receive` calls, unique by `tx_hash`.
- `contract_events`: indexed contract events, unique by RPC event id.
- `sync_cursors`: the indexer's RPC cursor per contract.

## Deployment

- Web: static export, any static host (Vercel today).
- API: Node 22.12+ (Railway, `railway.json`).
- Contract: `bun run deploy` in `packages/contracts`, constructor runs in the
  deploy transaction. Mainnet requires an explicit identity and
  `CONFIRM_MAINNET=yes`.

See [security.md](security.md) for the threat model and monitoring plan.
