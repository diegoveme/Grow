#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{
        storage::{Instance as _, Persistent as _},
        Address as _, Events as _, Ledger as _,
    },
    token::{self, StellarAssetClient},
    Address, Env,
};

/// Per-recipient savings cap used by the default harness.
const CAP: i128 = 1_000;

struct Harness<'a> {
    env: Env,
    admin: Address,
    client: YieldSplitterClient<'a>,
    token: token::Client<'a>,
    token_admin: StellarAssetClient<'a>,
}

fn setup<'a>() -> Harness<'a> {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let token_id = sac.address();
    let token = token::Client::new(&env, &token_id);
    let token_admin = StellarAssetClient::new(&env, &token_id);

    let contract_id = env.register(YieldSplitter, (admin.clone(), token_id.clone(), CAP));
    let client = YieldSplitterClient::new(&env, &contract_id);

    Harness {
        env,
        admin,
        client,
        token,
        token_admin,
    }
}

impl Harness<'_> {
    /// A funded sender and a fresh recipient.
    fn parties(&self, funds: i128) -> (Address, Address) {
        let sender = Address::generate(&self.env);
        let recipient = Address::generate(&self.env);
        self.token_admin.mint(&sender, &funds);
        (sender, recipient)
    }
}

#[test]
fn default_split_pays_70_and_saves_30() {
    let h = setup();
    let (sender, recipient) = h.parties(200);

    let (spendable, savings) = h.client.receive(&sender, &recipient, &200);

    assert_eq!((spendable, savings), (140, 60));
    // Spendable lands in the recipient's wallet right away.
    assert_eq!(h.token.balance(&recipient), 140);
    // Only the savings stay in the contract.
    assert_eq!(h.client.savings(&recipient), 60);
    assert_eq!(h.token.balance(&h.client.address), 60);
    assert_eq!(h.token.balance(&sender), 0);
}

#[test]
fn custom_split_is_respected() {
    let h = setup();
    let (sender, recipient) = h.parties(1000);

    // Recipient wants 90% spendable, 10% saved.
    h.client.set_split(&recipient, &9000);
    assert_eq!(h.client.get_split(&recipient), 9000);

    let (spendable, savings) = h.client.receive(&sender, &recipient, &1000);
    assert_eq!((spendable, savings), (900, 100));
}

#[test]
fn full_spendable_split_keeps_nothing_in_custody() {
    let h = setup();
    let (sender, recipient) = h.parties(500);
    h.client.set_split(&recipient, &10_000);

    h.client.receive(&sender, &recipient, &500);

    assert_eq!(h.token.balance(&recipient), 500);
    assert_eq!(h.client.savings(&recipient), 0);
    assert_eq!(h.token.balance(&h.client.address), 0);
}

#[test]
fn full_savings_split_sends_nothing_to_wallet() {
    let h = setup();
    let (sender, recipient) = h.parties(500);
    h.client.set_split(&recipient, &0);

    h.client.receive(&sender, &recipient, &500);

    assert_eq!(h.token.balance(&recipient), 0);
    assert_eq!(h.client.savings(&recipient), 500);
}

#[test]
fn savings_accumulate_across_remittances() {
    let h = setup();
    let (sender, recipient) = h.parties(300);

    h.client.receive(&sender, &recipient, &100);
    h.client.receive(&sender, &recipient, &200);

    assert_eq!(h.token.balance(&recipient), 210);
    assert_eq!(h.client.savings(&recipient), 90);
}

#[test]
#[should_panic(expected = "Error(Contract, #3)")]
fn receive_rejects_zero_amount() {
    let h = setup();
    let (sender, recipient) = h.parties(10);
    h.client.receive(&sender, &recipient, &0);
}

