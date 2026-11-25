//! Values returned by the contract's views.

use soroban_sdk::{contracttype, Address};

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
