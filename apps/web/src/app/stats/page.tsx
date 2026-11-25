"use client";

import { ExplorerLink } from "@/components/app/explorer-link";
import { SiteNav } from "@/components/site-nav";
import { DailyVolumeChart } from "@/components/stats/daily-volume-chart";
import { Card, CardLabel, Stat } from "@/components/ui/card";
import { api, type PublicStats } from "@/lib/api";
import { explorerContract } from "@/lib/config";
import { formatCompact, shortAddress, timeAgo } from "@/lib/format";
import { useResource } from "@/lib/hooks";

/** Public, wallet-free view of how much moves through the Grow contract. */
export default function StatsPage() {
  const { data: stats, error } = useResource<PublicStats>(() => api.stats(), [], 30_000);

  return (
    <div className="min-h-screen bg-tierra">
      <SiteNav />
      <main className="mx-auto max-w-4xl px-6 pb-20 pt-28 md:px-10">
        <div className="text-xs uppercase tracking-[0.18em] text-agua/80">Transparency</div>
        <h1 className="mt-2 font-display text-4xl font-bold">Grow on-chain</h1>
        <p className="mt-2 max-w-2xl text-sm text-luz-tenue">
          Every number here is computed from the yield_splitter contract&apos;s own events, and
          the savings held are read live from the USDC balance of the contract.
        </p>

        {error && !stats && (
          <p className="mt-8 text-sm text-oro">Stats are not available right now.</p>
        )}

        {stats && (
          <>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <Stat value={formatCompact(stats.remittances)} label="Remittances" />
              </Card>
              <Card>
                <Stat value={`$${formatCompact(stats.volume)}`} label="Volume sent (USDC)" />
              </Card>
              <Card>
                <Stat value={formatCompact(stats.uniqueRecipients)} label="Families reached" />
              </Card>
              <Card>
                <Stat
                  value={stats.savingsHeld === null ? "·" : `$${formatCompact(stats.savingsHeld)}`}
                  label="Savings held now"
                />
              </Card>
            </div>

            <Card className="mt-4">
              <CardLabel>Daily volume through Grow (USDC)</CardLabel>
              <DailyVolumeChart data={stats.daily} />
            </Card>

            <Card className="mt-4">
              <CardLabel>Where the money went</CardLabel>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <Row label="Paid straight to wallets" value={stats.paidToWallets} />
                <Row label="Saved from remittances" value={stats.savedFromRemittances} />
                <Row label="Set aside by recipients" value={stats.setAside} />
                <Row label="Withdrawn from savings" value={stats.withdrawn} />
              </dl>
            </Card>

            <p className="mt-6 text-xs text-luz-tenue/70">
              {stats.network === "PUBLIC" ? "Mainnet" : "Testnet"} contract{" "}
              <ExplorerLink href={explorerContract(stats.contractId)} className="text-agua">
                {shortAddress(stats.contractId, 6, 6)}
              </ExplorerLink>
              {stats.lastEventAt && <> · last activity {timeAgo(stats.lastEventAt)}</>}
              {stats.syncedLedger && <> · indexed to ledger {stats.syncedLedger.toLocaleString("en-US")}</>}
            </p>
          </>
        )}
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-luz/5 pb-2">
      <dt className="text-luz-tenue">{label}</dt>
      <dd className="font-medium">${Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 })}</dd>
    </div>
  );
}
