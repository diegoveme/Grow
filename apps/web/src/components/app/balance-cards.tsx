"use client";

import { Card } from "@/components/ui/card";
import type { AccountInfo } from "@/lib/api";
import { formatAmount } from "@/lib/format";

/** USDC + XLM balance tiles, driven by live account info. */
export function BalanceCards({ info, loading }: { info: AccountInfo | null; loading?: boolean }) {
  const usdc = info?.usdc ?? null;
  const xlm = info?.xlm ?? "0";

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card className="relative overflow-hidden">
        <div className="text-xs uppercase tracking-[0.14em] text-oro/80">USDC balance</div>
        <div className="mt-3 font-display text-4xl font-bold">
          {usdc === null ? (
            <span className="opacity-40">·</span>
          ) : (
            <>
              <span className="opacity-40">$</span>
              {formatAmount(usdc)}
            </>
          )}
        </div>
        <div className="mt-2 text-xs opacity-45">
          {usdc === null
            ? "No USDC trustline yet. Add it from Receive."
            : "Stellar USDC · testnet"}
        </div>
        <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-oro/10 blur-2xl" />
      </Card>

      <Card className="relative overflow-hidden">
        <div className="text-xs uppercase tracking-[0.14em] text-agua/80">XLM balance</div>
        <div className="mt-3 font-display text-4xl font-bold">{formatAmount(xlm)}</div>
        <div className="mt-2 text-xs opacity-45">
          {info?.funded ? "Native · pays network fees" : "Account not funded yet"}
        </div>
        <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-agua/10 blur-2xl" />
      </Card>

      {loading && (
        <div className="sm:col-span-2 -mt-2 text-xs opacity-40">Refreshing balances…</div>
      )}
    </div>
  );
}
