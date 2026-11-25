# @raiz/api · Grow API

NestJS service between the web app and Stellar. It never holds user keys: it
builds **unsigned** transactions, the browser wallet signs them, and the API
submits the signed XDR.

## Run

```bash
# from the repo root
cp .env.example apps/api/.env      # fill in the contract id and keys
bun run api                        # http://localhost:3001/api, Swagger at /api/docs
```

## Modules

| Module | Endpoints | What it does |
| --- | --- | --- |
| `accounts` | `/accounts/:address`, `/payments`, `/fund`, `/payment/build`, `/trustline/build`, `/submit` | Balances, history (classic payments and contract transfers), XLM/USDC payments, USDC trustline, friendbot on testnet |
| `splits` | `/splits/config`, `/splits/:address`, `/ratio/build`, `/receive/build`, `/withdraw/build`, `/submit` | `yield_splitter` reads and transactions |
| `remittances` | `/remittances/preview`, `POST /remittances {txHash}`, `GET /remittances?address=` | Off-chain timeline. A remittance is stored only after its `receive` tx is verified on-chain |
| `vault` | `/vault/apy`, `/vault/position/:address`, `/vault/deposit/build`, `/vault/withdraw/build` | DeFindex vault (Blend strategy). Amounts are USDC, never shares |
| `keeper` | (background) | Runs due recurring remittances every `KEEPER_INTERVAL_SECS`, signing as a fee-only account; status in `/api/health` |
| `anchor` | `/anchor/info`, `/anchor/sep10/*`, `/anchor/sep24/*` | SEP-10 auth and SEP-24 deposit/withdraw proxy |

Contract and token errors from simulation come back as `400` with a readable
message (`src/stellar/contract-errors.ts`). A Soroban submit that fails
on-chain is a `400`; one still pending after ~30s returns `status: NOT_FOUND`.

## Tests

```bash
bun run test        # unit
bun run test:e2e    # boots the app with in-memory storage
```

## Deploy

`railway.json` at the repo root builds `@raiz/shared` and this app, then runs
`node apps/api/dist/main.js`. Set the same variables as `.env.example`.
