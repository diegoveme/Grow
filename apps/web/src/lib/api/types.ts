import type { AssetCode } from "@raiz/shared";

export type { AssetCode };

export interface SplitPreview {
  amount: string;
  spendableBps: number;
  vaultBps: number;
  spendable: string;
  vault: string;
}

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
  direction: "in" | "out" | "self";
  asset: AssetCode | string;
  amount: string;
  from: string;
  to: string;
  createdAt: string;
  hash: string;
}
