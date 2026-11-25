import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BPS_DENOMINATOR,
  fromStroops,
  toStroops,
  type AccountState,
  type SplitterConfig,
} from '@raiz/shared';
import { SorobanService } from '../stellar/soroban.service';
import { addressArg, i128, struct, u32, u64, vec } from '../stellar/scval';
import type { AppConfig } from '../config/configuration';

interface RawPosition {
  spendable_bps: number;
  savings: bigint;
}

interface RawSchedule {
  from: string;
  to: string;
  amount: bigint;
  interval: bigint;
  next_at: bigint;
  runs_left: number;
}

/** A recurring remittance, in display units. */
export interface ScheduleView {
  id: number;
  from: string;
  to: string;
  amount: string;
  intervalSecs: number;
  nextAt: string;
  runsLeft: number;
}

interface RawPledge {
  from: string;
  beneficiary: string;
  payee: string;
  amount: bigint;
  expires_at: bigint;
}

/** A conditional remittance, in display units. */
export interface PledgeView {
  id: number;
  from: string;
  beneficiary: string;
  payee: string;
  amount: string;
  expiresAt: string;
}

/** ~5 seconds per ledger on Stellar, for allowance lifetimes. */
const SECONDS_PER_LEDGER = 5;
/** Keep the allowance alive a day past the last scheduled run. */
const ALLOWANCE_BUFFER_LEDGERS = 17_280;
/** Allowances can't outlive the network's max entry TTL (~180 days on mainnet). */
const MAX_ALLOWANCE_LEDGERS = 3_000_000;

interface RawConfig {
  admin: string;
  token: string;
  user_cap: bigint;
  paused: boolean;
}

/**
 * Bridges the API to the on-chain `yield_splitter` contract: reads positions
 * and settings, and builds the unsigned transactions the wallet signs to set a
 * split, send a remittance through the contract and withdraw savings.
 */
