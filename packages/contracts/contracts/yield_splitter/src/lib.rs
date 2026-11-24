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
//! recipient. Routing savings into a yield vault (DeFindex, Blend) is done from
//! the recipient's own wallet, outside this contract.
//!
//! Beta guardrails: savings per recipient are capped (`user_cap`), and the
//! admin can pause new deposits. Withdrawals always stay open. The admin can
//! also upgrade the contract code to ship fixes without migrating funds.
//!
//! Storage: `ratio (split)` · `savings` · `user_cap` · `paused`
//! Events:  `SplitSet` · `FundsReceived` · `SavingsWithdrawn` · `UserCapSet` · `PausedSet`

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, panic_with_error, token,
    Address, BytesN, Env,
};

/// 100% expressed in basis points.
const BPS_DENOMINATOR: u32 = 10_000;
/// Default split when a recipient has not chosen one: 70% spendable / 30% savings.
const DEFAULT_SPENDABLE_BPS: u32 = 7_000;

/// ~5s ledgers: 17,280 per day.
const DAY_IN_LEDGERS: u32 = 17_280;
/// Contract instance + code: keep at least a week alive, extend to a month.
const INSTANCE_TTL_THRESHOLD: u32 = 7 * DAY_IN_LEDGERS;
const INSTANCE_TTL_EXTEND_TO: u32 = 30 * DAY_IN_LEDGERS;
/// Per-recipient entries: keep at least a month alive, extend to ~4 months.
pub const USER_TTL_THRESHOLD: u32 = 30 * DAY_IN_LEDGERS;
pub const USER_TTL_EXTEND_TO: u32 = 120 * DAY_IN_LEDGERS;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    InvalidSplit = 2,
    InvalidAmount = 3,
    InsufficientSavings = 4,
    CapExceeded = 5,
    Paused = 6,
    InvalidCap = 7,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    /// USDC token contract address used for transfers.
    Token,
    /// Max savings (token base units) the contract may hold for one recipient.
    UserCap,
    /// When true, `receive` is rejected. Withdrawals are never paused.
    Paused,
    /// Per-recipient spendable ratio in basis points.
    Split(Address),
    /// Per-recipient savings held by this contract.
    Savings(Address),
}

/// A recipient's position, returned by `position`.
#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct Position {
    pub spendable_bps: u32,
    pub savings: i128,
}

/// Global contract settings, returned by `config`.
#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct Config {
    pub admin: Address,
    pub token: Address,
    pub user_cap: i128,
    pub paused: bool,
}

// ── Events ────────────────────────────────────────────────────────────────

/// A recipient chose (or changed) their spendable/savings ratio.
#[contractevent]
#[derive(Clone)]
pub struct SplitSet {
    #[topic]
    pub user: Address,
    pub spendable_bps: u32,
}

/// A remittance was received and split for a recipient.
#[contractevent]
#[derive(Clone)]
pub struct FundsReceived {
    #[topic]
    pub to: Address,
    pub from: Address,
    pub amount: i128,
    pub spendable: i128,
    pub savings: i128,
}

/// A recipient withdrew part or all of their savings.
#[contractevent]
#[derive(Clone)]
pub struct SavingsWithdrawn {
    #[topic]
    pub to: Address,
    pub amount: i128,
    pub remaining: i128,
}

/// The admin changed the per-recipient savings cap.
#[contractevent]
#[derive(Clone)]
pub struct UserCapSet {
    pub user_cap: i128,
}

