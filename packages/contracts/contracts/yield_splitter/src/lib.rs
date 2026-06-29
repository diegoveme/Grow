#![no_std]
//! # Raíz — `yield_splitter`
//!
//! The on-chain heart of Raíz. When a remittance in USDC arrives for a
//! recipient, this contract splits it according to the recipient's configured
//! ratio: a spendable portion they can withdraw at any time (cash-out via the
//! anchor), and a vault portion earmarked to earn yield (deposited into a
//! DeFindex vault that routes into a Blend lending pool).
//!
//! The contract keeps the accounting and custody of the spendable + vault
//! balances and emits the events the rest of the system reacts to. The actual
//! DeFindex deposit is performed by the backend via the DeFindex SDK against
//! the `vault_balance` this contract tracks; `claim_yield` records the yield
//! that flows back.
//!
//! Storage: `wallet_balance` · `vault_balance` · `ratio` · `earned_yield`
//! Events:  `received` · `vault_dep` · `yield_clm`

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, panic_with_error, token,
    Address, Env,
};

/// 100% expressed in basis points.
const BPS_DENOMINATOR: u32 = 10_000;
/// Default split when a recipient has not chosen one: 70% spendable / 30% vault.
const DEFAULT_SPENDABLE_BPS: u32 = 7_000;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    InvalidSplit = 3,
    InvalidAmount = 4,
    InsufficientSpendable = 5,
    InsufficientVault = 6,
    NotAuthorized = 7,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    /// USDC token contract address used for transfers.
    Token,
    /// Optional external vault (DeFindex) address the backend deposits into.
    Vault,
    /// Per-recipient spendable ratio in basis points.
    Split(Address),
    /// Per-recipient spendable (withdrawable) balance held by this contract.
    WalletBalance(Address),
    /// Per-recipient amount earmarked for / held in the vault.
    VaultBalance(Address),
    /// Per-recipient yield accrued from the vault and claimable.
    EarnedYield(Address),
}

/// A recipient's full position, returned by `position`.
#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct Position {
    pub spendable_bps: u32,
    pub wallet_balance: i128,
    pub vault_balance: i128,
    pub earned_yield: i128,
}

// ── Events ────────────────────────────────────────────────────────────────

/// A recipient chose (or changed) their spendable/vault ratio.
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
    pub vault: i128,
}

/// A recipient's vault portion was deposited toward the yield vault.
#[contractevent]
#[derive(Clone)]
pub struct VaultDeposited {
    #[topic]
    pub to: Address,
    pub amount: i128,
}

/// Yield earned by a recipient's vault position was recorded as claimable.
#[contractevent]
#[derive(Clone)]
pub struct YieldClaimed {
    #[topic]
    pub to: Address,
    pub amount: i128,
    pub total: i128,
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

    /// Set the external vault (DeFindex) address. Admin only.
    pub fn set_vault(env: Env, vault: Address) {
        Self::admin(&env).require_auth();
        env.storage().instance().set(&DataKey::Vault, &vault);
    }

    /// Choose the spendable ratio (in basis points) for the caller.
    /// `spendable_bps` must be between 0 and 10_000; the remainder goes to the vault.
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

    /// Receive `amount` of USDC from `from` on behalf of recipient `to`, then
    /// split it per `to`'s ratio. The spendable portion becomes withdrawable;
    /// the vault portion is earmarked and (if a vault is configured) deposited.
    ///
    /// Returns `(spendable, vault)` amounts.
    pub fn receive(env: Env, from: Address, to: Address, amount: i128) -> (i128, i128) {
        from.require_auth();
        if amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }

        // Pull the USDC into the contract's custody.
        let token = Self::token(&env);
        token::Client::new(&env, &token).transfer(
            &from,
            &env.current_contract_address(),
            &amount,
        );

        // Split per the recipient's configured ratio.
        let spendable_bps = Self::get_split(env.clone(), to.clone());
        let spendable = amount * i128::from(spendable_bps) / i128::from(BPS_DENOMINATOR);
        let vault = amount - spendable;