#[test]
fn withdraw_savings_returns_funds_to_recipient() {
    let h = setup();
    let (sender, recipient) = h.parties(200);
    h.client.receive(&sender, &recipient, &200);

    let remaining = h.client.withdraw_savings(&recipient, &50);

    assert_eq!(remaining, 10);
    assert_eq!(h.client.savings(&recipient), 10);
    assert_eq!(h.token.balance(&recipient), 190);
    assert_eq!(h.token.balance(&h.client.address), 10);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn withdraw_savings_over_balance_fails() {
    let h = setup();
    let (sender, recipient) = h.parties(200);
    h.client.receive(&sender, &recipient, &200);

    // Savings are only 60.
    h.client.withdraw_savings(&recipient, &61);
}

#[test]
fn recipients_cannot_touch_each_others_savings() {
    let h = setup();
    let (sender, alice) = h.parties(400);
    let bob = Address::generate(&h.env);
    h.client.receive(&sender, &alice, &200);
    h.client.receive(&sender, &bob, &200);

    h.client.withdraw_savings(&alice, &60);

    assert_eq!(h.client.savings(&alice), 0);
    assert_eq!(h.client.savings(&bob), 60);
    assert_eq!(h.token.balance(&h.client.address), 60);
}

#[test]
fn receive_requires_the_senders_signature() {
    let h = setup();
    let (sender, recipient) = h.parties(100);
    h.client.receive(&sender, &recipient, &100);

    let auths = h.env.auths();
    assert_eq!(auths.len(), 1);
    assert_eq!(auths[0].0, sender);
}

#[test]
fn withdraw_requires_the_recipients_signature() {
    let h = setup();
    let (sender, recipient) = h.parties(100);
    h.client.receive(&sender, &recipient, &100);
    h.client.withdraw_savings(&recipient, &10);

    let auths = h.env.auths();
    assert_eq!(auths.len(), 1);
    assert_eq!(auths[0].0, recipient);
}

#[test]
#[should_panic(expected = "Error(Contract, #2)")]
fn split_above_100_percent_fails() {
    let h = setup();
    let recipient = Address::generate(&h.env);
    h.client.set_split(&recipient, &10_001);
}

#[test]
fn receive_emits_funds_received_event() {
    let h = setup();
    let (sender, recipient) = h.parties(200);
    h.client.receive(&sender, &recipient, &200);

    assert!(
        !h.env.events().all().is_empty(),
        "expected at least one event after receive()",
    );
}

#[test]
fn position_reports_full_state() {
    let h = setup();
    let (sender, recipient) = h.parties(200);
    h.client.receive(&sender, &recipient, &200);

    let pos = h.client.position(&recipient);
    assert_eq!(
        pos,
        Position {
            spendable_bps: 7000,
            savings: 60,
        }
    );
}

// ── Beta guardrails ─────────────────────────────────────────────────────────

#[test]
fn savings_over_the_cap_go_to_the_wallet() {
    let h = setup();
    let (sender, recipient) = h.parties(10_000);
    h.client.set_split(&recipient, &0);
    h.client.receive(&sender, &recipient, &(CAP - 100));

    // Only 100 of room left: the rest of this all-savings remittance is paid out.
    let (spendable, savings) = h.client.receive(&sender, &recipient, &300);

    assert_eq!((spendable, savings), (200, 100));
    assert_eq!(h.client.savings(&recipient), CAP);
    assert_eq!(h.token.balance(&recipient), 200);
}

#[test]
fn a_lowered_cap_never_blocks_a_remittance() {
    let h = setup();
    let (sender, recipient) = h.parties(10_000);
    h.client.set_split(&recipient, &0);
    h.client.receive(&sender, &recipient, &CAP);
    h.client.set_user_cap(&100);

    // Savings are already above the new cap, so all of it goes to the wallet.
    let (spendable, savings) = h.client.receive(&sender, &recipient, &50);

    assert_eq!((spendable, savings), (50, 0));
    assert_eq!(h.client.savings(&recipient), CAP);
}

#[test]
fn cap_only_counts_savings() {
    let h = setup();
    let (sender, recipient) = h.parties(10_000);

    // 70/30 of 3000 saves 900, under the 1000 cap; the 2100 spendable is not held.
    h.client.receive(&sender, &recipient, &3000);
    assert_eq!(h.client.savings(&recipient), 900);
}

#[test]
fn withdrawing_frees_room_under_the_cap() {
    let h = setup();
    let (sender, recipient) = h.parties(10_000);
    h.client.set_split(&recipient, &0);
    h.client.receive(&sender, &recipient, &CAP);

    h.client.withdraw_savings(&recipient, &400);
    h.client.receive(&sender, &recipient, &400);

    assert_eq!(h.client.savings(&recipient), CAP);
}

#[test]
#[should_panic(expected = "Error(Contract, #6)")]
fn paused_contract_rejects_deposits() {
    let h = setup();
    let (sender, recipient) = h.parties(100);
    h.client.set_paused(&true);
    h.client.receive(&sender, &recipient, &100);
}

#[test]
fn paused_contract_still_allows_withdrawals() {
    let h = setup();
    let (sender, recipient) = h.parties(200);
    h.client.receive(&sender, &recipient, &200);
    h.client.set_paused(&true);

    h.client.withdraw_savings(&recipient, &60);

    assert_eq!(h.token.balance(&recipient), 200);
}

#[test]
#[should_panic(expected = "Error(Contract, #7)")]
fn cap_must_be_positive() {
    let h = setup();
    h.client.set_user_cap(&0);
}

#[test]
fn admin_actions_require_the_admins_signature() {
    let h = setup();

    h.client.set_user_cap(&5_000);
    assert_eq!(h.env.auths()[0].0, h.admin);

    h.client.set_paused(&true);
    assert_eq!(h.env.auths()[0].0, h.admin);
}

#[test]
fn config_reports_settings() {
    let h = setup();
    h.client.set_user_cap(&2_500);
    h.client.set_paused(&true);

    let cfg = h.client.config();
    assert_eq!(cfg.admin, h.admin);
    assert_eq!(cfg.token, h.token.address);
    assert_eq!(cfg.user_cap, 2_500);
    assert!(cfg.paused);
}

// ── Deployment and storage lifetime ─────────────────────────────────────────

#[test]
#[should_panic(expected = "Error(Contract, #7)")]
fn constructor_rejects_a_non_positive_cap() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let token = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    env.register(YieldSplitter, (admin, token, 0_i128));
}

