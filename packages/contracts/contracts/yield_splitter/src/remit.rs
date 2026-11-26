//! The one place money moves for a remittance: split by the recipient's
//! ratio, pay the spendable part to their wallet, keep the savings part.
//! Used by `receive`, `send_batch` and `run_schedule`.

use soroban_sdk::{panic_with_error, token, Address, Env};

use crate::errors::Error;
use crate::events::FundsReceived;
use crate::{split_amount, storage};

/// How the sender's USDC is pulled.
pub enum Pull {
    /// The sender signed this call: plain transfers from their account.
    Signed,
    /// The sender pre-approved this contract on the token (recurring
    /// remittances): transfer_from, spending that allowance.
    Allowance,
}

/// Split `amount` for `to`, move the funds and emit `FundsReceived`.
/// Callers check pause, and auth where the sender signs (`run_schedule`
/// relies on the allowance instead); this checks the amount and the cap.
pub fn remit(env: &Env, from: &Address, to: &Address, amount: i128, pull: Pull) -> (i128, i128) {
    if amount <= 0 {
        panic_with_error!(env, Error::InvalidAmount);
    }
    let here = env.current_contract_address();
    if *to == here {
        panic_with_error!(env, Error::InvalidRecipient);
    }
    let (mut spendable, mut savings) = split_amount(amount, storage::split(env, to))
        .unwrap_or_else(|| panic_with_error!(env, Error::InvalidAmount));
    // Beta cap: savings beyond the recipient's room go to their wallet, so a
    // full (or lowered) cap never blocks a remittance or a whole batch.
    let room = (storage::user_cap(env) - storage::savings(env, to)).max(0);
    if savings > room {
        spendable += savings - room;
        savings = room;
    }

    let token = token::Client::new(env, &storage::token(env));
    let move_funds = |dest: &Address, value: i128| match pull {
        Pull::Signed => token.transfer(from, dest, &value),
        Pull::Allowance => token.transfer_from(&here, from, dest, &value),
    };
    if spendable > 0 {
        move_funds(to, spendable);
    }
    if savings > 0 {
        move_funds(&here, savings);
        storage::add_savings(env, to, savings);
    }
    storage::touch_split(env, to);

    FundsReceived {
        to: to.clone(),
        from: from.clone(),
        amount,
        spendable,
        savings,
    }
    .publish(env);
    (spendable, savings)
}
