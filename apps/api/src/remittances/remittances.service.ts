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
import { CreateRemittanceDto } from './dto';

/**
 * Tracks remittances as they move through the Raíz pipeline. The source of
 * truth for balances is the chain; this keeps the off-chain metadata (status,
 * timeline) the UI renders. Backed by an in-memory map — swap for a database
 * by implementing the same surface.
 */
@Injectable()
export class RemittancesService {
  private readonly store = new Map<string, Remittance>();

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

  create(dto: CreateRemittanceDto): Remittance {
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
    this.store.set(remittance.id, remittance);
    return remittance;
  }

  list(address?: string): Remittance[] {
    const all = [...this.store.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (!address) return all;
    return all.filter((r) => r.from === address || r.to === address);
  }

  get(id: string): Remittance {
    const remittance = this.store.get(id);
    if (!remittance) throw new NotFoundException(`Remittance ${id} not found`);
    return remittance;
  }

  updateStatus(id: string, status: RemittanceStatus, txHash?: string): Remittance {
    const remittance = this.get(id);
    remittance.status = status;
    if (txHash) remittance.txHash = txHash;
    this.store.set(id, remittance);
    return remittance;
  }
}
