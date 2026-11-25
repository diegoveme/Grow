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

/// A sender set up a recurring remittance.
#[contractevent]
#[derive(Clone)]
pub struct ScheduleCreated {
    #[topic]
    pub from: Address,
    pub id: u64,
    pub to: Address,
    pub amount: i128,
    pub interval: u64,
    pub runs: u32,
}

/// A recurring remittance ran (its split is in the FundsReceived event).
#[contractevent]
#[derive(Clone)]
pub struct ScheduleRun {
    #[topic]
    pub id: u64,
    pub runs_left: u32,
}

/// A sender cancelled a recurring remittance.
#[contractevent]
#[derive(Clone)]
pub struct ScheduleCancelled {
    #[topic]
    pub id: u64,
}

/// A sender set aside funds for a specific payee (conditional remittance).
#[contractevent]
#[derive(Clone)]
pub struct PledgeCreated {
    #[topic]
    pub from: Address,
    pub id: u64,
    pub beneficiary: Address,
    pub payee: Address,
    pub amount: i128,
    pub expires_at: u64,
}

/// The beneficiary released a pledge: the payee got paid.
#[contractevent]
#[derive(Clone)]
pub struct PledgeReleased {
    #[topic]
    pub id: u64,
    pub payee: Address,
    pub amount: i128,
}

/// An expired, unused pledge went back to its sender.
#[contractevent]
#[derive(Clone)]
pub struct PledgeRefunded {
    #[topic]
    pub id: u64,
    pub from: Address,
    pub amount: i128,
}

/// The admin returned a token that was sent to the contract by mistake.
#[contractevent]
#[derive(Clone)]
pub struct TokenRecovered {
    #[topic]
    pub token: Address,
    pub to: Address,
    pub amount: i128,
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
