//! Storage layout and lifetime. Every read and write of contract state goes
//! through here, so keys and TTL rules live in one place.

use soroban_sdk::{contracttype, panic_with_error, Address, Env};

use crate::errors::Error;

/// Default split when a recipient has not chosen one: 70% spendable / 30% savings.
pub const DEFAULT_SPENDABLE_BPS: u32 = 7_000;

/// ~5s ledgers: 17,280 per day.
const DAY_IN_LEDGERS: u32 = 17_280;
/// Contract instance + code: keep at least a week alive, extend to a month.
const INSTANCE_TTL_THRESHOLD: u32 = 7 * DAY_IN_LEDGERS;
const INSTANCE_TTL_EXTEND_TO: u32 = 30 * DAY_IN_LEDGERS;
/// Per-recipient entries: keep at least a month alive, extend to ~4 months.
pub const USER_TTL_THRESHOLD: u32 = 30 * DAY_IN_LEDGERS;
pub const USER_TTL_EXTEND_TO: u32 = 120 * DAY_IN_LEDGERS;

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

// ── Instance settings ───────────────────────────────────────────────────────

pub fn init(env: &Env, admin: &Address, token: &Address, user_cap: i128) {
    let store = env.storage().instance();
    store.set(&DataKey::Admin, admin);
    store.set(&DataKey::Token, token);
    store.set(&DataKey::UserCap, &user_cap);
    store.set(&DataKey::Paused, &false);
    bump_instance(env);
}

pub fn admin(env: &Env) -> Address {
    required(env, &DataKey::Admin)
}

pub fn token(env: &Env) -> Address {
    required(env, &DataKey::Token)
}

pub fn user_cap(env: &Env) -> i128 {
    required(env, &DataKey::UserCap)
}

pub fn set_user_cap(env: &Env, user_cap: i128) {
    env.storage().instance().set(&DataKey::UserCap, &user_cap);
    bump_instance(env);
}

pub fn is_paused(env: &Env) -> bool {
    env.storage().instance().get(&DataKey::Paused).unwrap_or(false)
}

pub fn set_paused(env: &Env, paused: bool) {
    env.storage().instance().set(&DataKey::Paused, &paused);
    bump_instance(env);
}

/// Keep the contract instance and its code from being archived.
pub fn bump_instance(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_TTL_THRESHOLD, INSTANCE_TTL_EXTEND_TO);
}

fn required<V: soroban_sdk::TryFromVal<Env, soroban_sdk::Val>>(env: &Env, key: &DataKey) -> V {
    env.storage()
        .instance()
        .get(key)
        .unwrap_or_else(|| panic_with_error!(env, Error::NotInitialized))
}

// ── Per-recipient state ─────────────────────────────────────────────────────

pub fn split(env: &Env, user: &Address) -> u32 {
    env.storage()
        .persistent()
        .get(&DataKey::Split(user.clone()))
        .unwrap_or(DEFAULT_SPENDABLE_BPS)
}

pub fn set_split(env: &Env, user: &Address, spendable_bps: u32) {
    let key = DataKey::Split(user.clone());
    env.storage().persistent().set(&key, &spendable_bps);
    bump_user(env, &key);
}

/// Extend a recipient's split entry if they ever chose one.
pub fn touch_split(env: &Env, user: &Address) {
    let key = DataKey::Split(user.clone());
    if env.storage().persistent().has(&key) {
        bump_user(env, &key);
    }
}

pub fn savings(env: &Env, user: &Address) -> i128 {
    env.storage()
        .persistent()
        .get(&DataKey::Savings(user.clone()))
        .unwrap_or(0)
}

/// Adjust a recipient's savings by `delta`, returning the new balance. An
/// emptied balance is removed instead of paying rent for a zero.
pub fn add_savings(env: &Env, user: &Address, delta: i128) -> i128 {
    let key = DataKey::Savings(user.clone());
    let updated = savings(env, user) + delta;
    if updated == 0 {
        env.storage().persistent().remove(&key);
    } else {
        env.storage().persistent().set(&key, &updated);
        bump_user(env, &key);
    }
    updated
}

fn bump_user(env: &Env, key: &DataKey) {
    env.storage()
        .persistent()
        .extend_ttl(key, USER_TTL_THRESHOLD, USER_TTL_EXTEND_TO);
}
