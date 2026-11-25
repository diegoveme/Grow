"use client";

import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { BalanceCards } from "@/components/app/balance-cards";
import { SplitBar } from "@/components/app/split-bar";
import { ActivityList } from "@/components/app/activity-list";
import { SavingsCard } from "@/components/app/savings-card";
import { Card, CardLabel } from "@/components/ui/card";
import { SendIcon, ReceiveIcon } from "@/components/app/icons";
import { useWallet } from "@/lib/wallet";
import { useAccount, useApy, usePayments, useRatio } from "@/lib/hooks";
import { formatApy, shortAddress } from "@/lib/format";
import { useT } from "@/lib/i18n";

export default function OverviewPage() {
  const { address } = useWallet();
  const t = useT();
  const { data: info } = useAccount(address);
  const { data: payments } = usePayments(address, 5);
  const spendableBps = useRatio(address);
  const apy = useApy();

  if (!address) return null;

  return (
    <div className="animate-rise">
      <PageHeader
        eyebrow={t.overview.eyebrow}
        title={t.overview.title}
        subtitle={t.overview.connectedAs(shortAddress(address, 6, 6))}
      />

      <BalanceCards info={info} />

      <div className="mt-4">
        <SavingsCard address={address} />
      </div>

      {/* Quick actions */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Link
          href="/app/send"
          className="group flex items-center justify-between rounded-md border border-luz/5 bg-tierra-mid/60 px-5 py-4 transition-colors hover:border-agua/40"
        >
          <div className="flex items-center gap-3">
            <SendIcon className="text-agua" />
            <div>
              <div className="text-sm font-medium">{t.overview.sendMoney}</div>
              <div className="text-xs opacity-45">{t.overview.sendHint}</div>
            </div>
          </div>
          <span className="text-agua opacity-0 transition-opacity group-hover:opacity-100">→</span>
        </Link>
        <Link
          href="/app/receive"
          className="group flex items-center justify-between rounded-md border border-luz/5 bg-tierra-mid/60 px-5 py-4 transition-colors hover:border-oro/40"
        >
          <div className="flex items-center gap-3">
            <ReceiveIcon className="text-oro" />
            <div>
              <div className="text-sm font-medium">{t.overview.receiveMoney}</div>
              <div className="text-xs opacity-45">{t.overview.receiveHint}</div>
            </div>
          </div>
          <span className="text-oro opacity-0 transition-opacity group-hover:opacity-100">→</span>
        </Link>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Split */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between">
            <CardLabel>{t.overview.yourSplit}</CardLabel>
            <Link href="/app/settings" className="text-xs text-agua/70 hover:text-agua">
              {t.overview.adjust}
            </Link>
          </div>
          <p className="mb-5 text-sm opacity-55">{t.overview.splitBody}</p>
          <SplitBar spendableBps={spendableBps} />
        </Card>

        {/* Vault teaser */}
        <Card className="flex flex-col justify-between">
          <CardLabel>{t.overview.vault}</CardLabel>
          <div>
            <div className="font-display text-4xl font-bold text-oro">
              {apy ? formatApy(apy.apy) : <span className="opacity-40">·</span>}
            </div>
            <div className="mt-1 text-xs opacity-45">
              {apy ? t.overview.vaultRate : t.overview.vaultOff}
            </div>
          </div>
          <Link
            href="/app/yield"
            className="mt-4 text-xs uppercase tracking-wide text-oro/80 hover:text-oro"
          >
            {t.overview.viewVault}
          </Link>
        </Card>
      </div>

      {/* Recent activity */}
      <Card className="mt-4">
        <div className="flex items-center justify-between">
          <CardLabel>{t.overview.recentActivity}</CardLabel>
          <Link href="/app/activity" className="text-xs text-agua/70 hover:text-agua">
            {t.overview.seeAll}
          </Link>
        </div>
        <ActivityList
          items={payments ?? []}
          viewer={address}
          emptyHint={t.overview.empty}
        />
      </Card>
    </div>
  );
}
