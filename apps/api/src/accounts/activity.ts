import { fromStroops, toStroops, type AssetCode } from '@raiz/shared';
import type { PaymentRecord } from './accounts.types';

/** A token movement inside a contract call, as Horizon reports it. */
export interface BalanceChange {
  asset_type: string;
  asset_code?: string;
  from?: string;
  to?: string;
  amount: string;
}

/**
 * Map one Horizon `payments` record to a feed entry for `viewer`, or null for
 * operation types the feed doesn't show. Pure: no I/O, easy to unit test.
 */
export function mapPayment(op: any, viewer: string): PaymentRecord | null {
  if (op.type === 'invoke_host_function') return mapContractTransfer(op, viewer);
  const from = op.from ?? op.funder ?? '';
  const to = op.to ?? op.account ?? '';
  const amount = op.amount ?? op.starting_balance ?? '0';
  let asset: AssetCode | string;
  if (op.type === 'payment') {
    asset = op.asset_type === 'native' ? 'XLM' : (op.asset_code ?? 'token');
  } else if (op.type === 'create_account') {
    asset = 'XLM';
  } else {
    return null; // ignore path payments / other op types for the simple feed
  }
  const direction: PaymentRecord['direction'] =
    from === to ? 'self' : to === viewer ? 'in' : 'out';
  return {
    id: String(op.id),
    type: op.type,
    direction,
    asset,
    amount,
    from,
    to,
    createdAt: op.created_at,
    hash: op.transaction_hash,
  };
}

/**
 * Summarize a contract call from the viewer's side: what reached their
 * wallet, or what left it. A Grow remittance moves USDC to the recipient and
 * to the contract in one call, so the sender sees the sum as one "sent".
 */
export function mapContractTransfer(op: any, viewer: string): PaymentRecord | null {
  const changes: BalanceChange[] = (op.asset_balance_changes ?? []).filter(
    (c: BalanceChange) => c.from !== c.to,
  );
  const incoming = changes.filter((c) => c.to === viewer);
  const outgoing = changes.filter((c) => c.from === viewer);
  const relevant = incoming.length ? incoming : outgoing;
  const first = relevant[0];
  if (!first) return null;
  const total = relevant.reduce((sum, c) => sum + toStroops(c.amount), 0n);
  // For a sender, name the person paid rather than the contract.
  const payee = outgoing.find((c) => c.to?.startsWith('G'))?.to ?? first.to ?? '';
  return {
    id: String(op.id),
    type: op.type,
    direction: incoming.length ? 'in' : 'out',
    asset: first.asset_type === 'native' ? 'XLM' : (first.asset_code ?? 'token'),
    amount: fromStroops(total, 7),
    from: incoming.length ? (first.from ?? '') : viewer,
    to: incoming.length ? viewer : payee,
    createdAt: op.created_at,
    hash: op.transaction_hash,
  };
}
