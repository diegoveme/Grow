/** Shorten a Stellar address for display, e.g. GABC…WXYZ. */
export function shortAddress(address: string, lead = 4, tail = 4): string {
  if (address.length <= lead + tail) return address;
  return `${address.slice(0, lead)}…${address.slice(-tail)}`;
}

/** Format a fractional APY (0.062) as a percentage string ("6.2%"). */
export function formatApy(apy: number): string {
  return `${(apy * 100).toFixed(2)}%`;
}

/** Format a USDC display string with a leading $ and 2 decimals. */
export function formatUsd(amount: string | number): string {
  const n = typeof amount === "string" ? Number(amount) : amount;
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
