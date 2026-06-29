/** Domain types shared across the Raíz web app and API. */

/** A configurable split of incoming funds between spendable and vault. */
export interface SplitConfig {
  /** Basis points kept spendable (0–10000). */
  spendableBps: number;
  /** Basis points routed to the yield vault (0–10000). spendable + vault = 10000. */
  vaultBps: number;
}

/** The on-chain + derived state of a recipient account in Raíz. */
export interface AccountState {
  address: string;
  /** Spendable USDC balance (display units, e.g. "140.00"). */
  walletBalance: string;
  /** Value currently held in the vault (display units). */
  vaultBalance: string;
  /** Yield accrued and claimable (display units). */
  earnedYield: string;
  split: SplitConfig;
}

export type RemittanceStatus =
  | 'pending'
  | 'received'
  | 'split'
  | 'deposited'
  | 'completed'
  | 'failed';

/** A single remittance moving through the Raíz pipeline. */
export interface Remittance {
  id: string;
  /** Sender public key or external reference. */
  from: string;
  /** Recipient public key. */
  to: string;
  /** Total amount in USDC (display units). */
  amount: string;
  asset: string;
  status: RemittanceStatus;
  split: SplitConfig;
  /** ISO-8601 timestamp. */
  createdAt: string;
  /** Stellar transaction hash, once on-chain. */
  txHash?: string;
}

/** Vault metrics surfaced to the user. */
export interface VaultPosition {
  vaultAddress: string;
  /** Principal deposited (display units). */
  principal: string;
  /** Current value including yield (display units). */
  currentValue: string;
  /** Annual percentage yield, as a fraction (0.06 = 6%). */
  apy: number;
  /** Underlying strategy, e.g. "Blend USDC pool". */
  strategy: string;
}

/** SEP-24 interactive transaction, mirrored from the anchor. */
export interface AnchorTransaction {
  id: string;
  kind: 'deposit' | 'withdrawal';
  status: string;
  amountIn?: string;
  amountOut?: string;
  /** Interactive popup URL, when present. */
  moreInfoUrl?: string;
  startedAt?: string;
}
