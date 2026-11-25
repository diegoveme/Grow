import { fromStroops } from '@raiz/shared';
import type { SplitterEvent } from './events';

/** Daily remittance totals, oldest first. */
export interface DailyVolume {
  /** YYYY-MM-DD (UTC). */
  date: string;
  remittances: number;
  volume: string;
}

/** Usage of the yield_splitter contract, computed from its events. */
export interface UsageSummary {
  remittances: number;
  /** Total USDC sent through receive() (display units). */
  volume: string;
  /** Of which went straight to recipients' wallets. */
  paidToWallets: string;
  /** Of which was saved for recipients. */
  savedFromRemittances: string;
  /** USDC recipients set aside on their own with deposit_savings. */
  setAside: string;
  /** USDC withdrawn from savings. */
  withdrawn: string;
  /** USDC recipients paid to third parties straight from savings. */
  paidFromSavings: string;
  uniqueSenders: number;
  uniqueRecipients: number;
  /** Ledger close time of the first and last counted event. */
  firstEventAt: string | null;
  lastEventAt: string | null;
  daily: DailyVolume[];
}

const big = (v: string | null) => (v ? BigInt(v) : 0n);

/** Aggregate events into usage numbers. Pure; order of events doesn't matter. */
export function summarize(events: SplitterEvent[], days = 30): UsageSummary {
  let remittances = 0;
  let volume = 0n;
  let spendable = 0n;
  let saved = 0n;
  let setAside = 0n;
  let withdrawn = 0n;
  let paidFromSavings = 0n;
  const senders = new Set<string>();
  const recipients = new Set<string>();
  const perDay = new Map<string, { remittances: number; volume: bigint }>();
  let first: string | null = null;
  let last: string | null = null;

  for (const e of events) {
    if (!first || e.closedAt < first) first = e.closedAt;
    if (!last || e.closedAt > last) last = e.closedAt;
    switch (e.type) {
      case 'funds_received': {
        remittances += 1;
        volume += big(e.amount);
        spendable += big(e.spendable);
        saved += big(e.savings);
        if (e.from) senders.add(e.from);
        if (e.account) recipients.add(e.account);
        const day = e.closedAt.slice(0, 10);
        const d = perDay.get(day) ?? { remittances: 0, volume: 0n };
        d.remittances += 1;
        d.volume += big(e.amount);
        perDay.set(day, d);
        break;
      }
      case 'savings_deposited':
        setAside += big(e.amount);
        break;
      case 'savings_withdrawn':
        withdrawn += big(e.amount);
        break;
      case 'savings_spent':
        paidFromSavings += big(e.amount);
        break;
      default:
        break;
    }
  }

  const daily = [...perDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-days)
    .map(([date, d]) => ({ date, remittances: d.remittances, volume: fromStroops(d.volume, 7) }));

  return {
    remittances,
    volume: fromStroops(volume, 7),
    paidToWallets: fromStroops(spendable, 7),
    savedFromRemittances: fromStroops(saved, 7),
    setAside: fromStroops(setAside, 7),
    withdrawn: fromStroops(withdrawn, 7),
    paidFromSavings: fromStroops(paidFromSavings, 7),
    uniqueSenders: senders.size,
    uniqueRecipients: recipients.size,
    firstEventAt: first,
    lastEventAt: last,
    daily,
  };
}