        Self::add_wallet_balance(&env, &to, spendable);
        Self::add_vault_balance(&env, &to, vault);

        FundsReceived {
            to: to.clone(),
            from,
            amount,
            spendable,
            vault,
        }
        .publish(&env);

        (spendable, vault)
    }

    /// Move the recipient's earmarked vault balance into the configured DeFindex
    /// vault. The token transfer to the vault is done here; share accounting and
    /// strategy investment happen in the vault contract. Returns the amount moved.
    pub fn deposit_vault(env: Env, to: Address) -> i128 {
        let amount = Self::vault_balance(env.clone(), to.clone());
        if amount <= 0 {
            panic_with_error!(&env, Error::InsufficientVault);
        }

        // If an external vault is wired, transfer the funds to it. Otherwise the
        // contract keeps custody and the backend orchestrates the DeFindex SDK
        // deposit against this tracked balance.
        if let Some(vault) = Self::vault(&env) {
            let token = Self::token(&env);
            token::Client::new(&env, &token).transfer(
                &env.current_contract_address(),
                &vault,
                &amount,
            );
        }

        VaultDeposited {
            to: to.clone(),
            amount,
        }
        .publish(&env);
        amount
    }

    /// Record `yield_amount` of yield earned by `to`'s vault position as
    /// claimable. Admin only (the backend reconciles vault growth on-chain).
    pub fn claim_yield(env: Env, to: Address, yield_amount: i128) -> i128 {
        Self::admin(&env).require_auth();
        if yield_amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }
        let key = DataKey::EarnedYield(to.clone());
        let current: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        let updated = current + yield_amount;
        env.storage().persistent().set(&key, &updated);
        YieldClaimed {
            to,
            amount: yield_amount,
            total: updated,
        }
        .publish(&env);
        updated
    }

    /// Withdraw `amount` of the caller's spendable USDC balance to their wallet.
    pub fn withdraw(env: Env, to: Address, amount: i128) {
        to.require_auth();
        if amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }
        let balance = Self::wallet_balance(env.clone(), to.clone());
        if amount > balance {
            panic_with_error!(&env, Error::InsufficientSpendable);
        }
        Self::add_wallet_balance(&env, &to, -amount);
        let token = Self::token(&env);
        token::Client::new(&env, &token).transfer(
            &env.current_contract_address(),
            &to,
            &amount,
        );
    }

    // ── Views ───────────────────────────────────────────────────────────────

    pub fn wallet_balance(env: Env, user: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::WalletBalance(user))
            .unwrap_or(0)
    }

    pub fn vault_balance(env: Env, user: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::VaultBalance(user))
            .unwrap_or(0)
    }

    pub fn earned_yield(env: Env, user: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::EarnedYield(user))
            .unwrap_or(0)
    }

    pub fn position(env: Env, user: Address) -> Position {
        Position {
            spendable_bps: Self::get_split(env.clone(), user.clone()),
            wallet_balance: Self::wallet_balance(env.clone(), user.clone()),
            vault_balance: Self::vault_balance(env.clone(), user.clone()),
            earned_yield: Self::earned_yield(env, user),
        }
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    fn admin(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(env, Error::NotInitialized))
    }

    fn token(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Token)
            .unwrap_or_else(|| panic_with_error!(env, Error::NotInitialized))
    }

    fn vault(env: &Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::Vault)
    }

    fn add_wallet_balance(env: &Env, user: &Address, delta: i128) {
        let key = DataKey::WalletBalance(user.clone());
        let current: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        env.storage().persistent().set(&key, &(current + delta));
    }

    fn add_vault_balance(env: &Env, user: &Address, delta: i128) {
        let key = DataKey::VaultBalance(user.clone());
        let current: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        env.storage().persistent().set(&key, &(current + delta));
    }
}

#[cfg(test)]
mod test;
