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

/** "3 min", "2 h", "5 d": a compact span, in the language's short units. */
function span(secs: number, locale: "en" | "es"): string {
  const unit = locale === "es" ? { s: " s", m: " min", h: " h", d: " d" } : { s: "s", m: "m", h: "h", d: "d" };
  if (secs < 60) return `${secs}${unit.s}`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}${unit.m}`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}${unit.h}`;
  return `${Math.floor(hours / 24)}${unit.d}`;
}

/** Compact relative time, e.g. "3m ago" / "hace 3 min"; dates past a month. */
export function timeAgo(iso: string, locale: "en" | "es" = "en"): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const secs = Math.max(1, Math.floor((Date.now() - then) / 1000));
  if (secs >= 30 * 86_400) {
    return new Date(iso).toLocaleDateString(locale === "es" ? "es" : "en-US", {
      month: "short",
      day: "numeric",
    });
  }
  return locale === "es" ? `hace ${span(secs, locale)}` : `${span(secs, locale)} ago`;
}

/** Compact number for KPIs and axes: 1,284 / 12.9K / 4.2M. */
export function formatCompact(value: string | number): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (Math.abs(n) < 10_000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

/** Compact time until a future moment, e.g. "in 3m" / "en 3 min", or "now". */
export function timeUntil(iso: string, locale: "en" | "es" = "en"): string {
  const secs = Math.floor((new Date(iso).getTime() - Date.now()) / 1000);
  if (Number.isNaN(secs) || secs <= 0) return locale === "es" ? "ahora" : "now";
  return locale === "es" ? `en ${span(secs, locale)}` : `in ${span(secs, locale)}`;
}
