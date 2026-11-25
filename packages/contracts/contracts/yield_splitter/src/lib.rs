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
//! Recipients can also top up savings from their own wallet
//! (`deposit_savings`), withdraw them at any time (`withdraw_savings`) or pay
//! someone directly out of them (`pay_from_savings`).
//!
//! Beta guardrails: savings per recipient are capped (`user_cap`), and the
//! admin can pause new deposits. Withdrawals always stay open. The admin can
//! also upgrade the contract code to ship fixes without migrating funds.
//!
//! Layout: `errors` (codes), `types` (view structs), `events`, `storage`
//! (keys, TTL and every state read/write) and the entry points below.

mod errors;
mod events;
mod remit;
mod storage;
mod types;

pub use errors::Error;
pub use storage::{DataKey, USER_TTL_EXTEND_TO, USER_TTL_THRESHOLD};
pub use types::{Config, Payment, Position, Schedule};

use events::{
    PausedSet, SavingsDeposited, SavingsSpent, SavingsWithdrawn, ScheduleCancelled,
    ScheduleCreated, ScheduleRun, SplitSet, UserCapSet,
};
use remit::{remit, Pull};
use soroban_sdk::{contract, contractimpl, panic_with_error, token, Address, BytesN, Env, Vec};

/// 100% expressed in basis points.
const BPS_DENOMINATOR: u32 = 10_000;
/// Most recipients one `send_batch` may pay (keeps it within resource limits).
pub const MAX_BATCH: u32 = 10;
/// Shortest interval between runs of a recurring remittance (1 minute).
pub const MIN_INTERVAL: u64 = 60;
/// Most runs a single schedule may have.
pub const MAX_RUNS: u32 = 120;

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
        let result = remit(&env, &from, &to, amount, Pull::Signed);
        storage::bump_instance(&env);
        result
    }

    /// Send to several people with one signature: each payment is split by
    /// its recipient's own ratio, exactly as `receive` would. Up to
    /// `MAX_BATCH` payments. Returns the total sent.
    pub fn send_batch(env: Env, from: Address, payments: Vec<Payment>) -> i128 {
        from.require_auth();
        if storage::is_paused(&env) {
            panic_with_error!(&env, Error::Paused);
        }
        if payments.is_empty() || payments.len() > MAX_BATCH {
            panic_with_error!(&env, Error::InvalidBatch);
        }
        let mut total: i128 = 0;
        for payment in payments.iter() {
            remit(&env, &from, &payment.to, payment.amount, Pull::Signed);
            total += payment.amount;
        }
        storage::bump_instance(&env);
        total
    }

    // ── Recurring remittances ───────────────────────────────────────────────

    /// Set up a recurring remittance of `amount` to `to` every `interval`
    /// seconds, `runs` times. The first run is due right away. Funds are
    /// pulled from `from`'s allowance on the token, so `from` must approve
    /// this contract for at least `amount * runs` (the API builds both).
    /// Returns the schedule id.
    pub fn create_schedule(
        env: Env,
        from: Address,
        to: Address,
        amount: i128,
        interval: u64,
        runs: u32,
    ) -> u64 {
        from.require_auth();
        if amount <= 0 || interval < MIN_INTERVAL || runs == 0 || runs > MAX_RUNS {
            panic_with_error!(&env, Error::InvalidSchedule);
        }
        let id = storage::next_schedule_id(&env);
        storage::set_schedule(
            &env,
            id,
            &Schedule {
                from: from.clone(),
                to: to.clone(),
                amount,
                interval,
                next_at: env.ledger().timestamp(),
                runs_left: runs,
            },
        );
        storage::bump_instance(&env);
        ScheduleCreated {
            from,
            id,
            to,
            amount,
            interval,
            runs,
        }
        .publish(&env);
        id
    }

    /// Run a due recurring remittance. Anyone may call it (a keeper, the
    /// recipient, the sender): the terms were fixed and signed by the sender
    /// when the schedule was created. If a run is late, the next one is
    /// due `interval` after now, so missed periods never stack up.
    pub fn run_schedule(env: Env, id: u64) -> (i128, i128) {
        if storage::is_paused(&env) {
            panic_with_error!(&env, Error::Paused);
        }
        let mut schedule = storage::schedule(&env, id)
            .unwrap_or_else(|| panic_with_error!(&env, Error::ScheduleNotFound));
        let now = env.ledger().timestamp();
        if now < schedule.next_at {
            panic_with_error!(&env, Error::ScheduleNotDue);
        }

        let result = remit(&env, &schedule.from, &schedule.to, schedule.amount, Pull::Allowance);

        schedule.runs_left -= 1;
        if schedule.runs_left == 0 {
            storage::remove_schedule(&env, id);
        } else {
            schedule.next_at = now + schedule.interval;
            storage::set_schedule(&env, id, &schedule);
        }
        storage::bump_instance(&env);
        ScheduleRun {
            id,
            runs_left: schedule.runs_left,
        }
        .publish(&env);
        result
    }

    /// Stop a recurring remittance. Only its sender can cancel it.
    pub fn cancel_schedule(env: Env, id: u64) {
        let schedule = storage::schedule(&env, id)
            .unwrap_or_else(|| panic_with_error!(&env, Error::ScheduleNotFound));
        schedule.from.require_auth();
        storage::remove_schedule(&env, id);
        ScheduleCancelled { id }.publish(&env);
    }

    /// A recurring remittance by id, if it still has runs left.
    pub fn schedule(env: Env, id: u64) -> Option<Schedule> {
        storage::schedule(&env, id)
    }

    /// Move `amount` of the caller's own USDC from their wallet into their
    /// savings, on top of what remittances already saved. Respects the
    /// per-recipient cap and the pause switch. Returns the new savings total.
    pub fn deposit_savings(env: Env, user: Address, amount: i128) -> i128 {
        user.require_auth();
        if storage::is_paused(&env) {
            panic_with_error!(&env, Error::Paused);
        }
        if amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }
        if storage::savings(&env, &user) + amount > storage::user_cap(&env) {
            panic_with_error!(&env, Error::CapExceeded);
        }
        token::Client::new(&env, &storage::token(&env)).transfer(
            &user,
            &env.current_contract_address(),
            &amount,
        );
        let total = storage::add_savings(&env, &user, amount);
        storage::bump_instance(&env);
        SavingsDeposited {
            user,
            amount,
            total,
        }
        .publish(&env);
        total
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

    /// Pay `amount` from the caller's savings straight to `to` (a school, a
    /// clinic, a landlord) without passing through the caller's wallet.
    /// Like a withdrawal, it is never paused. Returns the savings left.
    pub fn pay_from_savings(env: Env, user: Address, to: Address, amount: i128) -> i128 {
        user.require_auth();
        if amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }
        if amount > storage::savings(&env, &user) {
            panic_with_error!(&env, Error::InsufficientSavings);
        }
        let remaining = storage::add_savings(&env, &user, -amount);
        token::Client::new(&env, &storage::token(&env)).transfer(
            &env.current_contract_address(),
            &to,
            &amount,
        );
        storage::bump_instance(&env);
        SavingsSpent {
            user,
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
pub(crate) fn split_amount(amount: i128, spendable_bps: u32) -> (i128, i128) {
    let spendable = amount * i128::from(spendable_bps) / i128::from(BPS_DENOMINATOR);
    (spendable, amount - spendable)
}

#[cfg(test)]
mod test;