/// The admin paused or resumed new deposits.
#[contractevent]
#[derive(Clone)]
pub struct PausedSet {
    pub paused: bool,
}

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
        let store = env.storage().instance();
        store.set(&DataKey::Admin, &admin);
        store.set(&DataKey::Token, &token);
        store.set(&DataKey::UserCap, &user_cap);
        store.set(&DataKey::Paused, &false);
        Self::bump_instance(&env);
    }

    // ── Admin ───────────────────────────────────────────────────────────────

    /// Change the per-recipient savings cap. Admin only. Lowering it below a
    /// recipient's current savings only blocks new deposits for them.
    pub fn set_user_cap(env: Env, user_cap: i128) {
        Self::read_admin(&env).require_auth();
        if user_cap <= 0 {
            panic_with_error!(&env, Error::InvalidCap);
        }
        env.storage().instance().set(&DataKey::UserCap, &user_cap);
        Self::bump_instance(&env);
        UserCapSet { user_cap }.publish(&env);
    }

    /// Pause or resume new deposits. Admin only. Withdrawals keep working.
    pub fn set_paused(env: Env, paused: bool) {
        Self::read_admin(&env).require_auth();
        env.storage().instance().set(&DataKey::Paused, &paused);
        Self::bump_instance(&env);
        PausedSet { paused }.publish(&env);
    }

    /// Replace the contract code, keeping its id and storage. Admin only.
    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) {
        Self::read_admin(&env).require_auth();
        Self::bump_instance(&env);
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
        let key = DataKey::Split(user.clone());
        env.storage().persistent().set(&key, &spendable_bps);
        Self::bump_user(&env, &key);
        Self::bump_instance(&env);
        SplitSet {
            user,
            spendable_bps,
        }
        .publish(&env);
    }

    /// The spendable ratio for `user`, defaulting to 70% if unset.
    pub fn get_split(env: Env, user: Address) -> u32 {
        env.storage()
            .persistent()
            .get(&DataKey::Split(user))
            .unwrap_or(DEFAULT_SPENDABLE_BPS)
    }

    /// Send `amount` of USDC from `from` to recipient `to`, split per `to`'s
    /// ratio: the spendable part goes straight to `to`'s wallet and the savings
    /// part is held here on `to`'s behalf.
    ///
    /// Returns `(spendable, savings)` amounts.
    pub fn receive(env: Env, from: Address, to: Address, amount: i128) -> (i128, i128) {
        from.require_auth();
        if Self::is_paused(&env) {
            panic_with_error!(&env, Error::Paused);
        }
        if amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }

        let spendable_bps = Self::get_split(env.clone(), to.clone());
        let spendable = amount * i128::from(spendable_bps) / i128::from(BPS_DENOMINATOR);
        let savings = amount - spendable;
        if Self::savings(env.clone(), to.clone()) + savings > Self::read_user_cap(&env) {
            panic_with_error!(&env, Error::CapExceeded);
        }

        let token = token::Client::new(&env, &Self::token(&env));
        if spendable > 0 {
            token.transfer(&from, &to, &spendable);
        }
        if savings > 0 {
            token.transfer(&from, &env.current_contract_address(), &savings);
            Self::add_savings(&env, &to, savings);
        }

        let split_key = DataKey::Split(to.clone());
        if env.storage().persistent().has(&split_key) {
            Self::bump_user(&env, &split_key);
        }
        Self::bump_instance(&env);

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
        let balance = Self::savings(env.clone(), to.clone());
        if amount > balance {
            panic_with_error!(&env, Error::InsufficientSavings);
        }
        let remaining = Self::add_savings(&env, &to, -amount);
        token::Client::new(&env, &Self::token(&env)).transfer(
            &env.current_contract_address(),
            &to,
            &amount,
        );
        Self::bump_instance(&env);
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
        env.storage()
            .persistent()
            .get(&DataKey::Savings(user))
            .unwrap_or(0)
    }

    pub fn config(env: Env) -> Config {
        Config {
            admin: Self::read_admin(&env),
            token: Self::token(&env),
            user_cap: Self::read_user_cap(&env),
            paused: Self::is_paused(&env),
        }
    }

    pub fn position(env: Env, user: Address) -> Position {
        Position {
            spendable_bps: Self::get_split(env.clone(), user.clone()),
            savings: Self::savings(env, user),
        }
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    fn read_admin(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(env, Error::NotInitialized))
    }

    fn read_user_cap(env: &Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::UserCap)
            .unwrap_or_else(|| panic_with_error!(env, Error::NotInitialized))
    }

    fn is_paused(env: &Env) -> bool {
        env.storage().instance().get(&DataKey::Paused).unwrap_or(false)
    }

    fn token(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Token)
            .unwrap_or_else(|| panic_with_error!(env, Error::NotInitialized))
    }

    /// Adjust a recipient's savings by `delta`, returning the new balance. An
    /// emptied balance is removed instead of paying rent for a zero.
    fn add_savings(env: &Env, user: &Address, delta: i128) -> i128 {
        let key = DataKey::Savings(user.clone());
        let current: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        let updated = current + delta;
        if updated == 0 {
            env.storage().persistent().remove(&key);
        } else {
            env.storage().persistent().set(&key, &updated);
            Self::bump_user(env, &key);
        }
        updated
    }

    fn bump_user(env: &Env, key: &DataKey) {
        env.storage()
            .persistent()
            .extend_ttl(key, USER_TTL_THRESHOLD, USER_TTL_EXTEND_TO);
    }

    fn bump_instance(env: &Env) {
        env.storage()
            .instance()
            .extend_ttl(INSTANCE_TTL_THRESHOLD, INSTANCE_TTL_EXTEND_TO);
    }
}

#[cfg(test)]
mod test;
