/** Domain types shared across the Raíz web app and API. */

/** A configurable split of incoming funds between spendable and vault. */
export interface SplitConfig {
  /** Basis points kept spendable (0–10000). */
  spendableBps: number;
  /** Basis points routed to the yield vault (0–10000). spendable + vault = 10000. */
  vaultBps: number;
}

/**
 * A recipient's position in the `yield_splitter` contract. The spendable part
 * of each remittance is paid straight to their wallet, so only savings and the
 * chosen split live on-chain here.
 */
export interface AccountState {
  address: string;
  /** USDC savings held by the contract for this recipient (display units). */
  savings: string;
  split: SplitConfig;
}

/** Global `yield_splitter` settings (beta guardrails). */
export interface SplitterConfig {
  contractId: string;
  admin: string;
  token: string;
  /** Max savings the contract holds per recipient (display units). */
  userCap: string;
  /** When true, new remittances are rejected; withdrawals still work. */
  paused: boolean;
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
