# @raiz/contracts · Soroban

The on-chain logic for Grow. One contract today: **`yield_splitter`**.

## `yield_splitter`

Splits each incoming USDC remittance by the recipient's ratio:

- the **spendable** part is transferred straight to the recipient's wallet;
- the **savings** part is held by the contract for that recipient, and only
  the recipient can withdraw it.

The contract never sends savings anywhere except back to their owner. Putting
USDC into the DeFindex vault (Blend strategy) happens from the user's own
wallet, outside the contract.

### Interface

| Function | Who signs | Description |
| --- | --- | --- |
| `__constructor(admin, token, user_cap)` | deployer | Runs with the deploy: admin, USDC token, savings cap |
| `set_split(user, spendable_bps)` | user | Choose the spendable share in basis points (0 to 10000) |
| `get_split(user) -> u32` | | Current ratio (defaults to 7000 = 70%) |
| `receive(from, to, amount) -> (spendable, savings)` | sender | Pay spendable to `to`, hold savings for `to` |
| `deposit_savings(user, amount) -> total` | user | Set aside own USDC into savings (cap and pause apply) |
| `withdraw_savings(to, amount) -> remaining` | recipient | Withdraw savings back to the wallet |
| `pay_from_savings(user, to, amount) -> remaining` | user | Pay a third party straight out of savings (never paused) |
| `set_user_cap(user_cap)` | admin | Change the per-recipient savings cap |
| `set_paused(paused)` | admin | Pause or resume `receive`. Withdrawals are never paused |
| `upgrade(new_wasm_hash)` | admin | Replace the code, keeping id and storage |
| `savings / position / config` | | Views |

**Storage:** `split` and `savings` per recipient (persistent, TTL extended on
every write), plus `admin`, `token`, `user_cap` and `paused` (instance).
**Events:** `SplitSet` · `FundsReceived` · `SavingsDeposited` · `SavingsWithdrawn` · `SavingsSpent` · `UserCapSet` · `PausedSet`

### Errors

| Code | Error | Meaning |
| --- | --- | --- |
| 1 | `NotInitialized` | Settings missing (should not happen after the constructor) |
| 2 | `InvalidSplit` | `spendable_bps` above 10000 |
| 3 | `InvalidAmount` | Amount is zero or negative |
| 4 | `InsufficientSavings` | Withdrawing more than the savings balance |
| 5 | `CapExceeded` | The recipient's savings would go over `user_cap` |
| 6 | `Paused` | New deposits are paused |
| 7 | `InvalidCap` | `user_cap` must be greater than zero |

The API translates these into user-facing messages
(`apps/api/src/stellar/contract-errors.ts`); keep both in sync.

### Develop

```bash
# from packages/contracts
cargo test                 # unit tests (host)
stellar contract build     # optimized wasm in target/wasm32v1-none/release
bun run test:upgrade       # build + the upgrade tests, which swap in real wasm
```

> The build targets `wasm32v1-none`, declared in `rust-toolchain.toml`. Install
> it with `rustup target add wasm32v1-none` if needed.

### Deploy

```bash
bun run deploy                                   # testnet, 100 USDC cap

SOROBAN_NETWORK=mainnet STELLAR_IDENTITY=grow-admin \
  USER_CAP_USDC=100 CONFIRM_MAINNET=yes bun run deploy
```

On testnet the script creates and friendbot-funds the `raiz` identity if it is
missing. On mainnet the identity must already exist and hold XLM for fees. The
constructor runs in the deploy transaction, so there is no separate init step.
Copy the printed `YIELD_SPLITTER_CONTRACT_ID` into the API env.

A new deploy is a new contract id: savings held by an older deployment stay
there and are withdrawable only from it.
