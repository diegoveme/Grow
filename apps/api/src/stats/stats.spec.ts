import { Keypair, nativeToScVal, xdr } from '@stellar/stellar-sdk';
import { decodeEvent, type RawEvent, type SplitterEvent } from './events';
import { summarize } from './summary';

const sender = Keypair.random().publicKey();
const alice = Keypair.random().publicKey();
const bob = Keypair.random().publicKey();

function raw(name: string, subject: string, data: Record<string, unknown>, at: string): RawEvent {
  const topic = [nativeToScVal(name, { type: 'symbol' }), nativeToScVal(subject, { type: 'address' })];
  const value = xdr.ScVal.scvMap(
    Object.entries(data)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(
        ([k, v]) =>
          new xdr.ScMapEntry({
            key: nativeToScVal(k, { type: 'symbol' }),
            val:
              typeof v === 'bigint'
                ? nativeToScVal(v, { type: 'i128' })
                : nativeToScVal(v, { type: 'address' }),
          }),
      ),
  );
  return { id: `${name}-${at}`, ledger: 1, txHash: 'h', ledgerClosedAt: at, topic, value };
}

const received = (to: string, amount: bigint, at: string) =>
  raw('funds_received', to, { from: sender, amount, spendable: (amount * 7n) / 10n, savings: amount - (amount * 7n) / 10n }, at);

describe('decodeEvent', () => {
  it('flattens a funds_received event', () => {
    const e = decodeEvent(received(alice, 1_000_000_000n, '2026-11-25T00:11:02Z'));
    expect(e).toMatchObject({
      type: 'funds_received',
      account: alice,
      from: sender,
      amount: '1000000000',
      spendable: '700000000',
      savings: '300000000',
    });
  });

  it('ignores events it does not know', () => {
    expect(decodeEvent(raw('transfer', alice, { amount: 1n }, '2026-11-25T00:00:00Z'))).toBeNull();
  });
});

describe('summarize', () => {
  const events = [
    received(alice, 1_000_000_000n, '2026-11-24T10:00:00Z'),
    received(alice, 500_000_000n, '2026-11-25T09:00:00Z'),
    received(bob, 200_000_000n, '2026-11-25T11:00:00Z'),
    raw('savings_deposited', bob, { amount: 100_000_000n, total: 160_000_000n }, '2026-11-25T12:00:00Z'),
    raw('savings_withdrawn', alice, { amount: 300_000_000n, remaining: 150_000_000n }, '2026-11-25T13:00:00Z'),
  ]
    .map(decodeEvent)
    .filter((e): e is SplitterEvent => e !== null);

  it('adds up volume, the split and savings flows', () => {
    const s = summarize(events);
    expect(s.remittances).toBe(3);
    expect(s.volume).toBe('170.0000000');
    expect(s.paidToWallets).toBe('119.0000000');
    expect(s.savedFromRemittances).toBe('51.0000000');
    expect(s.setAside).toBe('10.0000000');
    expect(s.withdrawn).toBe('30.0000000');
  });

  it('counts unique people and groups volume by day', () => {
    const s = summarize(events);
    expect(s.uniqueSenders).toBe(1);
    expect(s.uniqueRecipients).toBe(2);
    expect(s.daily).toEqual([
      { date: '2026-11-24', remittances: 1, volume: '100.0000000' },
      { date: '2026-11-25', remittances: 2, volume: '70.0000000' },
    ]);
    expect(s.firstEventAt).toBe('2026-11-24T10:00:00.000Z');
  });

  it('is empty without events', () => {
    expect(summarize([])).toMatchObject({ remittances: 0, volume: '0.0000000', daily: [] });
  });
});
