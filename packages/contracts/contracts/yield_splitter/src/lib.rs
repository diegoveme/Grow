#![no_std]
//! # Grow: `yield_splitter`
//!
//! The on-chain heart of Grow. When a USDC remittance arrives for a recipient,
//! this contract splits it according to the recipient's configured ratio:
//!
//! - the **spendable** portion is transferred straight to the recipient's
//!   wallet, so it is usable (and cash-out ready) immediately;
//! - the **savings** portion is held by this contract on the recipient's
//!   behalf. Only the recipient can withdraw it, at any time.
//!
//! The contract never moves a recipient's savings anywhere except back to that
//! recipient. Routing savings into a vault (DeFindex, Blend) is done from the
//! recipient's own wallet, outside this contract.
//!
//! Beta guardrails: savings per recipient are capped (`user_cap`), and the
//! admin can pause new deposits. Withdrawals always stay open. The admin can
//! also upgrade the contract code to ship fixes without migrating funds.
//!
//! Layout: `errors` (codes), `types` (view structs), `events`, `storage`
//! (keys, TTL and every state read/write) and the entry points below.

mod errors;
mod events;
mod storage;
mod types;

pub use errors::Error;
pub use storage::{DataKey, USER_TTL_EXTEND_TO, USER_TTL_THRESHOLD};
pub use types::{Config, Position};

use events::{FundsReceived, PausedSet, SavingsWithdrawn, SplitSet, UserCapSet};
use soroban_sdk::{contract, contractimpl, panic_with_error, token, Address, BytesN, Env};

/// 100% expressed in basis points.
const BPS_DENOMINATOR: u32 = 10_000;

#[contract]
pub struct YieldSplitter;

#[contractimpl]
impl YieldSplitter {
    /// Runs once, atomically with the deploy, so nobody can initialize the
    /// contract before its owner does. `user_cap` is in token base units.
    pub fn __constructor(env: Env, admin: Address, token: Address, user_cap: i128) {
        if user_cap <= 0 {
            panic_with_error!(&env, Error::InvalidCap);
        }
        storage::init(&env, &admin, &token, user_cap);
    }

    // ── Admin ───────────────────────────────────────────────────────────────

    /// Change the per-recipient savings cap. Admin only. Lowering it below a
    /// recipient's current savings only blocks new deposits for them.
    pub fn set_user_cap(env: Env, user_cap: i128) {
        storage::admin(&env).require_auth();
        if user_cap <= 0 {
            panic_with_error!(&env, Error::InvalidCap);
        }
        storage::set_user_cap(&env, user_cap);
        UserCapSet { user_cap }.publish(&env);
    }

    /// Pause or resume new deposits. Admin only. Withdrawals keep working.
    pub fn set_paused(env: Env, paused: bool) {
        storage::admin(&env).require_auth();
        storage::set_paused(&env, paused);
        PausedSet { paused }.publish(&env);
    }

    /// Replace the contract code, keeping its id and storage. Admin only.
    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) {
        storage::admin(&env).require_auth();
        storage::bump_instance(&env);
        env.deployer().update_current_contract_wasm(new_wasm_hash);
    }

    // ── Recipients ──────────────────────────────────────────────────────────

    /// Choose the spendable ratio (in basis points) for the caller.
    /// `spendable_bps` must be between 0 and 10_000; the remainder is saved.
    pub fn set_split(env: Env, user: Address, spendable_bps: u32) {
        user.require_auth();
        if spendable_bps > BPS_DENOMINATOR {
            panic_with_error!(&env, Error::InvalidSplit);
        }
        storage::set_split(&env, &user, spendable_bps);
        storage::bump_instance(&env);
        SplitSet {
            user,
            spendable_bps,
        }
        .publish(&env);
    }

    /// The spendable ratio for `user`, defaulting to 70% if unset.
    pub fn get_split(env: Env, user: Address) -> u32 {
        storage::split(&env, &user)
    }

    /// Send `amount` of USDC from `from` to recipient `to`, split per `to`'s
    /// ratio: the spendable part goes straight to `to`'s wallet and the savings
    /// part is held here on `to`'s behalf.
    ///
    /// Returns `(spendable, savings)` amounts.
    pub fn receive(env: Env, from: Address, to: Address, amount: i128) -> (i128, i128) {
        from.require_auth();
        if storage::is_paused(&env) {
            panic_with_error!(&env, Error::Paused);
        }
        if amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }

        let (spendable, savings) = split_amount(amount, storage::split(&env, &to));
        if storage::savings(&env, &to) + savings > storage::user_cap(&env) {
            panic_with_error!(&env, Error::CapExceeded);
        }

        let token = token::Client::new(&env, &storage::token(&env));
        if spendable > 0 {
            token.transfer(&from, &to, &spendable);
        }
        if savings > 0 {
            token.transfer(&from, &env.current_contract_address(), &savings);
            storage::add_savings(&env, &to, savings);
        }
        storage::touch_split(&env, &to);
        storage::bump_instance(&env);

        FundsReceived {
            to,
            from,
            amount,
            spendable,
            savings,
        }
        .publish(&env);

        (spendable, savings)
    }

    /// Withdraw `amount` of the caller's savings back to their wallet.
    /// Returns the savings left after the withdrawal.
    pub fn withdraw_savings(env: Env, to: Address, amount: i128) -> i128 {
        to.require_auth();
        if amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }
        if amount > storage::savings(&env, &to) {
            panic_with_error!(&env, Error::InsufficientSavings);
        }
        let remaining = storage::add_savings(&env, &to, -amount);
        token::Client::new(&env, &storage::token(&env)).transfer(
            &env.current_contract_address(),
            &to,
            &amount,
        );
        storage::bump_instance(&env);
        SavingsWithdrawn {
            to,
            amount,
            remaining,
        }
        .publish(&env);
        remaining
    }

    // ── Views ───────────────────────────────────────────────────────────────

    pub fn savings(env: Env, user: Address) -> i128 {
        storage::savings(&env, &user)
    }

    pub fn config(env: Env) -> Config {
        Config {
            admin: storage::admin(&env),
            token: storage::token(&env),
            user_cap: storage::user_cap(&env),
            paused: storage::is_paused(&env),
        }
    }

    pub fn position(env: Env, user: Address) -> Position {
        Position {
            spendable_bps: storage::split(&env, &user),
            savings: storage::savings(&env, &user),
        }
    }
}

/// Split `amount` into `(spendable, savings)` for a spendable ratio in bps.
/// Rounding favors savings: spendable is floored, savings takes the remainder.
fn split_amount(amount: i128, spendable_bps: u32) -> (i128, i128) {
    let spendable = amount * i128::from(spendable_bps) / i128::from(BPS_DENOMINATOR);
    (spendable, amount - spendable)
}

#[cfg(test)]
mod test;
