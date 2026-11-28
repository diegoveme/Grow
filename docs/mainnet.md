# Mainnet runbook

How Grow goes live on Stellar mainnet and how it is operated afterwards. The
plan and the go/no-go checklist live in [`MAINNET_PLAN.md`](../MAINNET_PLAN.md);
this file is the procedure and the record.

## What runs where

| Piece | Testnet (demo) | Mainnet (beta) |
|---|---|---|
| Web (static Next.js export) | Vercel project `grow`, auto-deploys `main` | Vercel project `grow-mainnet`, auto-deploys `main` |
| API (NestJS on Node 24) | Railway project `grow`, environment `production` | Railway project `grow`, environment `mainnet` |
| Contract `yield_splitter` | `CBEQUA2ET4XTZAMDB3ZOB6MUOA2B6ACZ6TV2GCDHFTETKBVG7TMBZCYA` | `CCFVDG2UZ2IJBXMHVFKVLWLJ6Z2JBTJWNXFNIA2VWACNA6IFUKKOMTJD` |
| USDC | `USDC:GATALTG…` (SAC `CAQCFV…`) | Circle `USDC:GA5ZSEJ…KZVN` (SAC `CCW67TSZ…MI75`) |
| Soroban RPC | `soroban-testnet.stellar.org` | Gateway.fm `soroban-rpc.mainnet.stellar.gateway.fm` (backup `mainnet.sorobanrpc.com`) |
| Database | none (in-memory) | Postgres (Supabase, session pooler) so `/stats` keeps its history |
| URLs | https://grow-green-one.vercel.app, API https://grow-api-production-683533a7.up.railway.app | https://grow-mainnet.vercel.app, API https://grow-api-mainnet.up.railway.app |

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

Costs seen on 2026-11-27: the upload took about 23.2 XLM (rent for the
code entry; the simulation asked for up to 26.7), the deploy 0.06 XLM. Fund
the admin with 40 XLM or more and keep enough for a future `upgrade`, which
needs another upload. If a submission fails with `TxInsufficientFee`, the
network is charging more than the CLI default of 100 stroops: add
`--inclusion-fee 1000`.

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

A new Railway environment starts without the service: `railway up` then
answers 404. Create it with `--duplicate production`, or commit a patch that
adds the service (`environmentPatchCommit` in the Railway API) before the
first deploy.

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
| 2026-11-27 | mainnet | `CCFVDG2UZ2IJBXMHVFKVLWLJ6Z2JBTJWNXFNIA2VWACNA6IFUKKOMTJD` | `700613bff894518bc9321dfb2bf25500f1978cd4f991667f1e42baba33de9be6` | `533c46b` (contract source) | 65704158 (upload tx `5039b142…`, deploy tx `cc361a44…`) | `GC56UTMYTCWM5RLB7S2F6XY76RC5JNWOA7JEMK2C2AQXHX2ZW33LT3IH` (`grow-mainnet-admin`) |

The mainnet upload must produce the same WASM hash as the last testnet
upgrade (`stellar contract build` from the same commit and toolchain). If it
differs, the code or the toolchain changed: run the testnet regression on the
new build first.

## Functions used from the app

