//! Events the contract publishes. Off-chain indexers and the API's activity
//! feed rely on these shapes.

use soroban_sdk::{contractevent, Address};

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

/// A recipient moved their own funds into savings.
#[contractevent]
#[derive(Clone)]
pub struct SavingsDeposited {
    #[topic]
    pub user: Address,
    pub amount: i128,
    pub total: i128,
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

/// A recipient paid someone else directly out of their savings.
#[contractevent]
#[derive(Clone)]
pub struct SavingsSpent {
    #[topic]
    pub user: Address,
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
