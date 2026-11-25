import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { rpc, scValToNative } from '@stellar/stellar-sdk';
import {
  BPS_DENOMINATOR,
  DEFAULT_SPLIT,
  applySplit,
  fromStroops,
  toStroops,
  type Remittance,
  type RemittanceStatus,
} from '@raiz/shared';
import { DatabaseService } from '../database/database.service';
import { SorobanService } from '../stellar/soroban.service';
import { invokedContract } from './receive-call';
import type { AppConfig } from '../config/configuration';

interface RemittanceRow {
  id: string;
  from_address: string;
  to_address: string;
  amount: string;
  asset: string;
  status: string;
  spendable_bps: number;
  vault_bps: number;
  tx_hash: string | null;
  created_at: Date;
}

/**
 * Off-chain timeline of remittances sent through the `yield_splitter`
 * contract. Nothing is recorded on the client's word: a remittance is stored
 * only after its transaction is found on-chain as a successful `receive` call
 * on our contract, and every field comes from that transaction.
 *
 * Persists to Supabase (Postgres) when configured, otherwise in memory.
 */
@Injectable()
export class RemittancesService {
  private readonly memory = new Map<string, Remittance>();

  constructor(
    private readonly db: DatabaseService,
    private readonly soroban: SorobanService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  /** Compute the spendable/savings breakdown for an amount without persisting. */
  preview(amount: string, spendableBps: number = DEFAULT_SPLIT.spendableBps) {
    const { spendable, vault } = applySplit(toStroops(amount), spendableBps);
    return {
      amount,
      spendableBps,
      vaultBps: BPS_DENOMINATOR - spendableBps,
      spendable: fromStroops(spendable, 7),
      vault: fromStroops(vault, 7),
    };
  }

  /** Record a remittance from the hash of its on-chain `receive` transaction. */
  async record(txHash: string): Promise<Remittance> {
    const hash = txHash.toLowerCase();
    const existing = await this.findByHash(hash);
    if (existing) return existing;

    const remittance = await this.fromChain(hash);
    if (this.db.enabled) {
      await this.db.sql`
        insert into remittances
          (id, from_address, to_address, amount, asset, status, spendable_bps, vault_bps,
           tx_hash, created_at)
        values
          (${remittance.id}, ${remittance.from}, ${remittance.to}, ${remittance.amount},
           ${remittance.asset}, ${remittance.status}, ${remittance.split.spendableBps},
           ${remittance.split.vaultBps}, ${hash}, ${remittance.createdAt})
        on conflict (tx_hash) do nothing
      `;
      return (await this.findByHash(hash)) ?? remittance;
    }
    this.memory.set(remittance.id, remittance);
    return remittance;
  }

  async list(address: string): Promise<Remittance[]> {
    if (this.db.enabled) {
      const rows = await this.db.sql<RemittanceRow[]>`
        select * from remittances
        where from_address = ${address} or to_address = ${address}
        order by created_at desc
        limit 100`;
      return rows.map(toRemittance);
    }
    return [...this.memory.values()]
      .filter((r) => r.from === address || r.to === address)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async get(id: string): Promise<Remittance> {
    if (this.db.enabled) {
      const [row] = await this.db.sql<RemittanceRow[]>`
        select * from remittances where id = ${id} limit 1`;
      if (!row) throw new NotFoundException(`Remittance ${id} not found`);
      return toRemittance(row);
    }
    const remittance = this.memory.get(id);
    if (!remittance) throw new NotFoundException(`Remittance ${id} not found`);
    return remittance;
  }

  private async findByHash(hash: string): Promise<Remittance | undefined> {
    if (this.db.enabled) {
      const [row] = await this.db.sql<RemittanceRow[]>`
        select * from remittances where tx_hash = ${hash} limit 1`;
      return row ? toRemittance(row) : undefined;
    }
    return [...this.memory.values()].find((r) => r.txHash === hash);
  }

  /** Load the transaction and check it is a successful `receive` on our contract. */
  private async fromChain(hash: string): Promise<Remittance> {
    const splitter = this.config.get('contracts', { infer: true }).yieldSplitter;
    if (!splitter) {
      throw new ServiceUnavailableException('YIELD_SPLITTER_CONTRACT_ID is not configured.');
    }

    const tx = await this.soroban.server.getTransaction(hash);
    if (tx.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
      throw new BadRequestException(
        tx.status === rpc.Api.GetTransactionStatus.NOT_FOUND
          ? 'Transaction not found yet. Try again in a few seconds.'
          : 'That transaction failed on-chain, so there is nothing to record.',
      );
    }

    const call = invokedContract(tx.envelopeXdr);
    if (!call || call.contract !== splitter || call.fn !== 'receive' || call.args.length !== 3) {
      throw new BadRequestException('That transaction is not a Grow remittance.');
    }
    const [from, to, amount] = call.args.map((a) => scValToNative(a)) as [string, string, bigint];
    const [spendable] = (tx.returnValue ? scValToNative(tx.returnValue) : [0n]) as [bigint];
    const spendableBps =
      amount > 0n ? Number((BigInt(spendable) * BigInt(BPS_DENOMINATOR)) / BigInt(amount)) : 0;

    return {
      id: randomUUID(),
      from,
      to,
      amount: fromStroops(BigInt(amount), 7),
      asset: 'USDC',
      status: 'completed',
      split: { spendableBps, vaultBps: BPS_DENOMINATOR - spendableBps },
      createdAt: new Date(tx.createdAt * 1000).toISOString(),
      txHash: hash,
    };
  }
}

function toRemittance(row: RemittanceRow): Remittance {
  return {
    id: row.id,
    from: row.from_address,
    to: row.to_address,
    amount: row.amount,
    asset: row.asset,
    status: row.status as RemittanceStatus,
    split: { spendableBps: row.spendable_bps, vaultBps: row.vault_bps },
    createdAt:
      row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    txHash: row.tx_hash ?? undefined,
  };
}