#[test]
fn recipient_entries_get_a_long_ttl() {
    let h = setup();
    let (sender, recipient) = h.parties(200);
    h.client.set_split(&recipient, &5000);
    h.client.receive(&sender, &recipient, &200);

    h.env.as_contract(&h.client.address, || {
        let store = h.env.storage().persistent();
        assert!(store.get_ttl(&DataKey::Savings(recipient.clone())) >= USER_TTL_THRESHOLD);
        assert!(store.get_ttl(&DataKey::Split(recipient.clone())) >= USER_TTL_THRESHOLD);
        assert!(h.env.storage().instance().get_ttl() > 0);
    });
}

#[test]
fn emptied_savings_are_removed_from_storage() {
    let h = setup();
    let (sender, recipient) = h.parties(200);
    h.client.receive(&sender, &recipient, &200);
    h.client.withdraw_savings(&recipient, &60);

    h.env.as_contract(&h.client.address, || {
        assert!(!h
            .env
            .storage()
            .persistent()
            .has(&DataKey::Savings(recipient.clone())));
    });
    assert_eq!(h.client.savings(&recipient), 0);
}

#[test]
fn split_rounding_favors_savings() {
    // 70% of 3 is 2.1: spendable is floored, savings keeps the remainder.
    assert_eq!(split_amount(3, 7000), Some((2, 1)));
    assert_eq!(split_amount(1, 9999), Some((0, 1)));
    assert_eq!(split_amount(10, 10_000), Some((10, 0)));
    assert_eq!(split_amount(10, 0), Some((0, 10)));
    assert_eq!(split_amount(i128::MAX, 7000), None);
}

// ── deposit_savings ─────────────────────────────────────────────────────────

#[test]
fn deposit_savings_moves_own_funds_into_savings() {
    let h = setup();
    let user = Address::generate(&h.env);
    h.token_admin.mint(&user, &500);

    let total = h.client.deposit_savings(&user, &200);

    assert_eq!(total, 200);
    assert_eq!(h.client.savings(&user), 200);
    assert_eq!(h.token.balance(&user), 300);
    assert_eq!(h.token.balance(&h.client.address), 200);
}

#[test]
fn deposit_savings_adds_to_remittance_savings_and_can_be_withdrawn() {
    let h = setup();
    let (sender, recipient) = h.parties(200);
    h.client.receive(&sender, &recipient, &200); // saves 60
    h.token_admin.mint(&recipient, &40);

    assert_eq!(h.client.deposit_savings(&recipient, &40), 100);

    h.client.withdraw_savings(&recipient, &100);
    assert_eq!(h.client.savings(&recipient), 0);
    assert_eq!(h.token.balance(&recipient), 240);
}

