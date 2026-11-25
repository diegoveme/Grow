import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Keypair, TransactionBuilder } from '@stellar/stellar-sdk';
import type { AppConfig } from '../config/configuration';
import { SplitsService } from '../splits/splits.service';
import { SorobanService } from '../stellar/soroban.service';
import { StatsService } from '../stats/stats.service';
import { pickDue } from './keeper-plan';

/** Most schedules run per tick. */
const MAX_PER_TICK = 10;
/** Wait before retrying a schedule whose run failed (e.g. revoked allowance). */
const RETRY_AFTER_MS = 5 * 60_000;

export interface KeeperStatus {
  enabled: boolean;
  account: string | null;
  lastTickAt: string | null;
  lastRan: number;
  lastFailed: number;
  totalRan: number;
}

/**
 * Runs due recurring remittances so they happen on time without anyone
 * pressing a button. run_schedule needs no signature from the sender (the
 * terms were signed at creation), so the keeper's key only pays network fees
 * and can't move anyone's money beyond what each schedule allows.
 *
 * Off unless KEEPER_SECRET is set. Uses a testnet/mainnet account funded
 * with a little XLM for fees.
 */
@Injectable()
export class KeeperService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KeeperService.name);
  private readonly keypair: Keypair | null;
  private timer?: NodeJS.Timeout;
  private running = false;
  private readonly retryAfter = new Map<number, number>();
  private status: KeeperStatus;

  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    private readonly soroban: SorobanService,
    private readonly splits: SplitsService,
    private readonly stats: StatsService,
  ) {
    const { secret } = this.config.get('keeper', { infer: true });
    this.keypair = secret ? Keypair.fromSecret(secret) : null;
    this.status = {
      enabled: false,
      account: this.keypair?.publicKey() ?? null,
      lastTickAt: null,
      lastRan: 0,
      lastFailed: 0,
      totalRan: 0,
    };
  }

  onModuleInit() {
    const { intervalSecs, enabled } = this.config.get('keeper', { infer: true });
    const contract = this.config.get('contracts', { infer: true }).yieldSplitter;
    if (!this.keypair || !contract || !enabled) return;
    this.status.enabled = true;
    this.logger.log(`keeper on as ${this.keypair.publicKey()}, every ${intervalSecs}s`);
    this.timer = setInterval(() => void this.tick(), intervalSecs * 1000);
    void this.tick();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  getStatus(): KeeperStatus {
    return { ...this.status };
  }

  /** One pass: find due schedules and run them. Never overlaps itself. */
  async tick(): Promise<void> {
    if (!this.keypair || this.running) return;
    this.running = true;
    let ran = 0;
    let failed = 0;
    try {
      const ids = await this.stats.allRefs('schedule_created');
      const views = await Promise.all(ids.map((id) => this.splits.getSchedule(id).catch(() => null)));
      const now = Date.now();
      const due = pickDue(
        views
          .filter((v) => v !== null)
          .map((v) => ({ id: v.id, nextAt: new Date(v.nextAt).getTime(), runsLeft: v.runsLeft })),
        now,
        this.retryAfter,
        MAX_PER_TICK,
      );
      for (const id of due) {
        try {
          await this.run(id);
          this.retryAfter.delete(id);
          ran += 1;
        } catch (err) {
          failed += 1;
          this.retryAfter.set(id, Date.now() + RETRY_AFTER_MS);
          this.logger.warn(`schedule ${id} not run: ${String((err as Error)?.message ?? err)}`);
        }
      }
    } catch (err) {
      this.logger.warn(`keeper tick failed: ${String(err).split('\n')[0]}`);
    } finally {
      this.status = {
        ...this.status,
        lastTickAt: new Date().toISOString(),
        lastRan: ran,
        lastFailed: failed,
        totalRan: this.status.totalRan + ran,
      };
      this.running = false;
    }
  }

  /** Build run_schedule with the keeper as source, sign it here and submit. */
  private async run(id: number): Promise<void> {
    const keypair = this.keypair!;
    const unsigned = await this.splits.buildRunSchedule(keypair.publicKey(), id);
    const tx = TransactionBuilder.fromXDR(unsigned, this.soroban.networkPassphrase);
    tx.sign(keypair);
    const { hash, status } = await this.soroban.submit(tx.toXDR());
    this.logger.log(`schedule ${id} ran (${status}) ${hash}`);
  }
}
