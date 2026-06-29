import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fromStroops, toStroops, type AccountState } from '@raiz/shared';
import { StellarService } from '../stellar/stellar.service';
import type { AppConfig } from '../config/configuration';

interface RawPosition {
  spendable_bps: number;
  wallet_balance: bigint;
  vault_balance: bigint;
  earned_yield: bigint;
}

/**
 * Bridges the API to the on-chain `yield_splitter` contract: reads positions and
 * builds (unsigned) transactions the wallet signs for split changes, receiving,
 * vault deposits and withdrawals.
 */
@Injectable()
export class SplitsService {
  constructor(
    private readonly stellar: StellarService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  private contractId(): string {
    const id = this.config.get('contracts', { infer: true }).yieldSplitter;
    if (!id) {
      throw new ServiceUnavailableException(
        'YIELD_SPLITTER_CONTRACT_ID is not configured. Deploy the contract first.',
      );
    }
    return id;
  }

  async getSplit(user: string): Promise<number> {
    return this.stellar.readContract<number>(this.contractId(), 'get_split', [
      this.stellar.addressArg(user),
    ]);
  }

  async getPosition(user: string): Promise<AccountState> {
    const pos = await this.stellar.readContract<RawPosition>(this.contractId(), 'position', [
      this.stellar.addressArg(user),
    ]);
    const spendableBps = Number(pos.spendable_bps);
    return {
      address: user,
      walletBalance: fromStroops(BigInt(pos.wallet_balance)),
      vaultBalance: fromStroops(BigInt(pos.vault_balance)),
      earnedYield: fromStroops(BigInt(pos.earned_yield), 4),
      split: { spendableBps, vaultBps: 10000 - spendableBps },
    };
  }

  buildSetSplit(user: string, spendableBps: number): Promise<string> {
    if (spendableBps < 0 || spendableBps > 10000) {
      throw new BadRequestException('spendableBps must be between 0 and 10000');
    }
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

  buildDepositVault(to: string): Promise<string> {
    return this.stellar.buildInvocation(to, this.contractId(), 'deposit_vault', [
      this.stellar.addressArg(to),
    ]);
  }

  buildWithdraw(to: string, amount: string): Promise<string> {
    return this.stellar.buildInvocation(to, this.contractId(), 'withdraw', [
      this.stellar.addressArg(to),
      this.stellar.i128(toStroops(amount)),
    ]);
  }

  submit(signedXdr: string) {
    return this.stellar.submit(signedXdr);
  }
}
