//! Values returned by the contract's views.

use soroban_sdk::{contracttype, Address};

/// A recipient's position, returned by `position`.
#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct Position {
    pub spendable_bps: u32,
    pub savings: i128,
}

/// One payment in a `send_batch` call.
#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct Payment {
    pub to: Address,
    pub amount: i128,
}

/// A recurring remittance, paid from `from` to `to` every `interval` seconds
/// out of the allowance `from` granted this contract on the token.
#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct Schedule {
    pub from: Address,
    pub to: Address,
    pub amount: i128,
    /// Seconds between runs.
    pub interval: u64,
    /// Ledger timestamp from which the next run is allowed.
    pub next_at: u64,
    /// Runs left; the schedule is deleted after the last one.
    pub runs_left: u32,
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
