/** Pure share math for the DeFindex vault (all values in token base units). */

/** `amount` minus `bps` basis points, floored: the minimum we accept. */
export function withSlippage(amount: bigint, bps: bigint): bigint {
  return (amount * (10_000n - bps)) / 10_000n;
}

/**
 * Shares to burn so the user receives at least `amount`, given the USDC
 * `price` of `oneShare` shares. Rounds up; never more than `held`, and when
 * the request is within one share of everything held, burns everything so no
 * dust is left behind.
 */
export function sharesForAmount(
  amount: bigint,
  price: bigint,
  oneShare: bigint,
  held: bigint,
): bigint {
  if (amount <= 0n) throw new RangeError('amount must be positive');
  if (price <= 0n) throw new RangeError('vault price must be positive');
  const shares = (amount * oneShare + price - 1n) / price;
  return shares >= held - oneShare / 100n ? held : shares;
}
