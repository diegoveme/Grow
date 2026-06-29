# @raiz/contracts — Soroban

The on-chain logic for Raíz. One contract today: **`yield_splitter`**.

## `yield_splitter`

Splits an incoming USDC remittance between a **spendable** portion (withdrawable
at any time) and a **vault** portion (earmarked to earn yield via a DeFindex
vault → Blend pool), according to each recipient's configurable ratio.

### Interface

| Function | Description |
| --- | --- |
| `initialize(admin, token)` | One-time setup with admin + USDC token address |
| `set_vault(vault)` | Wire the external DeFindex vault (admin) |
| `set_split(user, spendable_bps)` | Recipient picks their spendable % (bps) |
| `get_split(user) -> u32` | Current ratio (defaults to 7000 = 70%) |
| `receive(from, to, amount) -> (spendable, vault)` | Pull USDC, split, credit balances |
| `deposit_vault(to) -> i128` | Move the earmarked vault balance to the vault |
| `claim_yield(to, amount) -> i128` | Record accrued yield as claimable (admin) |
| `withdraw(to, amount)` | Withdraw spendable USDC to the recipient |
| `wallet_balance / vault_balance / earned_yield / position` | Views |

**Storage:** `wallet_balance` · `vault_balance` · `ratio (split)` · `earned_yield`
**Events:** `FundsReceived` · `VaultDeposited` · `YieldClaimed` · `SplitSet`

### Develop

```bash
# from packages/contracts
cargo test                 # run the unit tests (host)
stellar contract build     # compile to wasm (target/wasm32v1-none/release)
```

> The build targets `wasm32v1-none`. The wasm target is declared in
> `rust-toolchain.toml`; install it with `rustup target add wasm32v1-none` if needed.

### Deploy to testnet

```bash
bun run deploy             # builds, deploys, initializes; prints the contract id
```

The script creates and friendbot-funds a `raiz` identity if absent, deploys the
contract, and calls `initialize` with the deployer as admin and the testnet USDC
token. Copy the printed `YIELD_SPLITTER_CONTRACT_ID` into your root `.env`.
