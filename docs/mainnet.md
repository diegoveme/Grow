# Mainnet runbook

How Grow goes live on Stellar mainnet and how it is operated afterwards. The
plan and the go/no-go checklist live in [`MAINNET_PLAN.md`](../MAINNET_PLAN.md);
this file is the procedure and the record.

## What runs where

| Piece | Testnet (demo) | Mainnet (beta) |
|---|---|---|
| Web (static Next.js export) | Vercel project `grow`, auto-deploys `main` | Vercel project `grow-mainnet`, auto-deploys `main` |
| API (NestJS on Node 24) | Railway project `grow`, environment `production` | Railway project `grow`, environment `mainnet` |
| Contract `yield_splitter` | `CBEQUA2ET4XTZAMDB3ZOB6MUOA2B6ACZ6TV2GCDHFTETKBVG7TMBZCYA` | see the deployment log below |
| USDC | `USDC:GATALTG…` (SAC `CAQCFV…`) | Circle `USDC:GA5ZSEJ…KZVN` (SAC `CCW67TSZ…MI75`) |
| Soroban RPC | `soroban-testnet.stellar.org` | a provider (SDF runs no public mainnet RPC) |
| Database | none (in-memory) | Postgres (Supabase) so `/stats` keeps its history |

Both web projects build the same commit; only environment variables differ.
The API refuses to boot and the web build fails if a variable belongs to the
other network (`apps/api/src/config/network.ts`, `apps/web/src/lib/config.ts`).

## 1. Keys

Generate with the Stellar CLI; they stay in the local keychain, never in the
repo or in CI.

```bash
stellar keys generate grow-mainnet-admin    # contract admin (pause, cap, upgrade)
stellar keys generate grow-mainnet-keeper   # pays fees for recurring runs only
stellar keys address grow-mainnet-admin     # fund from an exchange
```

The contract has no admin-rotation function, so the admin should be a
dedicated classic account: signers and thresholds can be added later
(multisig) without touching the contract.

## 2. Build, upload, deploy

```bash
stellar network add grow-mainnet --rpc-url <PROVIDER_URL> \
  --network-passphrase "Public Global Stellar Network ; September 2015"

cd packages/contracts && stellar contract build
sha256sum target/wasm32v1-none/release/yield_splitter.wasm

stellar contract upload --network grow-mainnet --source grow-mainnet-admin \
  --wasm target/wasm32v1-none/release/yield_splitter.wasm          # -> WASM hash

# The constructor runs in the same transaction: nobody can initialise first.
stellar contract deploy --network grow-mainnet --source grow-mainnet-admin \
  --wasm-hash <HASH> -- \
  --admin <G_ADMIN> \
  --token CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75 \
  --user_cap 1000000000                                              # 100 USDC

stellar contract invoke --network grow-mainnet --source grow-mainnet-admin \
  --id <CONTRACT_ID> -- config                                       # verify
```

## 3. Configure the services

API (Railway environment `mainnet`):

| Variable | Value |
|---|---|
| `STELLAR_NETWORK` | `PUBLIC` |
| `SOROBAN_RPC_URL` | provider URL (required) |
| `YIELD_SPLITTER_CONTRACT_ID` | the contract id (required) |
| `CORS_ORIGIN` | the `grow-mainnet` Vercel URL |
| `KEEPER_SECRET` | secret of `grow-mainnet-keeper` |
| `STATS_START_LEDGER` | the deploy ledger |
| `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_NAME` | Supabase **session pooler** (`aws-1-<region>.pooler.supabase.com`, `5432`, `postgres.<project-ref>`, `postgres`) |
| `DATABASE_PASSWORD` | the Supabase database password, set with `--stdin` |
| `PORT` | `3001` (the domain targets it) |
| `RAILPACK_BUILD_CMD`, `RAILPACK_START_CMD`, `RAILPACK_NODE_VERSION` | same as testnet |

Use the session pooler, not the direct host: `db.<ref>.supabase.co` only
resolves over IPv6 and the Railway service has no IPv6 egress. Create the
Supabase project with the Data API off; the API enables RLS on its tables
anyway and creates them on boot, so no Supabase CLI or migration step is
needed. Only mainnet gets a database, so testnet data never mixes in.

Horizon, the passphrase and Circle USDC default from `STELLAR_NETWORK`. Leave
`DEFINDEX_VAULT_ADDRESS` and `BLEND_POOL_ID` empty until the vault is verified
on-chain (asset `CCW67…`, Blend USDC strategy); the app then shows the vault
as a preview.

Web (Vercel project `grow-mainnet`): `NEXT_PUBLIC_STELLAR_NETWORK=PUBLIC`,
`NEXT_PUBLIC_API_URL=<Railway mainnet URL>`. Mark them as `config` (public).

Railway deploys from the CLI with `railway up`. Run it from a Linux
filesystem path: uploading from a Windows drive mounted in WSL (`/mnt/c`) has
produced files full of NUL bytes.

## 4. Smoke test from the app

With a real wallet and small amounts: choose a split, send 1 USDC to a second
wallet, withdraw savings, earmark a payment and take it back, check `/stats`.
For testnet the same flows are automated:

```bash
cd apps/api && API_URL=<testnet API> bun scripts/testnet-regression.ts
```

## Deployment log

| Date | Network | Contract id | WASM sha256 | Commit | Deploy ledger | Admin (public key) |
|---|---|---|---|---|---|---|
| 2026-11-24 | testnet | `CBEQUA2ET4XTZAMDB3ZOB6MUOA2B6ACZ6TV2GCDHFTETKBVG7TMBZCYA` | | | before 5911500 (stats start) | `grow-testnet-admin` |
| 2026-11-26 | testnet (upgrade) | same | `700613bff894518bc9321dfb2bf25500f1978cd4f991667f1e42baba33de9be6` | `533c46b` (review fixes) | tx `e2e036f3…` | `grow-testnet-admin` |
| | mainnet | | | | | |

The mainnet upload must produce the same WASM hash as the last testnet
upgrade (`stellar contract build` from the same commit and toolchain). If it
differs, the code or the toolchain changed: run the testnet regression on the
new build first.

## Operating the contract

- **Pause** (`set_paused true`): stops new remittances, batches, schedules,
  pledges and deposits. Withdrawing savings, paying from savings and
  releasing or refunding pledges keep working, so nobody is locked in.
- **Savings cap** (`set_user_cap`): per-person ceiling on savings held.
- **Upgrade** (`upgrade <wasm_hash>`): admin only; keeps the contract id and
  storage. Upload the new WASM first and record it in the log.
- **Recover a stray token** (`recover_token`): refuses the configured USDC.
- **TTL**: every call extends the instance to 30 days and each user's entries
  to 120 days. If the contract may sit idle for weeks, extend it by hand:
  `stellar contract extend --network grow-mainnet --source grow-mainnet-admin --id <CONTRACT_ID> --durability persistent --ledgers-to-extend 535679`
  (instance) and check `/api/health` stays green.
- **Keeper**: watch its XLM balance (`/api/health` shows the account). It only
  pays fees and cannot move anyone's money.

## If something goes wrong

1. Pause the contract (admin). Exits stay open.
2. Turn the keeper off (`KEEPER_ENABLED=false` on Railway).
3. Investigate with the contract events (`/api/stats`, StellarView).
4. Fix, upload a new WASM, `upgrade`, unpause, and log it above.
