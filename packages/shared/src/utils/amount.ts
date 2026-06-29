import { STROOPS_PER_UNIT } from '../constants/network.js';

/** Convert a display amount (e.g. "140.5") to 7-decimal stroops as bigint. */
export function toStroops(amount: string | number): bigint {
  const [whole, frac = ''] = String(amount).split('.');
  const fracPadded = (frac + '0000000').slice(0, 7);
  return BigInt(whole || '0') * STROOPS_PER_UNIT + BigInt(fracPadded || '0');
}

/** Convert stroops (bigint) back to a fixed display string with 7 decimals trimmed. */
export function fromStroops(stroops: bigint, decimals = 2): string {
  const whole = stroops / STROOPS_PER_UNIT;
  const frac = stroops % STROOPS_PER_UNIT;
  const fracStr = frac.toString().padStart(7, '0').slice(0, decimals);
  return decimals > 0 ? `${whole}.${fracStr}` : `${whole}`;
}

/** Apply a basis-point split to an amount, returning [spendable, vault] in stroops. */
export function applySplit(
  amountStroops: bigint,
  spendableBps: number,
): { spendable: bigint; vault: bigint } {
  const spendable = (amountStroops * BigInt(spendableBps)) / 10_000n;
  return { spendable, vault: amountStroops - spendable };
}
