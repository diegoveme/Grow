#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Events as _},
    token::{self, StellarAssetClient},
    Address, Env,
};

struct Harness<'a> {
    env: Env,
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

    let contract_id = env.register(YieldSplitter, ());
    let client = YieldSplitterClient::new(&env, &contract_id);
    client.initialize(&admin, &token_id);

    Harness {
        env,
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
#[should_panic(expected = "Error(Contract, #4)")]
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
#[should_panic(expected = "Error(Contract, #5)")]
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
#[should_panic(expected = "Error(Contract, #3)")]
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
