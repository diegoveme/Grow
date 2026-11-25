"use client";

import { Card } from "@/components/ui/card";
import type { AccountInfo } from "@/lib/api";
import { config } from "@/lib/config";
import { formatAmount } from "@/lib/format";
import { useT } from "@/lib/i18n";


/** USDC + XLM balance tiles, driven by live account info. */
export function BalanceCards({ info }: { info: AccountInfo | null }) {
  const t = useT();
  const network = config.network === "PUBLIC" ? t.network.mainnet : t.network.testnet;
  const usdc = info?.usdc ?? null;
  const xlm = info?.xlm ?? "0";

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card className="relative overflow-hidden">
        <div className="text-xs uppercase tracking-[0.14em] text-oro/80">{t.balances.usdc}</div>
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
            ? t.balances.noTrustline
            : t.balances.usdcNetwork(network)}
        </div>
        <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-oro/10 blur-2xl" />
      </Card>

      <Card className="relative overflow-hidden">
        <div className="text-xs uppercase tracking-[0.14em] text-agua/80">{t.balances.xlm}</div>
        <div className="mt-3 font-display text-4xl font-bold">{formatAmount(xlm)}</div>
        <div className="mt-2 text-xs opacity-45">
          {info?.funded ? t.balances.xlmNative : t.balances.notFunded}
        </div>
        <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-agua/10 blur-2xl" />
      </Card>
    </div>
  );
}
