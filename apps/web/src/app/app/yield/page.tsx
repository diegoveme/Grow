"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { SplitBar } from "@/components/app/split-bar";
import { Card, CardLabel, Stat } from "@/components/ui/card";
import { useWallet } from "@/lib/wallet";
import { useApy, useRatio } from "@/lib/hooks";
import { api } from "@/lib/api";
import type { VaultPosition } from "@raiz/shared";
import { formatApy, formatUsd } from "@/lib/format";

export default function YieldPage() {
  const { address } = useWallet();
  const apy = useApy();
  const spendableBps = useRatio(address);
  const [position, setPosition] = useState<VaultPosition | null>(null);
  const live = apy !== null;

  useEffect(() => {
    if (!address) return;
    api
      .vaultPosition(address)
      .then(setPosition)
      .catch(() => setPosition(null));
  }, [address]);

  if (!address) return null;

  return (
    <div className="mx-auto max-w-2xl animate-rise">
      <PageHeader
        eyebrow="Yield"
        title="Make it grow"
        subtitle="The part of every remittance you save takes root in a DeFindex vault, which supplies into a Blend lending pool and earns USDC yield."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <Stat
            value={apy ? formatApy(apy.apy) : "·"}
            label={apy ? `APY · ${apy.source}` : "APY · not configured"}
            accent="oro"
          />
        </Card>
        <Card>
          <Stat
            value={position ? formatUsd(position.currentValue) : "$0.00"}
            label="In vault"
            accent="oro"
          />
        </Card>
        <Card>
          <Stat
            value={position?.strategy ? "Blend" : "·"}
            label="Strategy"
            accent="brote"
          />
        </Card>
      </div>

      <Card className="mt-4">
        <CardLabel>Your split</CardLabel>
        <p className="mb-5 text-sm opacity-55">
          This is how incoming USDC is divided. Adjust it any time in Settings.
        </p>
        <SplitBar spendableBps={spendableBps} />
      </Card>

      <Card className="mt-4">
        <CardLabel>How yield works</CardLabel>
        <ol className="space-y-3 text-sm opacity-70">
          <li className="flex gap-3">
            <span className="text-oro">1.</span> You receive USDC; your chosen share is routed
            to the vault instead of sitting idle.
          </li>
          <li className="flex gap-3">
            <span className="text-oro">2.</span> The DeFindex vault supplies that USDC into a
            Blend lending pool as collateral.
          </li>
          <li className="flex gap-3">
            <span className="text-oro">3.</span> Borrowers pay interest; your balance grows in
            USDC. Withdraw any time, even cash out via a SEP-24 anchor.
          </li>
        </ol>
      </Card>

      {!live && (
        <div className="mt-4 rounded-md border border-dashed border-oro/25 bg-oro/5 px-5 py-4 text-sm">
          <div className="font-medium text-oro">Yield is in preview</div>
          <p className="mt-1 opacity-60">
            Live deposits/withdrawals go on once a DeFindex vault address + API key and a Blend
            testnet pool are configured. The split, balances, send and receive all work today.
          </p>
        </div>
      )}
    </div>
  );
}
