"use client";

import { PageHeader } from "@/components/app/page-header";
import { ActivityList } from "@/components/app/activity-list";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/lib/wallet";
import { usePayments } from "@/lib/hooks";
import { explorerAccount } from "@/lib/config";
import { useT } from "@/lib/i18n";

export default function ActivityPage() {
  const { address } = useWallet();
  const t = useT();
  const { data: payments, loading, refresh } = usePayments(address, 50);

  if (!address) return null;

  return (
    <div className="mx-auto max-w-2xl animate-rise">
      <PageHeader
        eyebrow={t.activity.eyebrow}
        title={t.activity.title}
        subtitle={t.activity.subtitle}
        action={
          <Button variant="ghost" onClick={() => refresh()} disabled={loading}>
            {loading ? t.activity.refreshing : t.activity.refresh}
          </Button>
        }
      />

      <Card>
        <ActivityList
          items={payments ?? []}
          viewer={address}
          emptyHint={t.activity.empty}
        />
      </Card>

      <a
        href={explorerAccount(address)}
        target="_blank"
        rel="noreferrer"
        className="mt-4 block text-center text-xs text-agua/70 hover:text-agua"
      >
        {t.activity.fullAccount}
      </a>
    </div>
  );
}
