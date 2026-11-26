# Grow threat model and monitoring plan

Scope: the `yield_splitter` contract, the Grow API and the web app, for the
mainnet beta. Grow is **not audited yet**; see the risk acceptance below for
what limits exposure until it is.

## Assets

| Asset | Where it lives | Worst case |
| --- | --- | --- |
| Recipients' savings | USDC balance of the contract | Theft or permanent lock |
| Open pledges (earmarked payments) | USDC balance of the contract | Theft or permanent lock |
| Senders' schedule allowances | SEP-41 allowance from the sender to the contract | Pulled by malicious code (only via a malicious upgrade) |
| Contract admin key | Stellar account set at deploy | Pause, cap change, malicious upgrade (which reaches all of the above) |
| Keeper key | API environment | Spends its own XLM on fees; cannot move user funds |
| Users' wallet keys | User's wallet only | Out of Grow's reach by design |
| DB credentials | API environment | Data tampering in the index (chain stays correct) |
| Remittance and event index | Postgres | Wrong history or stats (chain stays correct) |

## Threats and mitigations

### Contract

| Threat | Mitigation | Status |
| --- | --- | --- |
| Someone drains or moves another user's savings | Every outflow needs the owner's `require_auth`: savings go back to the owner (`withdraw_savings`) or to whoever the owner pays (`pay_from_savings`); tests cover isolation between users | Done |
| Pledge funds taken by the wrong party | Only the beneficiary can release (to the fixed payee, until expiry); only the sender can refund (after expiry) | Done |
| Funds stranded at the contract's own address | The contract is rejected as recipient, payee or beneficiary (`InvalidRecipient`) | Done |
| Front-running initialization after deploy | `__constructor` runs in the deploy transaction | Done |
| Large loss before an audit | Per-person `user_cap`: savings above it go to the recipient's wallet, and open pledges per beneficiary are capped at it; `set_paused` stops new money in, never exits | Done |
| One full recipient blocks remittances or a whole batch | The savings part is clamped to the cap's room, the rest goes to the wallet | Done |
| Schedules starving each other's allowance | SEP-41 `approve` replaces the allowance, so the API approves what all the sender's open schedules still need | Done (API) |
| Storage archived, funds unreachable | TTL extended on every write (instance 30 days, user entries 120 days); pledges can stay open at most 100 days and schedule intervals at most 92 days, both inside the TTL; archived persistent entries are restorable, never lost | Done; idle savings older than 120 days need a restore before withdrawal |
| Compromised admin key upgrades to malicious code | Single admin today; every upgrade emits `upgraded`; admin is a dedicated classic account so signers can be added | **Open:** multisig signers and a timelock on `upgrade` before raising the cap |
| Lost admin key | No admin rotation function; adding signers to the admin account is the recovery path | **Open:** add signers right after deploy |
| Rounding or overflow | `split_amount` floors spendable, savings takes the remainder; overflowing amounts fail with typed errors; `overflow-checks = true` in release | Done |
| A full batch exceeding network limits | `MAX_BATCH = 10`; a test on the real wasm keeps 10 distinct recipients under the mainnet CPU limit | Done |
| Token behaves unexpectedly | Token fixed at deploy (Circle USDC SAC on mainnet); `recover_token` can return other tokens sent by mistake but refuses USDC | Done; USDC sent straight to the contract stays there until an upgrade |

### API

| Threat | Mitigation | Status |
| --- | --- | --- |
| API builds a transaction the user did not intend | The wallet shows what it signs; the API never holds user keys | By design |
| Mixed networks (testnet values on mainnet) | Per-network defaults; the API refuses to boot and the web build fails if a value belongs to the other network | Done |
| Fake remittances or history | `POST /remittances` accepts only a tx hash and verifies a successful remittance on our contract | Done |
| Malformed input causing 500s or odd math | DTO validation, `StellarAddressPipe`, strict `AMOUNT_REGEX`, `toStroops` rejects bad input | Done |
| Keeper key leaks | It only signs `run_schedule`, which needs no sender signature and follows the terms each sender signed; the key holds just XLM for fees, so a leak can at worst spend those fees | By design |
| Abuse of build endpoints (RPC cost) | Per-IP rate limit on transaction-building routes | Done (in-memory; move to a shared store if the API scales out) |
| Secret leakage | Secrets only in host env vars; `.env*` ignored by git | Done |
| CORS misuse | `CORS_ORIGIN` set to the web origin | Done |

### Web

| Threat | Mitigation | Status |
| --- | --- | --- |
| Signing a malicious SEP-10 challenge | `assertValidChallenge` checks network, signing key, sequence 0, time bounds and the `<domain> auth` op | Done |
| Tab-nabbing from the anchor popup | `opener` cleared; https-only anchor URLs | Done |
| Reporting a failed transaction as sent | `useTx` only reports success on `SUCCESS` | Done |
| Users treating the beta as production | Mainnet banner: real money, small amounts, the per-person cap | Done |

## Risk acceptance for the mainnet beta

The contract goes to mainnet without a third-party audit. What it has instead:

- An adversarial review on 2026-11-26 (three independent layers: a
  context-free hunter, an edge-case hunter and an acceptance audit against
  this document). Every fund-safety finding was fixed and covered by tests
  before deploy; the open items are listed in the table above.
- 74 unit tests, plus tests on the real wasm for upgrades and resource limits.
- An end-to-end regression on testnet through the deployed API
  (`apps/api/scripts/testnet-regression.ts`).
- Exposure limits: the per-person cap (100 USDC at launch) on savings and on
  open pledges, the pause switch, and exits that are never paused.

Accepted risks, and why: the admin key can upgrade the code, so it is as
sensitive as the funds. It lives in a dedicated account that gets more signers
right after deploy, and every upgrade is visible on-chain. With the cap in
place the beta's total exposure stays small while an audit is arranged.

## Monitoring plan

| Signal | Source | Alert when |
| --- | --- | --- |
| API health | `GET /api/health` (uptime checker every minute) | 2 failures in a row |
| Indexer freshness | `syncedLedger` in `GET /api/stats` vs. latest ledger | More than 10 minutes behind |
| Contract custody vs. books | Token balance vs. savings plus open pledges from events | Any mismatch |
| Outflows | `savings_withdrawn`, `savings_spent`, `pledge_released`, `pledge_refunded` events | One above the cap, or many within minutes |
| Admin actions | `user_cap_set`, `paused_set`, `token_recovered`, `upgraded` events | Any, outside a planned change |
| Keeper | `keeper` in `GET /api/health` (`lastTickAt`, `lastFailed`) and its XLM balance | No tick in 5 minutes, repeated failures, or under 20 XLM |
| Failed submissions | API logs (`simulate … failed`, `failed on-chain`) | Error rate above 5% over 15 minutes |
| Dependency health | Soroban RPC, Horizon status | Errors from either for 5 minutes |

## Incident response

1. `set_paused(true)` from the admin account: stops new money in; users can
   still withdraw, pay from savings and settle pledges.
2. Turn the keeper off (`KEEPER_ENABLED=false`) if schedules are involved.
3. Lower `user_cap` if the issue is exposure-related.
4. If the contract code is at fault: fix, test (`cargo test`,
   `bun run test:upgrade`), then `upgrade` to the fixed wasm and log it in
   `docs/mainnet.md`.
5. Tell users in-app and on the project channels; publish a post-mortem.

## Before raising the cap

- Third-party audit (SCF Audit Bank).
- Admin on a multisig account, timelock on `upgrade`.
- Monitoring above wired to alerts.
