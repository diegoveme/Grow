import { mapPayment } from './activity';

const SENDER = 'GSENDER';
const RECIPIENT = 'GRECIPIENT';
const SPLITTER = 'CSPLITTER';

/** A Grow remittance as Horizon's payments endpoint reports it. */
const remittance = {
  id: '1',
  type: 'invoke_host_function',
  created_at: '2026-11-25T00:11:02Z',
  transaction_hash: 'abc',
  asset_balance_changes: [
    { asset_type: 'credit_alphanum4', asset_code: 'USDC', from: SENDER, to: RECIPIENT, amount: '70.0000000' },
    { asset_type: 'credit_alphanum4', asset_code: 'USDC', from: SENDER, to: SPLITTER, amount: '30.0000000' },
  ],
};

describe('mapPayment', () => {
  it('shows the recipient only what reached their wallet', () => {
    expect(mapPayment(remittance, RECIPIENT)).toMatchObject({
      direction: 'in',
      amount: '70.0000000',
      asset: 'USDC',
      from: SENDER,
      to: RECIPIENT,
    });
  });

  it('shows the sender one outgoing payment for the full amount, to the recipient', () => {
    expect(mapPayment(remittance, SENDER)).toMatchObject({
      direction: 'out',
      amount: '100.0000000',
      to: RECIPIENT,
    });
  });

  it('skips contract calls that move no tokens for the viewer', () => {
    expect(mapPayment({ ...remittance, asset_balance_changes: [] }, RECIPIENT)).toBeNull();
  });

  it('maps classic payments and account creations', () => {
    const payment = {
      id: '2',
      type: 'payment',
      asset_type: 'native',
      from: SENDER,
      to: RECIPIENT,
      amount: '1.0000000',
      created_at: 'x',
      transaction_hash: 'h',
    };
    expect(mapPayment(payment, SENDER)).toMatchObject({ direction: 'out', asset: 'XLM' });
    const created = {
      id: '3',
      type: 'create_account',
      funder: SENDER,
      account: RECIPIENT,
      starting_balance: '5',
      created_at: 'x',
      transaction_hash: 'h',
    };
    expect(mapPayment(created, RECIPIENT)).toMatchObject({ direction: 'in', amount: '5' });
  });

  it('ignores operation types the feed does not show', () => {
    expect(mapPayment({ type: 'path_payment_strict_send' }, SENDER)).toBeNull();
  });
});
