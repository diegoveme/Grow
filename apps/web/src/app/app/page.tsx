"use client";

import { useState } from "react";
import { SiteNav } from "@/components/site-nav";
import { ConnectButton } from "@/components/connect-button";
import { PositionCard } from "@/components/dashboard/position-card";
import { YieldCard } from "@/components/dashboard/yield-card";
import { SplitConfig } from "@/components/dashboard/split-config";
import { SendForm } from "@/components/dashboard/send-form";
import { ManageCard } from "@/components/dashboard/manage-card";
import { useWallet } from "@/lib/wallet";
import { shortAddress } from "@/lib/format";

export default function DashboardPage() {
  const { address } = useWallet();
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey((k) => k + 1);

  return (
    <>
      <SiteNav />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 pb-24 pt-32">
        {!address ? (
          <ConnectGate />
        ) : (
          <div className="animate-rise">
            <div className="mb-10">
              <div className="text-xs uppercase tracking-[0.14em] text-agua/80">Dashboard</div>
              <h1 className="mt-2 font-display text-4xl font-bold">Welcome back</h1>
              <p className="mt-1 font-mono text-sm opacity-50">{shortAddress(address, 6, 6)}</p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              <PositionCard address={address} refreshKey={refreshKey} />
              <YieldCard />
              <SplitConfig onSaved={refresh} />
              <SendForm onSent={refresh} />
              <ManageCard onChange={refresh} />
            </div>
          </div>
        )}
      </main>
    </>
  );
}

function ConnectGate() {
  return (
    <div className="grid min-h-[50vh] place-items-center text-center">
      <div className="animate-rise">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full border border-agua/30 bg-semilla/40 text-2xl">
          🌱
        </div>
        <h1 className="font-display text-3xl font-bold">Connect your wallet</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm opacity-60">
          Connect a Stellar wallet to see your balances, set your split and send remittances
          that grow.
        </p>
        <div className="mt-8 flex justify-center">
          <ConnectButton />
        </div>
      </div>
    </div>
  );
}
