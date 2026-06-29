"use client";

import { useEffect, useState } from "react";
import type { AccountState } from "@raiz/shared";
import { Card, CardLabel, Stat } from "@/components/ui/card";
import { api } from "@/lib/api";
import { formatUsd } from "@/lib/format";

const EMPTY: Omit<AccountState, "address"> = {
  walletBalance: "0",
  vaultBalance: "0",
  earnedYield: "0",
  split: { spendableBps: 7000, vaultBps: 3000 },
};

/** Headline balances for the connected recipient, read from the contract. */
export function PositionCard({ address, refreshKey = 0 }: { address: string; refreshKey?: number }) {
  const [pos, setPos] = useState<Omit<AccountState, "address">>(EMPTY);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let active = true;
    setPending(true);
    api
      .position(address)
      .then((p) => active && setPos(p))
      .catch(() => active && setPos(EMPTY))
      .finally(() => active && setPending(false));
    return () => {
      active = false;
    };
  }, [address, refreshKey]);

  return (
    <Card className="md:col-span-2">
      <div className="flex items-center justify-between">
        <CardLabel>Your balances</CardLabel>
        {pending && <span className="text-xs opacity-40">syncing…</span>}
      </div>
      <div className="grid grid-cols-3 gap-6">
        <Stat value={formatUsd(pos.walletBalance)} label="Spendable" accent="agua" />
        <Stat value={formatUsd(pos.vaultBalance)} label="In vault" accent="oro" />
        <Stat value={formatUsd(pos.earnedYield)} label="Yield earned" accent="brote" />
      </div>
    </Card>
  );
}
