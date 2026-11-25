import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
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
import { fromStroops, toStroops, type AssetCode } from '@raiz/shared';
import type { AppConfig } from '../config/configuration';
import { contractFailures, describeFailure } from './contract-errors';

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

/** A token movement inside a contract call, as Horizon reports it. */
interface BalanceChange {
  asset_type: string;
  asset_code?: string;
  from?: string;
  to?: string;
  amount: string;
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
  private readonly isTestnet: boolean;
  private readonly contractIds: { splitter?: string; token?: string };

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
    this.isTestnet = this.networkPassphrase === Networks.TESTNET;
    const contracts = this.config.get('contracts', { infer: true });
    this.contractIds = { splitter: contracts.yieldSplitter, token: contracts.usdcToken };
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

    const sim = await this.rpcServer.simulateTransaction(tx).catch((err: unknown) => {
      throw new ServiceUnavailableException(`Soroban RPC unavailable: ${String(err)}`);
    });
    if (rpc.Api.isSimulationError(sim)) {
      this.logger.warn(`read ${method} failed: ${sim.error.split('\n')[0]}`);
      throw new ServiceUnavailableException(`Could not read ${method} from the contract.`);
    }
    const retval = sim.result?.retval;
    if (!retval) {
      throw new ServiceUnavailableException(`The contract returned nothing for ${method}.`);
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
    const account = await this.rpcServer.getAccount(sourceAddress).catch((err: unknown) => {
      if (/not found/i.test(String(err))) throw new BadRequestException(this.unfundedMessage());
      throw err;
    });
    const contract = new Contract(contractId);
    const tx = new TransactionBuilder(account, {
      fee: '1000000',
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(contract.call(method, ...args))
      .setTimeout(120)
      .build();

    // Simulate ourselves (instead of prepareTransaction) so a contract error
    // reaches the user as a readable message rather than a 500.
    const sim = await this.rpcServer.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) {
      const failures = contractFailures(sim.events);
      this.logger.warn(`simulate ${method} failed: ${sim.error.split('\n')[0]}`);
      throw new BadRequestException(describeFailure(failures, sim.error, this.contractIds));
    }
    return rpc.assembleTransaction(tx, sim).build().toXDR();
  }

  /**
   * Submit a signed Soroban transaction (base64 XDR) and wait for it to land.
   * Throws if the network rejects it or it fails on-chain; returns status
   * `SUCCESS`, or `NOT_FOUND` if it is still pending after ~30s.
   */
  async submit(signedXdr: string): Promise<{ hash: string; status: string }> {
    const tx = TransactionBuilder.fromXDR(signedXdr, this.networkPassphrase);
    const sent = await this.rpcServer.sendTransaction(tx);
    if (sent.status === 'ERROR') {
      const code = sent.errorResult?.result().switch().name ?? 'unknown';
      throw new BadRequestException(`The network rejected the transaction (${code}).`);
    }
    if (sent.status === 'TRY_AGAIN_LATER') {
      throw new ServiceUnavailableException('The network is busy. Try again in a few seconds.');
    }
    let result = await this.rpcServer.getTransaction(sent.hash);
    for (let i = 0; i < 30 && result.status === 'NOT_FOUND'; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      result = await this.rpcServer.getTransaction(sent.hash);
    }
    if (result.status === 'FAILED') {
      throw new BadRequestException(`The transaction failed on-chain (${sent.hash}).`);
    }
    return { hash: sent.hash, status: result.status };
  }

  /** Fund a testnet account via friendbot (no-op on public network). */
  async fundTestnet(address: string): Promise<boolean> {
    if (!this.isTestnet) return false;
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

  /**
   * Recent payments for an address, newest first: classic payments, account
   * creations and token transfers made inside contract calls (Grow
   * remittances, savings withdrawals, vault deposits).
   */
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
    if (op.type === 'invoke_host_function') return this.mapContractTransfer(op, viewer);
    const from = op.from ?? op.funder ?? '';
    const to = op.to ?? op.account ?? '';
    const amount = op.amount ?? op.starting_balance ?? '0';
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
   * Summarize a contract call from the viewer's side: what reached their
   * wallet, or what left it. A Grow remittance moves USDC to the recipient and
   * to the contract in one call, so the sender sees the sum as one "sent".
   */
  private mapContractTransfer(op: any, viewer: string): PaymentRecord | null {
    const changes: BalanceChange[] = (op.asset_balance_changes ?? []).filter(
      (c: BalanceChange) => c.from !== c.to,
    );
    const incoming = changes.filter((c) => c.to === viewer);
    const outgoing = changes.filter((c) => c.from === viewer);
    const relevant = incoming.length ? incoming : outgoing;
    const first = relevant[0];
    if (!first) return null;
    const total = relevant.reduce((sum, c) => sum + toStroops(c.amount), 0n);
    // For a sender, name the person paid rather than the contract.
    const payee = outgoing.find((c) => c.to?.startsWith('G'))?.to ?? first.to ?? '';
    return {
      id: String(op.id),
      type: op.type,
      direction: incoming.length ? 'in' : 'out',
      asset: first.asset_type === 'native' ? 'XLM' : (first.asset_code ?? 'token'),
      amount: fromStroops(total, 7),
      from: incoming.length ? (first.from ?? '') : viewer,
      to: incoming.length ? viewer : payee,
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
    const memoText = truncateUtf8(memo?.trim() ?? '', 28);
    if (memoText) builder.addMemo(Memo.text(memoText));
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
      if (this.isNotFound(err)) throw new BadRequestException(this.unfundedMessage());
      throw err;
    }
  }

  private unfundedMessage(): string {
    return this.isTestnet
      ? 'Your account is not funded yet. Use “Fund testnet XLM” first.'
      : 'Your account is not activated yet. Send it some XLM first.';
  }

  private isNotFound(err: unknown): boolean {
    const e = err as { response?: { status?: number }; status?: number };
    return e?.response?.status === 404 || e?.status === 404;
  }
}

/**
 * Cut text to at most `maxBytes` of UTF-8 without splitting a character.
 * Stellar text memos are limited to 28 bytes, and accents or emoji take more
 * than one byte each, so slicing by characters can still overflow.
 */
function truncateUtf8(text: string, maxBytes: number): string {
  let out = '';
  for (const ch of text) {
    if (Buffer.byteLength(out + ch, 'utf8') > maxBytes) break;
    out += ch;
  }
  return out;
}
