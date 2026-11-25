import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Asset, BASE_FEE, Memo, Operation, TransactionBuilder, xdr } from '@stellar/stellar-sdk';
import type { AssetCode } from '@raiz/shared';
import { HorizonService, isNotFound } from '../stellar/horizon.service';
import { truncateUtf8 } from '../stellar/memo';
import { mapPayment } from './activity';
import type { AccountInfo, BalanceEntry, PaymentRecord } from './accounts.types';

/**
 * The classic money layer: balances, the activity feed, XLM/USDC payments,
 * the USDC trustline and friendbot funding on testnet. Transactions are built
 * unsigned; the browser wallet signs them.
 */
@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);

  constructor(private readonly horizon: HorizonService) {}

  /** Balances, funding state and USDC trustline status for an address. */
  async getAccountInfo(address: string): Promise<AccountInfo> {
    try {
      const acc = await this.horizon.server.loadAccount(address);
      const usdcAsset = this.horizon.usdc;
      const balances: BalanceEntry[] = [];
      let xlm = '0';
      let usdc: string | null = null;
      for (const b of acc.balances) {
        if (b.asset_type === 'native') {
          xlm = b.balance;
          balances.push({ asset: 'XLM', balance: b.balance });
        } else if (
          'asset_code' in b &&
          b.asset_code === usdcAsset.getCode() &&
          'asset_issuer' in b &&
          b.asset_issuer === usdcAsset.getIssuer()
        ) {
          usdc = b.balance;
          balances.push({ asset: 'USDC', balance: b.balance, issuer: usdcAsset.getIssuer() });
        }
      }
      return { address, exists: true, funded: true, usdcTrustline: usdc !== null, balances, xlm, usdc };
    } catch (err) {
      if (isNotFound(err)) {
        return {
          address,
          exists: false,
          funded: false,
          usdcTrustline: false,
          balances: [],
          xlm: '0',
          usdc: null,
        };
      }
      throw err;
    }
  }

  /**
   * Recent payments for an address, newest first: classic payments, account
   * creations and token transfers made inside contract calls (Grow
   * remittances, savings withdrawals, vault deposits).
   */
  async getPayments(address: string, limit = 25): Promise<PaymentRecord[]> {
    try {
      const page = await this.horizon.server
        .payments()
        .forAccount(address)
        .order('desc')
        .limit(Math.min(limit, 100))
        .join('transactions')
        .call();
      return (page.records as any[])
        .map((op) => mapPayment(op, address))
        .filter((r): r is PaymentRecord => r !== null);
    } catch (err) {
      if (isNotFound(err)) return [];
      throw err;
    }
  }

  /**
   * Build an unsigned classic payment. For XLM to an unfunded destination this
   * becomes a `createAccount`. For USDC the recipient must already trust the
   * asset (we surface a clear error otherwise).
   */
  async buildPayment(params: {
    from: string;
    to: string;
    asset: AssetCode;
    amount: string;
    memo?: string;
  }): Promise<string> {
    const { from, to, asset, amount, memo } = params;
    const source = await this.horizon.loadSource(from);
    const dest = await this.getAccountInfo(to);

    let operation: xdr.Operation;
    if (asset === 'XLM') {
      operation = dest.exists
        ? Operation.payment({ destination: to, asset: Asset.native(), amount })
        : Operation.createAccount({ destination: to, startingBalance: amount });
    } else {
      if (!dest.exists) {
        throw new BadRequestException(
          'Recipient account is not funded yet. Send XLM first, or have them fund it.',
        );
      }
      if (!dest.usdcTrustline) {
        throw new BadRequestException(
          'Recipient has no USDC trustline. They must add USDC before receiving it.',
        );
      }
      operation = Operation.payment({ destination: to, asset: this.horizon.usdc, amount });
    }

    const builder = new TransactionBuilder(source, {
      fee: BASE_FEE,
      networkPassphrase: this.horizon.networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(180);
    const memoText = truncateUtf8(memo?.trim() ?? '');
    if (memoText) builder.addMemo(Memo.text(memoText));
    return builder.build().toXDR();
  }

  /** Build an unsigned changeTrust transaction so an account can hold USDC. */
  async buildChangeTrust(account: string, limit?: string): Promise<string> {
    const source = await this.horizon.loadSource(account);
    return new TransactionBuilder(source, {
      fee: BASE_FEE,
      networkPassphrase: this.horizon.networkPassphrase,
    })
      .addOperation(Operation.changeTrust({ asset: this.horizon.usdc, limit }))
      .setTimeout(180)
      .build()
      .toXDR();
  }

  /** Submit a signed classic transaction through Horizon. */
  submit(signedXdr: string) {
    return this.horizon.submit(signedXdr);
  }

  /** Fund a testnet account via friendbot (no-op on public network). */
  async fundTestnet(address: string): Promise<boolean> {
    if (!this.horizon.isTestnet) return false;
    try {
      const res = await fetch(`https://friendbot.stellar.org/?addr=${address}`);
      return res.ok;
    } catch (err) {
      this.logger.warn(`friendbot failed for ${address}: ${String(err)}`);
      return false;
    }
  }
}
