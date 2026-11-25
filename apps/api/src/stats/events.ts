import { scValToNative, xdr } from '@stellar/stellar-sdk';

/** yield_splitter event names, as published (snake_case of the struct). */
export type SplitterEventType =
  | 'funds_received'
  | 'savings_deposited'
  | 'savings_withdrawn'
  | 'savings_spent'
  | 'split_set'
  | 'user_cap_set'
  | 'paused_set';

/** One contract event, flattened for storage and aggregation. */
export interface SplitterEvent {
  /** RPC event id, unique and ordered. */
  id: string;
  ledger: number;
  txHash: string;
  /** ISO-8601 close time of the ledger. */
  closedAt: string;
  type: SplitterEventType;
  /** The account the event is about (recipient / user), if any. */
  account: string | null;
  /** Sender of a remittance. */
  from: string | null;
  /** Amounts in token base units (7 decimals), as decimal strings. */
  amount: string | null;
  spendable: string | null;
  savings: string | null;
}

/** The fields of an RPC event we read (rpc.Api.EventResponse). */
export interface RawEvent {
  id: string;
  ledger: number;
  txHash: string;
  ledgerClosedAt: string;
  topic: xdr.ScVal[];
  value: xdr.ScVal;
}

const KNOWN = new Set<SplitterEventType>([
  'funds_received',
  'savings_deposited',
  'savings_withdrawn',
  'savings_spent',
  'split_set',
  'user_cap_set',
  'paused_set',
]);

const str = (v: unknown) => (v === undefined || v === null ? null : String(v));

/** Decode a raw RPC event from our contract, or null if it isn't one we know. */
export function decodeEvent(raw: RawEvent): SplitterEvent | null {
  try {
    const [name, subject] = raw.topic.map((t) => scValToNative(t) as unknown);
    if (typeof name !== 'string' || !KNOWN.has(name as SplitterEventType)) return null;
    const data = (scValToNative(raw.value) ?? {}) as Record<string, unknown>;
    return {
      id: raw.id,
      ledger: raw.ledger,
      txHash: raw.txHash,
      closedAt: new Date(raw.ledgerClosedAt).toISOString(),
      type: name as SplitterEventType,
      account: typeof subject === 'string' ? subject : null,
      from: str(data.from),
      amount: str(data.amount),
      spendable: str(data.spendable),
      savings: str(data.savings),
    };
  } catch {
    return null;
  }
}
