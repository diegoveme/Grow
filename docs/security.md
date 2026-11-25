# Grow threat model and monitoring plan

Scope: the `yield_splitter` contract, the Grow API and the web app, for the
mainnet beta. Grow is **not audited yet**; the beta limits exposure with a
per-recipient savings cap.

## Assets

| Asset | Where it lives | Worst case |
| --- | --- | --- |
| Recipients' savings | USDC balance of the contract | Theft or permanent lock |
| Contract admin key | Stellar account set at deploy | Pause, cap change, malicious upgrade |
| Users' wallet keys | User's wallet only | Out of Grow's reach by design |
| DeFindex API key, DB credentials | API environment | Abuse of the vault API, data tampering |
| Remittance and event index | Postgres | Wrong history or stats (chain stays correct) |

## Threats and mitigations

### Contract

| Threat | Mitigation | Status |
| --- | --- | --- |
| Someone drains or moves another user's savings | Every outflow is `require_auth` by the owner; savings only go back to `to`; tests cover isolation between users | Done |
| Front-running initialization after deploy | `__constructor` runs in the deploy transaction | Done |
| Large loss before an audit | Per-recipient `user_cap`; `set_paused` stops new deposits, never withdrawals | Done |
| Storage archived, funds unreachable | TTL extended on every write; emptied savings removed | Done |
| Compromised admin key upgrades to malicious code | Admin is a single key today | **Open:** move admin to a multisig account and add a timelock to `upgrade` before raising the cap |
| Rounding or overflow in the split | `split_amount` floors spendable, savings takes the remainder; `overflow-checks = true` in release | Done |
| Token behaves unexpectedly | Token fixed at deploy (Circle USDC SAC on mainnet) | Done |

### API

| Threat | Mitigation | Status |
| --- | --- | --- |
| API builds a transaction the user did not intend | The wallet shows what it signs; the API never holds keys | By design |
| Fake remittances or history | `POST /remittances` accepts only a tx hash and verifies a successful `receive` on our contract | Done |
| Malformed input causing 500s or odd math | DTO validation, `StellarAddressPipe`, strict `AMOUNT_REGEX`, `toStroops` rejects bad input | Done |
| Keeper key leaks | It only signs `run_schedule`, which needs no sender signature and follows the terms each sender signed; the key holds just XLM for fees, so a leak can at worst spend those fees | By design |
| Abuse of build endpoints (RPC cost, DeFindex quota) | Per-IP rate limit on transaction-building routes | Done (in-memory; move to a shared store if the API scales out) |
| Secret leakage | Secrets only in host env vars; `.env*` ignored by git | Done |
| CORS misuse | `CORS_ORIGIN` set to the web origin | Done |

### Web

| Threat | Mitigation | Status |
| --- | --- | --- |
| Signing a malicious SEP-10 challenge | `assertValidChallenge` checks network, signing key, sequence 0, time bounds and the `<domain> auth` op | Done |
| Tab-nabbing from the anchor popup | `opener` cleared; https-only anchor URLs | Done |
| Reporting a failed transaction as sent | `useTx` only reports success on `SUCCESS` | Done |

## Monitoring plan

| Signal | Source | Alert when |
| --- | --- | --- |
| API health | `GET /api/health` (uptime checker every minute) | 2 failures in a row |
| Indexer freshness | `syncedLedger` in `GET /api/stats` vs. latest ledger | More than 10 minutes behind |
| Contract custody vs. books | `savingsHeld` (token balance) vs. savings from events | Any mismatch |
| Unusual outflows | `savings_withdrawn` events | A single withdrawal above the cap, or many within minutes |
| Admin actions | `user_cap_set`, `paused_set` events and contract code changes | Any, outside a planned change |
| Keeper | `keeper` in `GET /api/health` (`lastTickAt`, `lastFailed`) and its XLM balance | No tick in 5 minutes, repeated failures, or under 20 XLM |
| Failed submissions | API logs (`simulate … failed`, `failed on-chain`) | Error rate above 5% over 15 minutes |
| Dependency health | Soroban RPC, Horizon, DeFindex API status | Errors from any of them for 5 minutes |

## Incident response

1. `set_paused(true)` from the admin account: stops new deposits; users can
   still withdraw.
2. Lower `user_cap` if the issue is exposure-related.
3. If the contract code is at fault: fix, test (`cargo test`,
   `bun run test:upgrade`), then `upgrade` to the fixed wasm.
4. Tell users in-app and on the project channels; publish a post-mortem.

## Before raising the cap

- Third-party audit (SCF Audit Bank).
- Admin on a multisig account, timelock on `upgrade`.
- Monitoring above wired to alerts.
