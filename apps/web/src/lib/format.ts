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

/** Format a token amount, trimming trailing zeros (e.g. "10.5 XLM"). */
export function formatAmount(amount: string | number, code?: string): string {
  const n = typeof amount === "string" ? Number(amount) : amount;
  const s = n.toLocaleString("en-US", { maximumFractionDigits: 7 });
  return code ? `${s} ${code}` : s;
}

/** Compact relative time, e.g. "3m ago", "2h ago", "5d ago". */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const secs = Math.max(1, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
