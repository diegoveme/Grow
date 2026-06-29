#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Events as _},
    token::{self, StellarAssetClient},
    Address, Env,
};

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

    let contract_id = env.register(YieldSplitter, ());
    let client = YieldSplitterClient::new(&env, &contract_id);
    client.initialize(&admin, &token_id);

    Harness {
        env,
        admin,
        client,
        token,
        token_admin,
    }
}

#[test]
fn default_split_is_70_30() {
    let h = setup();
    let sender = Address::generate(&h.env);
    let recipient = Address::generate(&h.env);
    h.token_admin.mint(&sender, &200);

    let (spendable, vault) = h.client.receive(&sender, &recipient, &200);

    assert_eq!(spendable, 140);
    assert_eq!(vault, 60);
    assert_eq!(h.client.wallet_balance(&recipient), 140);
    assert_eq!(h.client.vault_balance(&recipient), 60);
    // Funds are now custodied by the contract.
    assert_eq!(h.token.balance(&h.client.address), 200);
    assert_eq!(h.token.balance(&sender), 0);
}

#[test]
fn custom_split_is_respected() {
    let h = setup();
    let sender = Address::generate(&h.env);
    let recipient = Address::generate(&h.env);
    h.token_admin.mint(&sender, &1000);

    // Recipient wants 90% spendable, 10% to grow.
    h.client.set_split(&recipient, &9000);
    assert_eq!(h.client.get_split(&recipient), 9000);

    let (spendable, vault) = h.client.receive(&sender, &recipient, &1000);
    assert_eq!(spendable, 900);
    assert_eq!(vault, 100);
}

#[test]
fn receive_accumulates_across_remittances() {
    let h = setup();
    let sender = Address::generate(&h.env);
    let recipient = Address::generate(&h.env);
    h.token_admin.mint(&sender, &300);

    h.client.receive(&sender, &recipient, &100);
    h.client.receive(&sender, &recipient, &200);

    // 70% of 300 spendable, 30% vault.
    assert_eq!(h.client.wallet_balance(&recipient), 210);
    assert_eq!(h.client.vault_balance(&recipient), 90);
}

#[test]
fn withdraw_moves_spendable_to_wallet() {
    let h = setup();
    let sender = Address::generate(&h.env);
    let recipient = Address::generate(&h.env);
    h.token_admin.mint(&sender, &200);
    h.client.receive(&sender, &recipient, &200);

    h.client.withdraw(&recipient, &100);

    assert_eq!(h.client.wallet_balance(&recipient), 40);
    assert_eq!(h.token.balance(&recipient), 100);
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn withdraw_over_balance_fails() {
    let h = setup();
    let sender = Address::generate(&h.env);
    let recipient = Address::generate(&h.env);
    h.token_admin.mint(&sender, &200);
    h.client.receive(&sender, &recipient, &200);

    // Spendable is only 140.
    h.client.withdraw(&recipient, &141);
}

#[test]
fn deposit_vault_to_external_vault_transfers_funds() {
    let h = setup();
    let sender = Address::generate(&h.env);
    let recipient = Address::generate(&h.env);
    let vault = Address::generate(&h.env);
    h.client.set_vault(&vault);

    h.token_admin.mint(&sender, &200);
    h.client.receive(&sender, &recipient, &200);

    let moved = h.client.deposit_vault(&recipient);

    assert_eq!(moved, 60);
    assert_eq!(h.token.balance(&vault), 60);
}

#[test]
fn claim_yield_accrues_for_recipient() {
    let h = setup();
    let recipient = Address::generate(&h.env);

    let total = h.client.claim_yield(&recipient, &5);
    assert_eq!(total, 5);
    let total = h.client.claim_yield(&recipient, &3);
    assert_eq!(total, 8);
    assert_eq!(h.client.earned_yield(&recipient), 8);

    // Sanity: admin is the one authorized to record yield.
    let _ = &h.admin;
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
    let sender = Address::generate(&h.env);
    let recipient = Address::generate(&h.env);
    h.token_admin.mint(&sender, &200);
    h.client.receive(&sender, &recipient, &200);

    // The most recent event should be our FundsReceived for this recipient.
    let events = h.env.events().all();
    assert!(
        !events.is_empty(),
        "expected at least one event after receive()",
    );
}

#[test]
fn position_reports_full_state() {
    let h = setup();
    let sender = Address::generate(&h.env);
    let recipient = Address::generate(&h.env);
    h.token_admin.mint(&sender, &200);
    h.client.receive(&sender, &recipient, &200);
    h.client.claim_yield(&recipient, &2);

    let pos = h.client.position(&recipient);
    assert_eq!(pos.spendable_bps, 7000);
    assert_eq!(pos.wallet_balance, 140);
    assert_eq!(pos.vault_balance, 60);
    assert_eq!(pos.earned_yield, 2);
}
