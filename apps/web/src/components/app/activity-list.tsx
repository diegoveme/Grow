"use client";

import type { PaymentRecord } from "@/lib/api";
import { explorerTx } from "@/lib/config";
import { formatAmount, shortAddress, timeAgo } from "@/lib/format";

export function ActivityList({
  items,
  viewer,
  emptyHint,
}: {
  items: PaymentRecord[];
  viewer: string;
  emptyHint?: string;
}) {
  if (!items.length) {
    return (
      <div className="rounded-md border border-dashed border-luz/10 px-4 py-10 text-center text-sm opacity-50">
        {emptyHint ?? "No transactions yet."}
      </div>
    );
  }

  return (
    <ul className="divide-y divide-luz/5">
      {items.map((p) => {
        const incoming = p.direction === "in";
        const counterparty = incoming ? p.from : p.to;
        const sign = incoming ? "+" : "−";
        const code = p.asset === "XLM" ? "XLM" : p.asset === "USDC" ? "USDC" : p.asset;
        return (
          <li key={p.id} className="flex items-center gap-3 py-3.5">
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm ${
                incoming ? "bg-brote/15 text-brote" : "bg-agua/10 text-agua"
              }`}
            >
              {incoming ? "↓" : "↑"}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm">
                {p.type === "create_account"
                  ? "Account created"
                  : incoming
                    ? "Received"
                    : "Sent"}
                <span className="opacity-40">
                  {" "}
                  {incoming ? "from" : "to"} {shortAddress(counterparty || "account", 4, 4)}
                </span>
              </div>
              <a
                href={explorerTx(p.hash)}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-xs opacity-40 transition-colors hover:text-agua"
              >
                {timeAgo(p.createdAt)} · {shortAddress(p.hash, 6, 4)} ↗
              </a>
            </div>
            <div
              className={`shrink-0 text-right font-medium ${
                incoming ? "text-brote" : "text-luz"
              }`}
            >
              {sign}
              {formatAmount(p.amount)} <span className="text-xs opacity-50">{code}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
