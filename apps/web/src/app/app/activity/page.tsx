"use client";

import { PageHeader } from "@/components/app/page-header";
import { ActivityList } from "@/components/app/activity-list";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/lib/wallet";
import { usePayments } from "@/lib/hooks";
import { explorerAccount } from "@/lib/config";

export default function ActivityPage() {
  const { address } = useWallet();
  const { data: payments, loading, refresh } = usePayments(address, 50);

  if (!address) return null;

  return (
    <div className="mx-auto max-w-2xl animate-rise">
      <PageHeader
        eyebrow="Activity"
        title="Transaction history"
        subtitle="Every payment in and out of your wallet, straight from the Stellar ledger."
        action={
          <Button variant="ghost" onClick={() => refresh()} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
        }
      />

      <Card>
        <ActivityList
          items={payments ?? []}
          viewer={address}
          emptyHint="No transactions yet. Once you send or receive, they'll show up here."
        />
      </Card>

      <a
        href={explorerAccount(address)}
        target="_blank"
        rel="noreferrer"
        className="mt-4 block text-center text-xs text-agua/70 hover:text-agua"
      >
        View full account on Stellar Expert ↗
      </a>
    </div>
  );
}
