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
//! Storage: `ratio (split)` · `savings`
//! Events:  `SplitSet` · `FundsReceived` · `SavingsWithdrawn`

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, panic_with_error, token,
    Address, Env,
};

/// 100% expressed in basis points.
const BPS_DENOMINATOR: u32 = 10_000;
/// Default split when a recipient has not chosen one: 70% spendable / 30% savings.
const DEFAULT_SPENDABLE_BPS: u32 = 7_000;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    InvalidSplit = 3,
    InvalidAmount = 4,
    InsufficientSavings = 5,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    /// USDC token contract address used for transfers.
    Token,
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

#[contract]
pub struct YieldSplitter;

#[contractimpl]
impl YieldSplitter {
    /// Initialize the contract with an admin and the USDC token address.
    pub fn initialize(env: Env, admin: Address, token: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Token, &token);
    }

    /// Choose the spendable ratio (in basis points) for the caller.
    /// `spendable_bps` must be between 0 and 10_000; the remainder is saved.
    pub fn set_split(env: Env, user: Address, spendable_bps: u32) {
        user.require_auth();
        if spendable_bps > BPS_DENOMINATOR {
            panic_with_error!(&env, Error::InvalidSplit);
        }
        env.storage()
            .persistent()
            .set(&DataKey::Split(user.clone()), &spendable_bps);
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
        if amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }

        let spendable_bps = Self::get_split(env.clone(), to.clone());
        let spendable = amount * i128::from(spendable_bps) / i128::from(BPS_DENOMINATOR);
        let savings = amount - spendable;

        let token = token::Client::new(&env, &Self::token(&env));
        if spendable > 0 {
            token.transfer(&from, &to, &spendable);
        }
        if savings > 0 {
            token.transfer(&from, &env.current_contract_address(), &savings);
            Self::add_savings(&env, &to, savings);
        }

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

    pub fn position(env: Env, user: Address) -> Position {
        Position {
            spendable_bps: Self::get_split(env.clone(), user.clone()),
            savings: Self::savings(env, user),
        }
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    fn token(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Token)
            .unwrap_or_else(|| panic_with_error!(env, Error::NotInitialized))
    }

    fn add_savings(env: &Env, user: &Address, delta: i128) -> i128 {
        let key = DataKey::Savings(user.clone());
        let current: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        let updated = current + delta;
        env.storage().persistent().set(&key, &updated);
        updated
    }
}

#[cfg(test)]
mod test;
