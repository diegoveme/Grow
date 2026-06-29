import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  DEFAULT_SPLIT,
  applySplit,
  fromStroops,
  toStroops,
  type Remittance,
  type RemittanceStatus,
} from '@raiz/shared';
import { DatabaseService } from '../database/database.service';
import { CreateRemittanceDto } from './dto';

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
 * Tracks remittances as they move through the Raíz pipeline. Persists to
 * Supabase (Postgres) when configured, otherwise keeps an in-memory map so the
 * API works in any environment. The chain remains the source of truth for
 * balances; this stores the off-chain timeline the UI renders.
 */
@Injectable()
export class RemittancesService {
  private readonly memory = new Map<string, Remittance>();

  constructor(private readonly db: DatabaseService) {}

  /** Compute the spendable/vault breakdown for an amount without persisting. */
  preview(amount: string, spendableBps: number = DEFAULT_SPLIT.spendableBps) {
    const stroops = toStroops(amount);
    const { spendable, vault } = applySplit(stroops, spendableBps);
    return {
      amount,
      spendableBps,
      vaultBps: 10000 - spendableBps,
      spendable: fromStroops(spendable),
      vault: fromStroops(vault),
    };
  }

  async create(dto: CreateRemittanceDto): Promise<Remittance> {
    const spendableBps = dto.spendableBps ?? DEFAULT_SPLIT.spendableBps;
    const remittance: Remittance = {
      id: randomUUID(),
      from: dto.from,
      to: dto.to,
      amount: dto.amount,
      asset: 'USDC',
      status: 'pending',
      split: { spendableBps, vaultBps: 10000 - spendableBps },
      createdAt: new Date().toISOString(),
    };

    if (this.db.enabled) {
      await this.db.sql`
        insert into remittances
          (id, from_address, to_address, amount, asset, status, spendable_bps, vault_bps, created_at)
        values
          (${remittance.id}, ${remittance.from}, ${remittance.to}, ${remittance.amount},
           ${remittance.asset}, ${remittance.status}, ${spendableBps}, ${10000 - spendableBps},
           ${remittance.createdAt})
      `;
    } else {
      this.memory.set(remittance.id, remittance);
    }
    return remittance;
  }

  async list(address?: string): Promise<Remittance[]> {
    if (this.db.enabled) {
      const rows = address
        ? await this.db.sql<RemittanceRow[]>`
            select * from remittances
            where from_address = ${address} or to_address = ${address}
            order by created_at desc`
        : await this.db.sql<RemittanceRow[]>`
            select * from remittances order by created_at desc`;
      return rows.map(toRemittance);
    }
    const all = [...this.memory.values()].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
    return address ? all.filter((r) => r.from === address || r.to === address) : all;
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

  async updateStatus(
    id: string,
    status: RemittanceStatus,
    txHash?: string,
  ): Promise<Remittance> {
    if (this.db.enabled) {
      const [row] = await this.db.sql<RemittanceRow[]>`
        update remittances
        set status = ${status}, tx_hash = coalesce(${txHash ?? null}, tx_hash)
        where id = ${id}
        returning *`;
      if (!row) throw new NotFoundException(`Remittance ${id} not found`);
      return toRemittance(row);
    }
    const remittance = await this.get(id);
    remittance.status = status;
    if (txHash) remittance.txHash = txHash;
    this.memory.set(id, remittance);
    return remittance;
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