@Injectable()
export class SplitsService {
  constructor(
    private readonly soroban: SorobanService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  contractId(): string {
    const id = this.config.get('contracts', { infer: true }).yieldSplitter;
    if (!id) {
      throw new ServiceUnavailableException(
        'YIELD_SPLITTER_CONTRACT_ID is not configured. Deploy the contract first.',
      );
    }
    return id;
  }

  async getSplit(user: string): Promise<number> {
    const bps = await this.soroban.readContract<number>(this.contractId(), 'get_split', [
      addressArg(user),
    ]);
    return Number(bps);
  }

  async getPosition(user: string): Promise<AccountState> {
    const pos = await this.soroban.readContract<RawPosition>(this.contractId(), 'position', [
      addressArg(user),
    ]);
    const spendableBps = Number(pos.spendable_bps);
    return {
      address: user,
      savings: fromStroops(BigInt(pos.savings), 7),
      split: { spendableBps, vaultBps: BPS_DENOMINATOR - spendableBps },
    };
  }

  async getConfig(): Promise<SplitterConfig> {
    const contractId = this.contractId();
    const cfg = await this.soroban.readContract<RawConfig>(contractId, 'config');
    return {
      contractId,
      admin: cfg.admin,
      token: cfg.token,
      userCap: fromStroops(BigInt(cfg.user_cap), 7),
      paused: Boolean(cfg.paused),
    };
  }

  buildSetSplit(user: string, spendableBps: number): Promise<string> {
    return this.soroban.buildInvocation(user, this.contractId(), 'set_split', [
      addressArg(user),
      u32(spendableBps),
    ]);
  }

  buildReceive(from: string, to: string, amount: string): Promise<string> {
    return this.soroban.buildInvocation(from, this.contractId(), 'receive', [
      addressArg(from),
      addressArg(to),
      i128(toStroops(amount)),
    ]);
  }

  buildDepositSavings(user: string, amount: string): Promise<string> {
    return this.soroban.buildInvocation(user, this.contractId(), 'deposit_savings', [
      addressArg(user),
      i128(toStroops(amount)),
    ]);
  }

  buildPayFromSavings(user: string, to: string, amount: string): Promise<string> {
    return this.soroban.buildInvocation(user, this.contractId(), 'pay_from_savings', [
      addressArg(user),
      addressArg(to),
      i128(toStroops(amount)),
    ]);
  }

  buildWithdrawSavings(to: string, amount: string): Promise<string> {
    return this.soroban.buildInvocation(to, this.contractId(), 'withdraw_savings', [
      addressArg(to),
      i128(toStroops(amount)),
    ]);
  }

  /** One signature, several recipients; each payment split by its recipient. */
  buildSendBatch(from: string, payments: { to: string; amount: string }[]): Promise<string> {
    const items = payments.map((p) =>
      struct({ to: addressArg(p.to), amount: i128(toStroops(p.amount)) }),
    );
    return this.soroban.buildInvocation(from, this.contractId(), 'send_batch', [
      addressArg(from),
      vec(items),
    ]);
  }

  /**
   * Token approve() so the contract can pull `amount * runs` for a schedule.
   * The allowance lives until a day after the last run, capped at the
   * network's max TTL; longer schedules need a fresh approve later.
   */
  async buildScheduleAllowance(
    from: string,
    amount: string,
    runs: number,
    intervalSecs: number,
  ): Promise<string> {
    const { latestLedger } = await this.soroban.server.getHealth();
    const needed =
      Math.ceil((intervalSecs * runs) / SECONDS_PER_LEDGER) + ALLOWANCE_BUFFER_LEDGERS;
    const expiration = latestLedger + Math.min(needed, MAX_ALLOWANCE_LEDGERS);
    const token = this.config.get('contracts', { infer: true }).usdcToken;
    return this.soroban.buildInvocation(from, token, 'approve', [
      addressArg(from),
      addressArg(this.contractId()),
      i128(toStroops(amount) * BigInt(runs)),
      u32(expiration),
    ]);
  }

  buildCreateSchedule(
    from: string,
    to: string,
    amount: string,
    intervalSecs: number,
    runs: number,
  ): Promise<string> {
    return this.soroban.buildInvocation(from, this.contractId(), 'create_schedule', [
      addressArg(from),
      addressArg(to),
      i128(toStroops(amount)),
      u64(intervalSecs),
      u32(runs),
    ]);
  }

  /** Anyone can run a due schedule; `caller` only signs and pays the fee. */
  buildRunSchedule(caller: string, id: number): Promise<string> {
    return this.soroban.buildInvocation(caller, this.contractId(), 'run_schedule', [u64(id)]);
  }

  buildCancelSchedule(from: string, id: number): Promise<string> {
    return this.soroban.buildInvocation(from, this.contractId(), 'cancel_schedule', [u64(id)]);
  }

  async getSchedule(id: number): Promise<ScheduleView | null> {
    const raw = await this.soroban.readContract<RawSchedule | null>(
      this.contractId(),
      'schedule',
      [u64(id)],
    );
    if (!raw) return null;
    return {
      id,
      from: raw.from,
      to: raw.to,
      amount: fromStroops(BigInt(raw.amount), 7),
      intervalSecs: Number(raw.interval),
      nextAt: new Date(Number(raw.next_at) * 1000).toISOString(),
      runsLeft: Number(raw.runs_left),
    };
  }

  /** Earmark money for `payee`, released by `beneficiary` until `expiresAt`. */
  buildCreatePledge(
    from: string,
    beneficiary: string,
    payee: string,
    amount: string,
    expiresAt: string,
  ): Promise<string> {
    const expires = Math.floor(new Date(expiresAt).getTime() / 1000);
    return this.soroban.buildInvocation(from, this.contractId(), 'create_pledge', [
      addressArg(from),
      addressArg(beneficiary),
      addressArg(payee),
      i128(toStroops(amount)),
      u64(expires),
    ]);
  }

  /** The beneficiary pays the payee (`caller` must be the beneficiary). */
  buildReleasePledge(caller: string, id: number): Promise<string> {
    return this.soroban.buildInvocation(caller, this.contractId(), 'release_pledge', [u64(id)]);
  }

  /** After expiry, the sender takes it back (`caller` must be the sender). */
  buildRefundPledge(caller: string, id: number): Promise<string> {
    return this.soroban.buildInvocation(caller, this.contractId(), 'refund_pledge', [u64(id)]);
  }

  async getPledge(id: number): Promise<PledgeView | null> {
    const raw = await this.soroban.readContract<RawPledge | null>(
      this.contractId(),
      'pledge',
      [u64(id)],
    );
    if (!raw) return null;
    return {
      id,
      from: raw.from,
      beneficiary: raw.beneficiary,
      payee: raw.payee,
      amount: fromStroops(BigInt(raw.amount), 7),
      expiresAt: new Date(Number(raw.expires_at) * 1000).toISOString(),
    };
  }

  submit(signedXdr: string) {
    return this.soroban.submit(signedXdr);
  }
}
