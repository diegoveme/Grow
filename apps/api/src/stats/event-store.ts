import type { DatabaseService } from '../database/database.service';
import type { SplitterEventType, SplitterEvent } from './events';

/** Where indexed contract events and the sync cursor live. */
export interface EventStore {
  cursor(contractId: string): Promise<string | null>;
  /** Persist a page of events and the cursor after it, idempotently. */
  save(contractId: string, events: SplitterEvent[], cursor: string): Promise<void>;
  all(contractId: string): Promise<SplitterEvent[]>;
}

/** In-process store for environments without a database. */
export class MemoryEventStore implements EventStore {
  private readonly events = new Map<string, Map<string, SplitterEvent>>();
  private readonly cursors = new Map<string, string>();

  async cursor(contractId: string) {
    return this.cursors.get(contractId) ?? null;
  }

  async save(contractId: string, events: SplitterEvent[], cursor: string) {
    const bucket = this.events.get(contractId) ?? new Map<string, SplitterEvent>();
    for (const e of events) bucket.set(e.id, e);
    this.events.set(contractId, bucket);
    this.cursors.set(contractId, cursor);
  }

  async all(contractId: string) {
    return [...(this.events.get(contractId)?.values() ?? [])];
  }
}

interface EventRow {
  id: string;
  ledger: number;
  tx_hash: string;
  closed_at: Date;
  type: string;
  account: string | null;
  from_address: string | null;
  amount: string | null;
  spendable: string | null;
  savings: string | null;
}

/** Postgres store (tables created in DatabaseService's schema). */
export class PostgresEventStore implements EventStore {
  constructor(private readonly db: DatabaseService) {}

  async cursor(contractId: string) {
    const [row] = await this.db.sql<{ cursor: string }[]>`
      select cursor from sync_cursors where name = ${cursorName(contractId)}`;
    return row?.cursor ?? null;
  }

  async save(contractId: string, events: SplitterEvent[], cursor: string) {
    await this.db.sql.begin(async (tx) => {
      for (const e of events) {
        await tx`
          insert into contract_events
            (id, contract_id, ledger, tx_hash, closed_at, type, account, from_address,
             amount, spendable, savings)
          values
            (${e.id}, ${contractId}, ${e.ledger}, ${e.txHash}, ${e.closedAt}, ${e.type},
             ${e.account}, ${e.from}, ${e.amount}, ${e.spendable}, ${e.savings})
          on conflict (id) do nothing`;
      }
      await tx`
        insert into sync_cursors (name, cursor) values (${cursorName(contractId)}, ${cursor})
        on conflict (name) do update set cursor = excluded.cursor, updated_at = now()`;
    });
  }

  async all(contractId: string) {
    const rows = await this.db.sql<EventRow[]>`
      select * from contract_events where contract_id = ${contractId} order by ledger, id`;
    return rows.map((r) => ({
      id: r.id,
      ledger: r.ledger,
      txHash: r.tx_hash,
      closedAt: r.closed_at instanceof Date ? r.closed_at.toISOString() : String(r.closed_at),
      type: r.type as SplitterEventType,
      account: r.account,
      from: r.from_address,
      amount: r.amount,
      spendable: r.spendable,
      savings: r.savings,
    }));
  }
}

const cursorName = (contractId: string) => `events:${contractId}`;
