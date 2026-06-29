/**
 * Stellar primitives shared across the web app and API: address validation,
 * the canonical asset-code list and basis-point math. Single source of truth so
 * a regex or a new asset is defined in exactly one place.
 */

/** A Stellar public key (ed25519 account, starts with G). */
export const STELLAR_ADDRESS_REGEX = /^G[A-Z2-7]{55}$/;

/** A Soroban contract id (starts with C). */
export const CONTRACT_ID_REGEX = /^C[A-Z2-7]{55}$/;

export function isStellarAddress(value: string): boolean {
  return STELLAR_ADDRESS_REGEX.test(value);
}

export function isContractId(value: string): boolean {
  return CONTRACT_ID_REGEX.test(value);
}

/** Assets Raíz moves today. Classic issuers are resolved at the app layer. */
export const ASSET_CODES = ['XLM', 'USDC'] as const;
export type AssetCode = (typeof ASSET_CODES)[number];

/** Basis-point denominator (10000 = 100%). */
export const BPS_DENOMINATOR = 10_000;

/** Split the spendable basis points into a full {spendableBps, vaultBps} pair. */
export function splitFromSpendable(spendableBps: number): {
  spendableBps: number;
  vaultBps: number;
} {
  const clamped = Math.max(0, Math.min(BPS_DENOMINATOR, Math.round(spendableBps)));
  return { spendableBps: clamped, vaultBps: BPS_DENOMINATOR - clamped };
}