Mainnet contract: [`CCFVDG2UZ2IJBXMHVFKVLWLJ6Z2JBTJWNXFNIA2VWACNA6IFUKKOMTJD`](https://stellar.expert/explorer/public/contract/CCFVDG2UZ2IJBXMHVFKVLWLJ6Z2JBTJWNXFNIA2VWACNA6IFUKKOMTJD)
(app: https://grow-mainnet.vercel.app).

Every write follows the same path. The screen calls the API client
([`lib/api/splits.ts:13`](https://github.com/diegoveme/Grow/blob/f285539/apps/web/src/lib/api/splits.ts#L13)), the API builds and simulates the unsigned transaction
([`soroban.service.ts:87`](https://github.com/diegoveme/Grow/blob/f285539/apps/api/src/stellar/soroban.service.ts#L87)), the user's wallet signs it in the browser
([`use-tx.ts:37`](https://github.com/diegoveme/Grow/blob/f285539/apps/web/src/lib/use-tx.ts#L37)) and the API submits the signed XDR (`POST /splits/submit`).
No key ever reaches the server.

### The five invoked on mainnet

#### 1. `set_split(user, spendable_bps)`

The recipient chooses how much of every USDC remittance lands in their wallet and how much is saved for them. Stored on-chain, so senders cannot change it.

- Screen: **Ajustes** → "Disponible vs. ahorro" → **Guardar reparto on-chain**
- Frontend call: [`page.tsx:44`](https://github.com/diegoveme/Grow/blob/f285539/apps/web/src/app/app/settings/page.tsx#L44)
- API: `POST /splits/ratio/build`, [`splits.service.ts:128`](https://github.com/diegoveme/Grow/blob/f285539/apps/api/src/splits/splits.service.ts#L128)
- Contract: [`lib.rs:137`](https://github.com/diegoveme/Grow/blob/f285539/packages/contracts/contracts/yield_splitter/src/lib.rs#L137)
- Mainnet tx (from the app): [`56918035…`](https://stellar.expert/explorer/public/tx/569180356e0b34950fb18e585a2282f3d14605db2fe5957b16b1caad296ee6ce)

#### 2. `receive(from, to, amount)`

A remittance. Pulls USDC from the sender and splits it by the recipient's ratio: the spendable part goes to their wallet, the rest stays in the contract as their savings (clamped to the beta cap; any excess goes to the wallet).

- Screen: **Enviar** → **Una persona**, asset USDC
- Frontend call: [`single-send.tsx:73`](https://github.com/diegoveme/Grow/blob/f285539/apps/web/src/components/send/single-send.tsx#L73)
- API: `POST /splits/receive/build`, [`splits.service.ts:135`](https://github.com/diegoveme/Grow/blob/f285539/apps/api/src/splits/splits.service.ts#L135)
- Contract: [`lib.rs:161`](https://github.com/diegoveme/Grow/blob/f285539/packages/contracts/contracts/yield_splitter/src/lib.rs#L161)
- Mainnet tx (from the app): [`bb8ae03e…`](https://stellar.expert/explorer/public/tx/bb8ae03e1321942b3cd376373e4ba39e58a55550d6e6847acee7249974ad2c48)

#### 3. `deposit_savings(user, amount)`

The user moves USDC from their own wallet into their Grow savings.

- Screen: **Inicio** → card "Ahorro en Grow" → **Apartar**
- Frontend call: [`savings-card.tsx:46`](https://github.com/diegoveme/Grow/blob/f285539/apps/web/src/components/app/savings-card.tsx#L46)
- API: `POST /splits/deposit/build`, [`splits.service.ts:143`](https://github.com/diegoveme/Grow/blob/f285539/apps/api/src/splits/splits.service.ts#L143)
- Contract: [`lib.rs:428`](https://github.com/diegoveme/Grow/blob/f285539/packages/contracts/contracts/yield_splitter/src/lib.rs#L428)
- Mainnet tx (from the app): [`c7f030be…`](https://stellar.expert/explorer/public/tx/c7f030bee1ae93e86afe2bef6e62cafc5297e0d5d986180f15b1214f1261fd57)

#### 4. `withdraw_savings(to, amount)`

The owner takes savings back to their wallet. Only they can sign it, and it keeps working while the contract is paused.

- Screen: **Inicio** → card "Ahorro en Grow" → **Retirar** (also the **Vault** page, [`vault-manage.tsx:39`](https://github.com/diegoveme/Grow/blob/f285539/apps/web/src/components/app/vault-manage.tsx#L39))
- Frontend call: [`savings-card.tsx:48`](https://github.com/diegoveme/Grow/blob/f285539/apps/web/src/components/app/savings-card.tsx#L48)
- API: `POST /splits/withdraw/build`, [`splits.service.ts:158`](https://github.com/diegoveme/Grow/blob/f285539/apps/api/src/splits/splits.service.ts#L158)
- Contract: [`lib.rs:460`](https://github.com/diegoveme/Grow/blob/f285539/packages/contracts/contracts/yield_splitter/src/lib.rs#L460)
- Mainnet tx (from the app): [`b42ae4bb…`](https://stellar.expert/explorer/public/tx/b42ae4bb698b1a686c8f6997bddb9870a7d161c0998d74926f64e638c4c7cefd)

#### 5. `pay_from_savings(user, to, amount)`

Pays a bill (school, clinic, landlord) straight from savings, without passing through the wallet first.

- Screen: **Inicio** → card "Ahorro en Grow" → **Pagar**
- Frontend call: [`savings-card.tsx:49`](https://github.com/diegoveme/Grow/blob/f285539/apps/web/src/components/app/savings-card.tsx#L49)
- API: `POST /splits/pay/build`, [`splits.service.ts:150`](https://github.com/diegoveme/Grow/blob/f285539/apps/api/src/splits/splits.service.ts#L150)
- Contract: [`lib.rs:487`](https://github.com/diegoveme/Grow/blob/f285539/packages/contracts/contracts/yield_splitter/src/lib.rs#L487)
- Mainnet tx (from the app): [`64e95678…`](https://stellar.expert/explorer/public/tx/64e95678bb0e1fb7af12dd32e2e81b8c27417e1bb744738a21a3a333b98d21f7)

### Also wired in the app

| Function | Screen | Frontend call | API | Contract |
|---|---|---|---|---|
| `send_batch` | **Enviar** → **Varias personas** (up to 10 people, each split by their own ratio) | [`batch-send.tsx:50`](https://github.com/diegoveme/Grow/blob/f285539/apps/web/src/components/send/batch-send.tsx#L50) | [`splits.service.ts:169`](https://github.com/diegoveme/Grow/blob/f285539/apps/api/src/splits/splits.service.ts#L169) | [`lib.rs:174`](https://github.com/diegoveme/Grow/blob/f285539/packages/contracts/contracts/yield_splitter/src/lib.rs#L174) |
| `create_schedule` | **Enviar** → **Recurrente** (after a USDC `approve`, [`recurring-send.tsx:64`](https://github.com/diegoveme/Grow/blob/f285539/apps/web/src/components/send/recurring-send.tsx#L64)) | [`recurring-send.tsx:70`](https://github.com/diegoveme/Grow/blob/f285539/apps/web/src/components/send/recurring-send.tsx#L70) | [`splits.service.ts:232`](https://github.com/diegoveme/Grow/blob/f285539/apps/api/src/splits/splits.service.ts#L232) | [`lib.rs:202`](https://github.com/diegoveme/Grow/blob/f285539/packages/contracts/contracts/yield_splitter/src/lib.rs#L202) |
| `run_schedule` | **Enviar** → **Recurrente** → **Enviar ya**; otherwise the API keeper runs it | [`recurring-send.tsx:78`](https://github.com/diegoveme/Grow/blob/f285539/apps/web/src/components/send/recurring-send.tsx#L78) | [`splits.service.ts:243`](https://github.com/diegoveme/Grow/blob/f285539/apps/api/src/splits/splits.service.ts#L243) | [`lib.rs:257`](https://github.com/diegoveme/Grow/blob/f285539/packages/contracts/contracts/yield_splitter/src/lib.rs#L257) |
| `cancel_schedule` | **Enviar** → **Recurrente**, list of open schedules | [`recurring-send.tsx:89`](https://github.com/diegoveme/Grow/blob/f285539/apps/web/src/components/send/recurring-send.tsx#L89) | [`splits.service.ts:247`](https://github.com/diegoveme/Grow/blob/f285539/apps/api/src/splits/splits.service.ts#L247) | [`lib.rs:295`](https://github.com/diegoveme/Grow/blob/f285539/packages/contracts/contracts/yield_splitter/src/lib.rs#L295) |
| `create_pledge` | **Apartados** (earmark money for a fixed payee) | [`page.tsx:52`](https://github.com/diegoveme/Grow/blob/f285539/apps/web/src/app/app/pledges/page.tsx#L52) | [`splits.service.ts:277`](https://github.com/diegoveme/Grow/blob/f285539/apps/api/src/splits/splits.service.ts#L277) | [`lib.rs:311`](https://github.com/diegoveme/Grow/blob/f285539/packages/contracts/contracts/yield_splitter/src/lib.rs#L311) |
| `release_pledge / refund_pledge` | **Apartados**, the beneficiary pays the payee or the sender takes it back after expiry | [`page.tsx:65`](https://github.com/diegoveme/Grow/blob/f285539/apps/web/src/app/app/pledges/page.tsx#L65) | [`splits.service.ts:288`](https://github.com/diegoveme/Grow/blob/f285539/apps/api/src/splits/splits.service.ts#L288) / [`splits.service.ts:293`](https://github.com/diegoveme/Grow/blob/f285539/apps/api/src/splits/splits.service.ts#L293) | [`lib.rs:367`](https://github.com/diegoveme/Grow/blob/f285539/packages/contracts/contracts/yield_splitter/src/lib.rs#L367) / [`lib.rs:392`](https://github.com/diegoveme/Grow/blob/f285539/packages/contracts/contracts/yield_splitter/src/lib.rs#L392) |

Not called from the app: the admin functions `set_user_cap`, `set_paused`,
`upgrade` and `recover_token` (signed by `grow-mainnet-admin` from the CLI,
see below). The read-only views `get_split`, `savings`, `position`, `config`,
`pledge` and `schedule` back the API's GET endpoints.

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
