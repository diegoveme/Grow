import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Account,
  Address,
  Asset,
  BASE_FEE,
  Contract,
  Horizon,
  Memo,
  Networks,
  Operation,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
  rpc,
  xdr,
} from '@stellar/stellar-sdk';
import { type AssetCode } from '@raiz/shared';
import type { AppConfig } from '../config/configuration';

/** A throwaway account used only to assemble read-only simulations. */
const SIMULATION_SOURCE = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

export type { AssetCode };

export interface BalanceEntry {
  asset: AssetCode;
  balance: string;
  issuer?: string;
}

export interface AccountInfo {
  address: string;
  exists: boolean;
  funded: boolean;
  usdcTrustline: boolean;
  balances: BalanceEntry[];
  xlm: string;
  usdc: string | null;
}

export interface PaymentRecord {
  id: string;
  type: string;
  direction: 'in' | 'out' | 'self';
  asset: AssetCode | string;
  amount: string;
  from: string;
  to: string;
  createdAt: string;
  hash: string;
}

@Injectable()
export class StellarService {
  private readonly logger = new Logger(StellarService.name);
  private readonly rpcServer: rpc.Server;
  private readonly horizonServer: Horizon.Server;
  readonly networkPassphrase: string;
  private readonly usdcCode: string;
  private readonly usdcIssuer: string;

