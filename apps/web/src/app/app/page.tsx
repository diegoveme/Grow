"use client";

import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { BalanceCards } from "@/components/app/balance-cards";
import { SplitBar } from "@/components/app/split-bar";
import { ActivityList } from "@/components/app/activity-list";
import { Card, CardLabel } from "@/components/ui/card";
import { SendIcon, ReceiveIcon } from "@/components/app/icons";
import { useWallet } from "@/lib/wallet";
import { useAccount, useApy, usePayments, useRatio } from "@/lib/hooks";
import { formatApy, shortAddress } from "@/lib/format";

export default function OverviewPage() {
  const { address } = useWallet();
  const { data: info } = useAccount(address);
  const { data: payments } = usePayments(address, 5);
  const spendableBps = useRatio(address);
  const apy = useApy();

  if (!address) return null;

  return (
    <div className="animate-rise">
      <PageHeader
        eyebrow="Overview"
        title="Your roots"
        subtitle={`Connected as ${shortAddress(address, 6, 6)}`}
      />

      <BalanceCards info={info} />

      {/* Quick actions */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Link
          href="/app/send"
          className="group flex items-center justify-between rounded-md border border-luz/5 bg-tierra-mid/60 px-5 py-4 transition-colors hover:border-agua/40"
        >
          <div className="flex items-center gap-3">
            <SendIcon className="text-agua" />
            <div>
              <div className="text-sm font-medium">Send money</div>
              <div className="text-xs opacity-45">XLM or USDC, in seconds</div>
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
              <div className="text-sm font-medium">Receive money</div>
              <div className="text-xs opacity-45">Share your address · add USDC</div>
            </div>
          </div>
          <span className="text-oro opacity-0 transition-opacity group-hover:opacity-100">→</span>
        </Link>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Split */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between">
            <CardLabel>Your split</CardLabel>
            <Link href="/app/settings" className="text-xs text-agua/70 hover:text-agua">
              Adjust →
            </Link>
          </div>
          <p className="mb-5 text-sm opacity-55">
            Every USDC remittance you receive is divided automatically. Part stays spendable,
            part takes root and earns yield.
          </p>
          <SplitBar spendableBps={spendableBps} />
        </Card>

        {/* Yield teaser */}
        <Card className="flex flex-col justify-between">
          <CardLabel>Yield</CardLabel>
          <div>
            <div className="font-display text-4xl font-bold text-oro">
              {apy ? formatApy(apy.apy) : <span className="opacity-40">·</span>}
            </div>
            <div className="mt-1 text-xs opacity-45">
              {apy ? "Current APY · DeFindex to Blend" : "Configure a pool to go live"}
            </div>
          </div>
          <Link
            href="/app/yield"
            className="mt-4 text-xs uppercase tracking-wide text-oro/80 hover:text-oro"
          >
            View vault →
          </Link>
        </Card>
      </div>

      {/* Recent activity */}
      <Card className="mt-4">
        <div className="flex items-center justify-between">
          <CardLabel>Recent activity</CardLabel>
          <Link href="/app/activity" className="text-xs text-agua/70 hover:text-agua">
            See all →
          </Link>
        </div>
        <ActivityList
          items={payments ?? []}
          viewer={address}
          emptyHint="No transactions yet. Send or receive to get started."
        />
      </Card>
    </div>
  );
}
