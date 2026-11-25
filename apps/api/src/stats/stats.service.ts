import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fromStroops } from '@raiz/shared';
import type { AppConfig } from '../config/configuration';
import { DatabaseService } from '../database/database.service';
import { addressArg } from '../stellar/scval';
import { SorobanService } from '../stellar/soroban.service';
import { MemoryEventStore, PostgresEventStore, type EventStore } from './event-store';
import { decodeEvent, type RawEvent, type SplitterEvent } from './events';
import { summarize, type UsageSummary } from './summary';

const SYNC_EVERY_MS = 30_000;
const PAGE_LIMIT = 200;
/** Pages per sync run; RPC scans ~10k ledgers per page, so this catches up fast. */
const MAX_PAGES = 50;

export interface PublicStats extends UsageSummary {
  contractId: string;
  network: string;
  /** USDC the contract holds right now: recipients' savings (the contract's NAV). */
  savingsHeld: string | null;
  /** Last ledger the indexer has scanned. */
  syncedLedger: number | null;
}

/** Ledger encoded in an RPC event cursor ("<toid>-<index>", toid >> 32). */
export function cursorLedger(cursor: string): number {
  return Number(BigInt(cursor.split('-')[0] ?? '0') >> 32n);
}

/**
 * Indexes yield_splitter events from Soroban RPC into Postgres (or memory)
 * and serves usage stats: volume, remittances, senders, recipients, savings.
 * RPC only keeps ~7 days of events, so the cursor is persisted and the
 * indexer keeps polling.
 */
@Injectable()
export class StatsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StatsService.name);
  private timer?: NodeJS.Timeout;
  private syncing = false;
  private syncedLedger: number | null = null;
  private store?: EventStore;

  constructor(
    private readonly soroban: SorobanService,
    private readonly db: DatabaseService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  private get contractId() {
    return this.config.get('contracts', { infer: true }).yieldSplitter;
  }

  onModuleInit() {
    const { indexer } = this.config.get('stats', { infer: true });
    if (!this.contractId || !indexer) return;
    void this.sync();
    this.timer = setInterval(() => void this.sync(), SYNC_EVERY_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Chosen lazily: the database connects in its own onModuleInit. */
  private eventStore(): EventStore {
    this.store ??= this.db.enabled ? new PostgresEventStore(this.db) : new MemoryEventStore();
    return this.store;
  }

  /** Pull new events since the stored cursor. Safe to call concurrently. */
  async sync(): Promise<void> {
    const contractId = this.contractId;
    if (!contractId || this.syncing) return;
    this.syncing = true;
    try {
      const store = this.eventStore();
      const filters = [{ type: 'contract' as const, contractIds: [contractId] }];
      let cursor = await store.cursor(contractId);
      for (let page = 0; page < MAX_PAGES; page++) {
        const res = cursor
          ? await this.soroban.server.getEvents({ cursor, filters, limit: PAGE_LIMIT })
          : await this.soroban.server.getEvents({
              startLedger: await this.startLedger(),
              filters,
              limit: PAGE_LIMIT,
            });
        const events = (res.events as unknown as RawEvent[])
          .map(decodeEvent)
          .filter((e): e is SplitterEvent => e !== null);
        if (!res.cursor) break;
        await store.save(contractId, events, res.cursor);
        cursor = res.cursor;
        this.syncedLedger = Math.min(cursorLedger(res.cursor), res.latestLedger);
        if (!res.events.length && this.syncedLedger >= res.latestLedger - 1) break;
      }
    } catch (err) {
      this.logger.warn(`event sync failed: ${String(err).split('\n')[0]}`);
    } finally {
      this.syncing = false;
    }
  }

  /** First ledger to index: STATS_START_LEDGER, else the oldest RPC still has. */
  private async startLedger(): Promise<number> {
    const configured = this.config.get('stats', { infer: true }).startLedger;
    const { oldestLedger } = await this.soroban.server.getHealth();
    return Math.max(configured ?? 0, oldestLedger);
  }

  async getStats(): Promise<PublicStats | null> {
    const contractId = this.contractId;
    if (!contractId) return null;
    const events = await this.eventStore().all(contractId);
    return {
      contractId,
      network: this.config.get('network', { infer: true }),
      ...summarize(events),
      savingsHeld: await this.savingsHeld(contractId),
      syncedLedger: this.syncedLedger,
    };
  }

  /**
   * Ids of schedules or pledges `address` created or receives, newest first,
   * from the indexed creation events. Callers check the live state on-chain.
   */
  async refsFor(type: 'schedule_created' | 'pledge_created', address: string): Promise<number[]> {
    const contractId = this.contractId;
    if (!contractId) return [];
    await this.sync();
    const events = await this.eventStore().all(contractId);
    return events
      .filter((e) => e.type === type && e.ref && (e.account === address || e.to === address))
      .map((e) => Number(e.ref))
      .reverse();
  }

  /** Every schedule or pledge id ever created on the contract (for the keeper). */
  async allRefs(type: 'schedule_created' | 'pledge_created'): Promise<number[]> {
    const contractId = this.contractId;
    if (!contractId) return [];
    await this.sync();
    const events = await this.eventStore().all(contractId);
    return events.filter((e) => e.type === type && e.ref).map((e) => Number(e.ref));
  }

  /** The contract's USDC balance, read live from the token (exact, not derived). */
  private async savingsHeld(contractId: string): Promise<string | null> {
    try {
      const token = this.config.get('contracts', { infer: true }).usdcToken;
      const balance = await this.soroban.readContract<bigint>(token, 'balance', [
        addressArg(contractId),
      ]);
      return fromStroops(BigInt(balance), 7);
    } catch {
      return null;
    }
  }
}