  constructor(private readonly config: ConfigService<AppConfig, true>) {
    const rpcUrl = this.config.get('sorobanRpcUrl', { infer: true });
    const horizonUrl = this.config.get('horizonUrl', { infer: true });
    this.networkPassphrase = this.config.get('networkPassphrase', { infer: true });
    this.rpcServer = new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith('http://') });
    this.horizonServer = new Horizon.Server(horizonUrl, {
      allowHttp: horizonUrl.startsWith('http://'),
    });
    const usdc = this.config.get('usdc', { infer: true });
    this.usdcCode = usdc.code;
    this.usdcIssuer = usdc.issuer;
  }

  get server(): rpc.Server {
    return this.rpcServer;
  }

  get horizon(): Horizon.Server {
    return this.horizonServer;
  }

  /** The classic USDC asset (non-native). */
  usdcAsset(): Asset {
    return new Asset(this.usdcCode, this.usdcIssuer);
  }

  private assetFor(code: AssetCode): Asset {
    return code === 'XLM' ? Asset.native() : this.usdcAsset();
  }

  /** Convert a Stellar address string into an ScVal address argument. */
  addressArg(address: string): xdr.ScVal {
    return new Address(address).toScVal();
  }

  /** Convert a JS value (e.g. bigint amount) into an ScVal of the given type. */
  i128(value: bigint | number | string): xdr.ScVal {
    return nativeToScVal(BigInt(value), { type: 'i128' });
  }

  /** Convert a number into a u32 ScVal. */
  u32(value: number): xdr.ScVal {
    return nativeToScVal(value, { type: 'u32' });
  }

  /**
   * Simulate a read-only contract call and return the decoded native value.
   * No signing or submission — pure view access via the Soroban RPC.
   */
  async readContract<T = unknown>(
    contractId: string,
    method: string,
    args: xdr.ScVal[] = [],
  ): Promise<T> {
    const contract = new Contract(contractId);
    const source = new Account(SIMULATION_SOURCE, '0');
    const tx = new TransactionBuilder(source, {
      fee: '100',
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(contract.call(method, ...args))
      .setTimeout(30)
      .build();

    const sim = await this.rpcServer.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) {
      throw new Error(`Simulation failed for ${method}: ${sim.error}`);
    }
    const retval = sim.result?.retval;
    if (!retval) {
      throw new Error(`No return value for ${method}`);
    }
    return scValToNative(retval) as T;
  }

  /**
   * Build an unsigned transaction that invokes a contract method, prepared
   * (simulated + footprint-populated) so the client only needs to sign it.
   * Returns base64 XDR.
   */
  async buildInvocation(
    sourceAddress: string,
    contractId: string,
    method: string,
    args: xdr.ScVal[] = [],
  ): Promise<string> {
    const account = await this.rpcServer.getAccount(sourceAddress);
    const contract = new Contract(contractId);
    const tx = new TransactionBuilder(account, {
      fee: '1000000',
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(contract.call(method, ...args))
      .setTimeout(120)
      .build();
    const prepared = await this.rpcServer.prepareTransaction(tx);
    return prepared.toXDR();
  }

  /** Submit a signed transaction (base64 XDR) and return the hash once applied. */
  async submit(signedXdr: string): Promise<{ hash: string; status: string }> {
    const tx = TransactionBuilder.fromXDR(signedXdr, this.networkPassphrase);
    const sent = await this.rpcServer.sendTransaction(tx);
    if (sent.status === 'ERROR') {
      throw new Error(`Submit failed: ${JSON.stringify(sent.errorResult)}`);
    }
    // Poll until the transaction is out of pending.
    let result = await this.rpcServer.getTransaction(sent.hash);
    for (let i = 0; i < 15 && result.status === 'NOT_FOUND'; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      result = await this.rpcServer.getTransaction(sent.hash);
    }
    return { hash: sent.hash, status: result.status };
  }

  /** Fund a testnet account via friendbot (no-op on public network). */
  async fundTestnet(address: string): Promise<boolean> {
    if (this.networkPassphrase !== Networks.TESTNET) return false;
    try {
      const res = await fetch(`https://friendbot.stellar.org/?addr=${address}`);
      return res.ok;
    } catch (err) {
      this.logger.warn(`friendbot failed for ${address}: ${String(err)}`);
      return false;
    }
  }

  // ── Classic account / payment layer (Horizon) ─────────────────────────────

  /** Balances, funding state and USDC trustline status for an address. */
  async getAccountInfo(address: string): Promise<AccountInfo> {
    try {
      const acc = await this.horizonServer.loadAccount(address);
      const balances: BalanceEntry[] = [];
      let xlm = '0';
      let usdc: string | null = null;
      for (const b of acc.balances) {
        if (b.asset_type === 'native') {
          xlm = b.balance;
          balances.push({ asset: 'XLM', balance: b.balance });
        } else if (
          'asset_code' in b &&
          b.asset_code === this.usdcCode &&
          'asset_issuer' in b &&
          b.asset_issuer === this.usdcIssuer
        ) {
          usdc = b.balance;
          balances.push({ asset: 'USDC', balance: b.balance, issuer: this.usdcIssuer });
        }
      }
      return {
        address,
        exists: true,
        funded: true,
        usdcTrustline: usdc !== null,
        balances,
        xlm,
        usdc,
      };
    } catch (err) {
      if (this.isNotFound(err)) {
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

  /** Recent payments (incl. account creations) for an address, newest first. */
  async getPayments(address: string, limit = 25): Promise<PaymentRecord[]> {
    try {
      const page = await this.horizonServer
        .payments()
        .forAccount(address)
        .order('desc')
        .limit(Math.min(limit, 100))
        .join('transactions')
        .call();
      const records: PaymentRecord[] = [];
      for (const op of page.records as any[]) {
        const mapped = this.mapPayment(op, address);
        if (mapped) records.push(mapped);
      }
      return records;
    } catch (err) {
      if (this.isNotFound(err)) return [];
      throw err;
    }
  }

  private mapPayment(op: any, viewer: string): PaymentRecord | null {
    let from = op.from ?? op.funder ?? '';
    let to = op.to ?? op.account ?? '';
    let amount = op.amount ?? op.starting_balance ?? '0';
    let asset: AssetCode | string = 'XLM';
    if (op.type === 'payment') {
      asset = op.asset_type === 'native' ? 'XLM' : op.asset_code ?? 'token';
    } else if (op.type === 'create_account') {
      asset = 'XLM';
    } else {
      return null; // ignore path payments / other op types for the simple feed
    }
    const direction: 'in' | 'out' | 'self' =
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
    const source = await this.loadClassicAccount(from);

    let operation: xdr.Operation;
    if (asset === 'XLM') {
      const dest = await this.getAccountInfo(to);
      operation = dest.exists
        ? Operation.payment({ destination: to, asset: Asset.native(), amount })
        : Operation.createAccount({ destination: to, startingBalance: amount });
    } else {
      const dest = await this.getAccountInfo(to);
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
      operation = Operation.payment({ destination: to, asset: this.usdcAsset(), amount });
    }

    const builder = new TransactionBuilder(source, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(180);
    if (memo && memo.trim()) builder.addMemo(Memo.text(memo.trim().slice(0, 28)));
    return builder.build().toXDR();
  }

  /** Build an unsigned changeTrust transaction so an account can hold USDC. */
  async buildChangeTrust(account: string, limit?: string): Promise<string> {
    const source = await this.loadClassicAccount(account);
    const tx = new TransactionBuilder(source, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(Operation.changeTrust({ asset: this.usdcAsset(), limit }))
      .setTimeout(180)
      .build();
    return tx.toXDR();
  }

  /** Submit a signed classic transaction through Horizon; returns the hash. */
  async submitClassic(signedXdr: string): Promise<{ hash: string; status: string }> {
    const tx = TransactionBuilder.fromXDR(signedXdr, this.networkPassphrase);
    try {
      const res = await this.horizonServer.submitTransaction(tx as any);
      return { hash: res.hash, status: 'SUCCESS' };
    } catch (err: any) {
      const codes = err?.response?.data?.extras?.result_codes;
      const detail = codes ? JSON.stringify(codes) : err?.message ?? String(err);
      throw new BadRequestException(`Transaction failed: ${detail}`);
    }
  }

  private async loadClassicAccount(address: string): Promise<Account> {
    try {
      const acc = await this.horizonServer.loadAccount(address);
      return new Account(acc.accountId(), acc.sequenceNumber());
    } catch (err) {
      if (this.isNotFound(err)) {
        throw new BadRequestException(
          'Your account is not funded yet. Use “Fund testnet XLM” first.',
        );
      }
      throw err;
    }
  }

  private isNotFound(err: unknown): boolean {
    const e = err as { response?: { status?: number }; status?: number };
    return e?.response?.status === 404 || e?.status === 404;
  }
}
