"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { SplitBar } from "@/components/app/split-bar";
import { Card, CardLabel, Stat } from "@/components/ui/card";
import { VaultManage } from "@/components/app/vault-manage";
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

  const refreshPosition = useCallback(() => {
    if (!address) return;
    api
      .vaultPosition(address)
      .then(setPosition)
      .catch(() => setPosition(null));
  }, [address]);

  useEffect(() => refreshPosition(), [refreshPosition]);

  if (!address) return null;

  return (
    <div className="mx-auto max-w-2xl animate-rise">
      <PageHeader
        eyebrow="Vault"
        title="Savings vault"
        subtitle="Move USDC into a DeFindex vault that supplies a Blend lending pool. Deposits come from your wallet and you can withdraw any time."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <Stat
            value={apy ? formatApy(apy.apy) : "·"}
            label={apy ? `Variable rate · ${apy.source}` : "Rate · not configured"}
            accent="oro"
          />
        </Card>
        <Card>
          <Stat
            value={position ? formatUsd(position.currentValue) : "$0.00"}
            label={position ? `In vault · ${Number(position.shares).toLocaleString("en-US", { maximumFractionDigits: 2 })} shares` : "In vault"}
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

      {live && <VaultManage address={address} onDone={refreshPosition} />}

      <Card className="mt-4">
        <CardLabel>Your split</CardLabel>
        <p className="mb-5 text-sm opacity-55">
          This is how incoming USDC is divided. Adjust it any time in Settings.
        </p>
        <SplitBar spendableBps={spendableBps} />
      </Card>

      <Card className="mt-4">
        <CardLabel>How the vault works</CardLabel>
        <ol className="space-y-3 text-sm opacity-70">
          <li className="flex gap-3">
            <span className="text-oro">1.</span> Remittances sent through Grow save your chosen
            share for you. Withdraw those savings to your wallet from the Overview.
          </li>
          <li className="flex gap-3">
            <span className="text-oro">2.</span> Deposit USDC from your wallet here. The DeFindex
            vault supplies it into a Blend lending pool.
          </li>
          <li className="flex gap-3">
            <span className="text-oro">3.</span> Borrowers pay interest to the pool at a variable
            rate that is not guaranteed. Withdraw back to your wallet any time.
          </li>
        </ol>
      </Card>

      {!live && (
        <div className="mt-4 rounded-md border border-dashed border-oro/25 bg-oro/5 px-5 py-4 text-sm">
          <div className="font-medium text-oro">The vault is in preview</div>
          <p className="mt-1 opacity-60">
            Live deposits/withdrawals go on once a DeFindex vault address + API key and a Blend
            testnet pool are configured. The split, balances, send and receive all work today.
          </p>
        </div>
      )}
    </div>
  );
}
