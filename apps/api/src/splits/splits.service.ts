import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BPS_DENOMINATOR,
  fromStroops,
  toStroops,
  type AccountState,
  type SplitterConfig,
} from '@raiz/shared';
import { StellarService } from '../stellar/stellar.service';
import type { AppConfig } from '../config/configuration';

interface RawPosition {
  spendable_bps: number;
  savings: bigint;
}

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
    private readonly stellar: StellarService,
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
    const bps = await this.stellar.readContract<number>(this.contractId(), 'get_split', [
      this.stellar.addressArg(user),
    ]);
    return Number(bps);
  }

  async getPosition(user: string): Promise<AccountState> {
    const pos = await this.stellar.readContract<RawPosition>(this.contractId(), 'position', [
      this.stellar.addressArg(user),
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
    const cfg = await this.stellar.readContract<RawConfig>(contractId, 'config');
    return {
      contractId,
      admin: cfg.admin,
      token: cfg.token,
      userCap: fromStroops(BigInt(cfg.user_cap), 7),
      paused: Boolean(cfg.paused),
    };
  }

  buildSetSplit(user: string, spendableBps: number): Promise<string> {
    return this.stellar.buildInvocation(user, this.contractId(), 'set_split', [
      this.stellar.addressArg(user),
      this.stellar.u32(spendableBps),
    ]);
  }

  buildReceive(from: string, to: string, amount: string): Promise<string> {
    return this.stellar.buildInvocation(from, this.contractId(), 'receive', [
      this.stellar.addressArg(from),
      this.stellar.addressArg(to),
      this.stellar.i128(toStroops(amount)),
    ]);
  }

  buildWithdrawSavings(to: string, amount: string): Promise<string> {
    return this.stellar.buildInvocation(to, this.contractId(), 'withdraw_savings', [
      this.stellar.addressArg(to),
      this.stellar.i128(toStroops(amount)),
    ]);
  }

  submit(signedXdr: string) {
    return this.stellar.submit(signedXdr);
  }
}