#[test]
fn deposit_savings_requires_the_users_signature() {
    let h = setup();
    let user = Address::generate(&h.env);
    h.token_admin.mint(&user, &50);
    h.client.deposit_savings(&user, &50);

    let auths = h.env.auths();
    assert_eq!(auths.len(), 1);
    assert_eq!(auths[0].0, user);
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn deposit_savings_respects_the_cap() {
    let h = setup();
    let user = Address::generate(&h.env);
    h.token_admin.mint(&user, &5_000);
    h.client.deposit_savings(&user, &(CAP + 1));
}

#[test]
#[should_panic(expected = "Error(Contract, #6)")]
fn deposit_savings_is_blocked_while_paused() {
    let h = setup();
    let user = Address::generate(&h.env);
    h.token_admin.mint(&user, &50);
    h.client.set_paused(&true);
    h.client.deposit_savings(&user, &50);
}

#[test]
#[should_panic(expected = "Error(Contract, #3)")]
fn deposit_savings_rejects_zero() {
    let h = setup();
    let user = Address::generate(&h.env);
    h.client.deposit_savings(&user, &0);
}

// ── pay_from_savings ────────────────────────────────────────────────────────

#[test]
fn pay_from_savings_sends_straight_to_the_payee() {
    let h = setup();
    let (sender, recipient) = h.parties(200);
    let school = Address::generate(&h.env);
    h.client.receive(&sender, &recipient, &200); // saves 60

    let remaining = h.client.pay_from_savings(&recipient, &school, &45);

    assert_eq!(remaining, 15);
    assert_eq!(h.client.savings(&recipient), 15);
    assert_eq!(h.token.balance(&school), 45);
    // The recipient's wallet only ever got the spendable part.
    assert_eq!(h.token.balance(&recipient), 140);
    assert_eq!(h.token.balance(&h.client.address), 15);
}

#[test]
fn pay_from_savings_requires_the_savers_signature() {
    let h = setup();
    let (sender, recipient) = h.parties(200);
    let school = Address::generate(&h.env);
    h.client.receive(&sender, &recipient, &200);
    h.client.pay_from_savings(&recipient, &school, &10);

    let auths = h.env.auths();
    assert_eq!(auths.len(), 1);
    assert_eq!(auths[0].0, recipient);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn pay_from_savings_cannot_spend_more_than_saved() {
    let h = setup();
    let (sender, recipient) = h.parties(200);
    let school = Address::generate(&h.env);
    h.client.receive(&sender, &recipient, &200);
    h.client.pay_from_savings(&recipient, &school, &61);
}

#[test]
#[should_panic(expected = "Error(Contract, #3)")]
fn pay_from_savings_rejects_zero() {
    let h = setup();
    let recipient = Address::generate(&h.env);
    let school = Address::generate(&h.env);
    h.client.pay_from_savings(&recipient, &school, &0);
}

#[test]
fn pay_from_savings_still_works_while_paused() {
    let h = setup();
    let (sender, recipient) = h.parties(200);
    let school = Address::generate(&h.env);
    h.client.receive(&sender, &recipient, &200);
    h.client.set_paused(&true);

    h.client.pay_from_savings(&recipient, &school, &60);

    assert_eq!(h.token.balance(&school), 60);
}

// ── send_batch ──────────────────────────────────────────────────────────────

fn pay(to: &Address, amount: i128) -> Payment {
    Payment {
        to: to.clone(),
        amount,
    }
}

#[test]
fn send_batch_splits_each_payment_by_its_recipients_ratio() {
    let h = setup();
    let (sender, mom) = h.parties(1_000);
    let sister = Address::generate(&h.env);
    h.client.set_split(&sister, &10_000); // sister keeps everything spendable

    let total = h.client.send_batch(
        &sender,
        &soroban_sdk::vec![&h.env, pay(&mom, 200), pay(&sister, 100)],
    );

    assert_eq!(total, 300);
    assert_eq!(h.token.balance(&mom), 140);
    assert_eq!(h.client.savings(&mom), 60);
    assert_eq!(h.token.balance(&sister), 100);
    assert_eq!(h.client.savings(&sister), 0);
    assert_eq!(h.token.balance(&sender), 700);
}

#[test]
fn send_batch_needs_only_the_senders_signature() {
    let h = setup();
    let (sender, mom) = h.parties(1_000);
    let sister = Address::generate(&h.env);
    h.client.send_batch(
        &sender,
        &soroban_sdk::vec![&h.env, pay(&mom, 10), pay(&sister, 10)],
    );

    let auths = h.env.auths();
    assert_eq!(auths.len(), 1);
    assert_eq!(auths[0].0, sender);
}

#[test]
#[should_panic(expected = "Error(Contract, #11)")]
fn send_batch_rejects_an_empty_list() {
    let h = setup();
    let sender = Address::generate(&h.env);
    h.client.send_batch(&sender, &soroban_sdk::vec![&h.env]);
}

#[test]
#[should_panic(expected = "Error(Contract, #11)")]
fn send_batch_rejects_too_many_payments() {
    let h = setup();
    let (sender, mom) = h.parties(1_000);
    let mut payments = soroban_sdk::Vec::new(&h.env);
    for _ in 0..(MAX_BATCH + 1) {
        payments.push_back(pay(&mom, 1));
    }
    h.client.send_batch(&sender, &payments);
}

#[test]
#[should_panic(expected = "Error(Contract, #3)")]
fn send_batch_is_all_or_nothing() {
    let h = setup();
    let (sender, mom) = h.parties(1_000);
    // The second payment is invalid, so the first one must not land either.
    h.client.send_batch(
        &sender,
        &soroban_sdk::vec![&h.env, pay(&mom, 100), pay(&mom, 0)],
    );
}

// ── recurring remittances ───────────────────────────────────────────────────

const HOUR: u64 = 3_600;

/// A sender with funds who approved the contract for `allowance`.
fn approved_sender(h: &Harness, funds: i128, allowance: i128) -> Address {
    let sender = Address::generate(&h.env);
    h.token_admin.mint(&sender, &funds);
    h.token
        .approve(&sender, &h.client.address, &allowance, &10_000);
    sender
}

fn advance(h: &Harness, seconds: u64) {
    h.env.ledger().with_mut(|l| l.timestamp += seconds);
}

#[test]
fn schedule_runs_the_split_and_counts_down() {
    let h = setup();
    let sender = approved_sender(&h, 1_000, 300);
    let mom = Address::generate(&h.env);
    let id = h.client.create_schedule(&sender, &mom, &100, &HOUR, &3);

    // First run is due right away; anyone can trigger it.
    assert_eq!(h.client.run_schedule(&id), (70, 30));
    assert_eq!(h.token.balance(&mom), 70);
    assert_eq!(h.client.savings(&mom), 30);
    assert_eq!(h.client.schedule(&id).unwrap().runs_left, 2);

    advance(&h, HOUR);
    h.client.run_schedule(&id);
    advance(&h, HOUR);
    h.client.run_schedule(&id);

    assert_eq!(h.token.balance(&sender), 700);
    assert_eq!(h.token.balance(&mom), 210);
    // Out of runs: the schedule is gone and so is the allowance.
    assert_eq!(h.client.schedule(&id), None);
    assert_eq!(h.token.allowance(&sender, &h.client.address), 0);
}

#[test]
fn running_a_schedule_needs_no_signature() {
    let h = setup();
    let sender = approved_sender(&h, 1_000, 100);
    let mom = Address::generate(&h.env);
    let id = h.client.create_schedule(&sender, &mom, &100, &HOUR, &1);

    h.client.run_schedule(&id);

    assert!(h.env.auths().is_empty());
}

#[test]
#[should_panic(expected = "Error(Contract, #9)")]
fn schedule_cannot_run_before_it_is_due() {
    let h = setup();
    let sender = approved_sender(&h, 1_000, 300);
    let mom = Address::generate(&h.env);
    let id = h.client.create_schedule(&sender, &mom, &100, &HOUR, &3);
    h.client.run_schedule(&id);
    advance(&h, HOUR - 1);
    h.client.run_schedule(&id);
}

#[test]
fn a_late_run_does_not_let_missed_periods_stack_up() {
    let h = setup();
    let sender = approved_sender(&h, 1_000, 300);
    let mom = Address::generate(&h.env);
    let id = h.client.create_schedule(&sender, &mom, &100, &HOUR, &3);
    h.client.run_schedule(&id);

    advance(&h, 5 * HOUR); // keeper was down for a while
    h.client.run_schedule(&id);

    // Only one more run went through; the next is an interval from now.
    assert!(h.client.try_run_schedule(&id).is_err());
    assert_eq!(h.token.balance(&mom), 140);
}

#[test]
fn only_the_sender_can_cancel_a_schedule() {
    let h = setup();
    let sender = approved_sender(&h, 1_000, 300);
    let mom = Address::generate(&h.env);
    let id = h.client.create_schedule(&sender, &mom, &100, &HOUR, &3);

    h.client.cancel_schedule(&id);

    assert_eq!(h.env.auths()[0].0, sender);
    assert_eq!(h.client.schedule(&id), None);
}

#[test]
#[should_panic(expected = "Error(Contract, #10)")]
fn schedule_interval_has_a_floor() {
    let h = setup();
    let sender = Address::generate(&h.env);
    let mom = Address::generate(&h.env);
    h.client
        .create_schedule(&sender, &mom, &100, &(MIN_INTERVAL - 1), &3);
}

#[test]
fn schedule_stops_when_the_sender_revokes_the_allowance() {
    let h = setup();
    let sender = approved_sender(&h, 1_000, 300);
    let mom = Address::generate(&h.env);
    let id = h.client.create_schedule(&sender, &mom, &100, &HOUR, &3);
    h.token.approve(&sender, &h.client.address, &0, &10_000);

    assert!(h.client.try_run_schedule(&id).is_err());
    assert_eq!(h.token.balance(&mom), 0);
}

// ── conditional remittances (pledges) ───────────────────────────────────────

const DAY: u64 = 86_400;

struct PledgeSetup {
    sender: Address,
    mom: Address,
    school: Address,
    id: u64,
}

/// Sender pledges 300 for mom to pay the school within a week.
fn pledged(h: &Harness) -> PledgeSetup {
    let sender = Address::generate(&h.env);
    let mom = Address::generate(&h.env);
    let school = Address::generate(&h.env);
    h.token_admin.mint(&sender, &1_000);
    let expires = h.env.ledger().timestamp() + 7 * DAY;
    let id = h
        .client
        .create_pledge(&sender, &mom, &school, &300, &expires);
    PledgeSetup {
        sender,
        mom,
        school,
        id,
    }
}

#[test]
fn create_pledge_holds_the_funds_apart_from_savings() {
    let h = setup();
    let p = pledged(&h);

    assert_eq!(h.token.balance(&p.sender), 700);
    assert_eq!(h.token.balance(&h.client.address), 300);
    assert_eq!(h.client.savings(&p.mom), 0);
    assert_eq!(h.client.pledge(&p.id).unwrap().amount, 300);
}

#[test]
fn the_beneficiary_releases_the_pledge_to_the_payee() {
    let h = setup();
    let p = pledged(&h);

    h.client.release_pledge(&p.id);

    assert_eq!(h.env.auths()[0].0, p.mom);
    assert_eq!(h.token.balance(&p.school), 300);
    assert_eq!(h.token.balance(&p.mom), 0); // never passes through mom's wallet
    assert_eq!(h.client.pledge(&p.id), None);
}

#[test]
#[should_panic(expected = "Error(Contract, #13)")]
fn an_expired_pledge_can_no_longer_be_released() {
    let h = setup();
    let p = pledged(&h);
    h.env.ledger().with_mut(|l| l.timestamp += 7 * DAY + 1);
    h.client.release_pledge(&p.id);
}

#[test]
fn the_sender_gets_an_unused_pledge_back_after_it_expires() {
    let h = setup();
    let p = pledged(&h);
    h.env.ledger().with_mut(|l| l.timestamp += 7 * DAY + 1);

    h.client.refund_pledge(&p.id);

    assert_eq!(h.env.auths()[0].0, p.sender);
    assert_eq!(h.token.balance(&p.sender), 1_000);
    assert_eq!(h.client.pledge(&p.id), None);
}

#[test]
#[should_panic(expected = "Error(Contract, #14)")]
fn a_pledge_cannot_be_refunded_before_it_expires() {
    let h = setup();
    let p = pledged(&h);
    h.client.refund_pledge(&p.id);
}

#[test]
#[should_panic(expected = "Error(Contract, #12)")]
fn a_released_pledge_cannot_be_refunded_or_released_again() {
    let h = setup();
    let p = pledged(&h);
    h.client.release_pledge(&p.id);
    h.client.release_pledge(&p.id);
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn a_pledge_is_capped_like_savings() {
    let h = setup();
    let sender = Address::generate(&h.env);
    let mom = Address::generate(&h.env);
    h.token_admin.mint(&sender, &5_000);
    h.client
        .create_pledge(&sender, &mom, &mom, &(CAP + 1), &DAY);
}

#[test]
#[should_panic(expected = "Error(Contract, #15)")]
fn a_pledge_must_expire_in_the_future() {
    let h = setup();
    let sender = Address::generate(&h.env);
    let mom = Address::generate(&h.env);
    h.token_admin.mint(&sender, &100);
    h.client
        .create_pledge(&sender, &mom, &mom, &100, &h.env.ledger().timestamp());
}

#[test]
fn pledges_can_be_released_while_deposits_are_paused() {
    let h = setup();
    let p = pledged(&h);
    h.client.set_paused(&true);

    h.client.release_pledge(&p.id);

    assert_eq!(h.token.balance(&p.school), 300);
}

// ── recover_token ───────────────────────────────────────────────────────────

#[test]
fn the_admin_returns_a_token_sent_by_mistake() {
    let h = setup();
    let other = StellarAssetClient::new(
        &h.env,
        &h.env
            .register_stellar_asset_contract_v2(h.admin.clone())
            .address(),
    );
    let other_token = token::Client::new(&h.env, &other.address);
    let sender = Address::generate(&h.env);
    other.mint(&h.client.address, &50); // landed here by mistake

    h.client.recover_token(&other.address, &sender, &50);

    assert_eq!(h.env.auths()[0].0, h.admin);
    assert_eq!(other_token.balance(&sender), 50);
    assert_eq!(other_token.balance(&h.client.address), 0);
}

#[test]
#[should_panic(expected = "Error(Contract, #16)")]
fn recover_token_can_never_touch_users_usdc() {
    let h = setup();
    let (sender, recipient) = h.parties(200);
    h.client.receive(&sender, &recipient, &200);
    h.client.recover_token(&h.token.address, &h.admin, &60);
}

// ── Mainnet review fixes ────────────────────────────────────────────────────

#[test]
fn a_capped_recipient_does_not_sink_a_batch() {
    let h = setup();
    let (sender, full) = h.parties(10_000);
    let other = Address::generate(&h.env);
    h.client.set_split(&full, &0);
    h.client.receive(&sender, &full, &CAP);

    let total = h.client.send_batch(
        &sender,
        &soroban_sdk::vec![&h.env, pay(&full, 100), pay(&other, 100)],
    );

    assert_eq!(total, 200);
    assert_eq!(h.token.balance(&full), 100);
    assert_eq!(h.client.savings(&other), 30);
}

#[test]
#[should_panic(expected = "Error(Contract, #3)")]
fn an_amount_too_large_to_split_is_a_typed_error() {
    let h = setup();
    let (sender, recipient) = h.parties(10);
    h.client.receive(&sender, &recipient, &i128::MAX);
}

#[test]
#[should_panic(expected = "Error(Contract, #17)")]
fn the_contract_cannot_receive_a_remittance() {
    let h = setup();
    let (sender, _) = h.parties(100);
    h.client.receive(&sender, &h.client.address, &100);
}

#[test]
#[should_panic(expected = "Error(Contract, #17)")]
fn savings_cannot_be_paid_to_the_contract() {
    let h = setup();
    let (sender, recipient) = h.parties(200);
    h.client.receive(&sender, &recipient, &200);
    h.client
        .pay_from_savings(&recipient, &h.client.address, &10);
}

#[test]
#[should_panic(expected = "Error(Contract, #17)")]
fn the_contract_cannot_be_a_pledge_payee() {
    let h = setup();
    let sender = Address::generate(&h.env);
    let mom = Address::generate(&h.env);
    h.token_admin.mint(&sender, &100);
    h.client
        .create_pledge(&sender, &mom, &h.client.address, &100, &DAY);
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn open_pledges_for_one_person_are_capped_together() {
    let h = setup();
    let sender = Address::generate(&h.env);
    let mom = Address::generate(&h.env);
    let school = Address::generate(&h.env);
    h.token_admin.mint(&sender, &5_000);
    h.client.create_pledge(&sender, &mom, &school, &600, &DAY);
    h.client.create_pledge(&sender, &mom, &school, &401, &DAY);
}

#[test]
fn settling_a_pledge_frees_room_under_the_cap() {
    let h = setup();
    let sender = Address::generate(&h.env);
    let mom = Address::generate(&h.env);
    let school = Address::generate(&h.env);
    h.token_admin.mint(&sender, &5_000);
    let first = h.client.create_pledge(&sender, &mom, &school, &CAP, &DAY);

    h.client.release_pledge(&first);
    let second = h
        .client
        .create_pledge(&sender, &mom, &school, &CAP, &(2 * DAY));
    advance(&h, 3 * DAY);
    h.client.refund_pledge(&second);
    h.client
        .create_pledge(&sender, &mom, &school, &CAP, &(10 * DAY));

    assert_eq!(h.token.balance(&school), CAP);
}

#[test]
#[should_panic(expected = "Error(Contract, #15)")]
fn a_pledge_cannot_stay_open_past_100_days() {
    let h = setup();
    let sender = Address::generate(&h.env);
    let mom = Address::generate(&h.env);
    h.token_admin.mint(&sender, &100);
    let expires = h.env.ledger().timestamp() + MAX_PLEDGE_DURATION + 1;
    h.client.create_pledge(&sender, &mom, &mom, &100, &expires);
}

#[test]
#[should_panic(expected = "Error(Contract, #10)")]
fn schedule_interval_has_a_ceiling() {
    let h = setup();
    let sender = approved_sender(&h, 1_000, 1_000);
    let mom = Address::generate(&h.env);
    h.client
        .create_schedule(&sender, &mom, &10, &(MAX_INTERVAL + 1), &1);
}

#[test]
#[should_panic(expected = "Error(Contract, #10)")]
fn a_schedule_cannot_outlive_one_allowance() {
    let h = setup();
    let sender = approved_sender(&h, 1_000, 1_000);
    let mom = Address::generate(&h.env);
    // 26 weekly runs span 175 days, past the 170-day limit.
    h.client
        .create_schedule(&sender, &mom, &10, &(7 * DAY), &26);
}

#[test]
fn a_weekly_schedule_of_25_runs_fits() {
    let h = setup();
    let sender = approved_sender(&h, 1_000, 1_000);
    let mom = Address::generate(&h.env);
    // 25 weekly runs span 168 days.
    let id = h
        .client
        .create_schedule(&sender, &mom, &10, &(7 * DAY), &25);
    assert_eq!(h.client.schedule(&id).unwrap().runs_left, 25);
}

#[test]
#[should_panic(expected = "Error(Contract, #6)")]
fn schedules_cannot_be_created_while_paused() {
    let h = setup();
    let sender = approved_sender(&h, 1_000, 1_000);
    let mom = Address::generate(&h.env);
    h.client.set_paused(&true);
    h.client
        .create_schedule(&sender, &mom, &10, &MIN_INTERVAL, &2);
}

#[test]
#[should_panic(expected = "Error(Contract, #17)")]
fn the_contract_cannot_be_a_schedule_recipient() {
    let h = setup();
    let sender = approved_sender(&h, 1_000, 1_000);
    h.client
        .create_schedule(&sender, &h.client.address, &10, &MIN_INTERVAL, &2);
}

// ── upgrade ─────────────────────────────────────────────────────────────────
//
// Needs real wasm to swap in, so it runs with the `upgrade-test` feature after
// a build: `bun run test:upgrade` (CI does the same).

#[cfg(feature = "upgrade-test")]
mod upgrade {
    use super::*;
    use soroban_sdk::{testutils::MockAuth, testutils::MockAuthInvoke, IntoVal};

    const WASM: &[u8] = include_bytes!("../../../target/wasm32v1-none/release/yield_splitter.wasm");

    #[test]
    fn admin_can_upgrade_and_state_survives() {
        let h = setup();
        let (sender, recipient) = h.parties(200);
        h.client.receive(&sender, &recipient, &200);
        let hash = h.env.deployer().upload_contract_wasm(WASM);

        h.client.upgrade(&hash);

        assert_eq!(h.env.auths()[0].0, h.admin);
        // The swapped-in code still sees the same settings and balances.
        assert_eq!(h.client.config().admin, h.admin);
        assert_eq!(h.client.savings(&recipient), 60);
    }

    #[test]
    fn upgrade_emits_an_event() {
        let h = setup();
        let hash = h.env.deployer().upload_contract_wasm(WASM);
        h.client.upgrade(&hash);
        assert!(!h.env.events().all().is_empty());
    }

    /// A full batch to distinct recipients, on the real wasm, stays well
    /// inside mainnet's per-transaction CPU limit (100M instructions).
    #[test]
    fn a_full_batch_fits_the_mainnet_budget() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let sac = env.register_stellar_asset_contract_v2(admin.clone());
        let token_admin = StellarAssetClient::new(&env, &sac.address());
        let id = env.register(WASM, (admin, sac.address(), CAP));
        let client = YieldSplitterClient::new(&env, &id);
        let sender = Address::generate(&env);
        token_admin.mint(&sender, &10_000);
        let mut payments = Vec::new(&env);
        for _ in 0..MAX_BATCH {
            payments.push_back(pay(&Address::generate(&env), 100));
        }

        env.cost_estimate().budget().reset_default();
        assert_eq!(client.send_batch(&sender, &payments), 1_000);
        let cpu = env.cost_estimate().budget().cpu_instruction_cost();
        assert!(
            cpu < 100_000_000,
            "batch of {MAX_BATCH} used {cpu} instructions"
        );
    }

    #[test]
    fn a_stranger_cannot_upgrade() {
        let h = setup();
        let hash = h.env.deployer().upload_contract_wasm(WASM);
        let stranger = Address::generate(&h.env);

        h.env.mock_auths(&[MockAuth {
            address: &stranger,
            invoke: &MockAuthInvoke {
                contract: &h.client.address,
                fn_name: "upgrade",
                args: (hash.clone(),).into_val(&h.env),
                sub_invokes: &[],
            },
        }]);
        assert!(h.client.try_upgrade(&hash).is_err());

        // The same, valid hash goes through once the admin signs.
        h.env.mock_all_auths();
        h.client.upgrade(&hash);
    }
}
