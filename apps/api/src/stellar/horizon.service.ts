import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Account, Asset, Horizon, Networks, TransactionBuilder } from '@stellar/stellar-sdk';
import type { AppConfig } from '../config/configuration';
import { unfundedMessage } from './messages';

/**
 * Horizon client for the classic layer: accounts, payments and submission of
 * classic transactions. Knows the configured USDC asset, nothing else.
 */
@Injectable()
export class HorizonService {
  private readonly horizonServer: Horizon.Server;
  readonly networkPassphrase: string;
  readonly isTestnet: boolean;
  readonly usdc: Asset;

  constructor(config: ConfigService<AppConfig, true>) {
    const horizonUrl = config.get('horizonUrl', { infer: true });
    this.horizonServer = new Horizon.Server(horizonUrl, {
      allowHttp: horizonUrl.startsWith('http://'),
    });
    this.networkPassphrase = config.get('networkPassphrase', { infer: true });
    this.isTestnet = this.networkPassphrase === Networks.TESTNET;
    const usdc = config.get('usdc', { infer: true });
    this.usdc = new Asset(usdc.code, usdc.issuer);
  }

  get server(): Horizon.Server {
    return this.horizonServer;
  }

  /** Load an account as a transaction source, with a clear error if unfunded. */
  async loadSource(address: string): Promise<Account> {
    try {
      const acc = await this.horizonServer.loadAccount(address);
      return new Account(acc.accountId(), acc.sequenceNumber());
    } catch (err) {
      if (isNotFound(err)) throw new BadRequestException(unfundedMessage(this.isTestnet));
      throw err;
    }
  }

  /** Submit a signed classic transaction; returns the hash once applied. */
  async submit(signedXdr: string): Promise<{ hash: string; status: string }> {
    const tx = TransactionBuilder.fromXDR(signedXdr, this.networkPassphrase);
    try {
      const res = await this.horizonServer.submitTransaction(tx as any);
      return { hash: res.hash, status: 'SUCCESS' };
    } catch (err: any) {
      const codes = err?.response?.data?.extras?.result_codes;
      const detail = codes ? JSON.stringify(codes) : (err?.message ?? String(err));
      throw new BadRequestException(`Transaction failed: ${detail}`);
    }
  }
}

/** True for Horizon's 404 (account or resource not found). */
export function isNotFound(err: unknown): boolean {
  const e = err as { response?: { status?: number }; status?: number };
  return e?.response?.status === 404 || e?.status === 404;
}
