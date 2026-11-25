import type { AssetCode } from '@raiz/shared';

export interface BalanceEntry {
  asset: AssetCode;
  balance: string;
  issuer?: string;
}

/** Balances, funding state and USDC trustline status of an account. */
export interface AccountInfo {
  address: string;
  exists: boolean;
  funded: boolean;
  usdcTrustline: boolean;
  balances: BalanceEntry[];
  xlm: string;
  usdc: string | null;
}

/** One entry of the activity feed, from the viewer's point of view. */
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
