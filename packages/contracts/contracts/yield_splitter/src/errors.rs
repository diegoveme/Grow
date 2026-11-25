//! Contract error codes. The API maps them to user-facing messages in
//! `apps/api/src/stellar/contract-errors.ts`; keep both in sync.

use soroban_sdk::contracterror;

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
    ScheduleNotFound = 8,
    ScheduleNotDue = 9,
    InvalidSchedule = 10,
    InvalidBatch = 11,
    PledgeNotFound = 12,
    PledgeExpired = 13,
    PledgeNotExpired = 14,
    InvalidPledge = 15,
    RecoverForbidden = 16,
}
