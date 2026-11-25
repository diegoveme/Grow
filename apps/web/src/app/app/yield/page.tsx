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
import { useLocale, useT } from "@/lib/i18n";

export default function YieldPage() {
  const { address } = useWallet();
  const t = useT();
  const { locale } = useLocale();
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
        eyebrow={t.vault.eyebrow}
        title={t.vault.title}
        subtitle={t.vault.subtitle}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <Stat
            value={apy ? formatApy(apy.apy) : "·"}
            label={apy ? t.vault.rate(apy.source) : t.vault.rateOff}
            accent="oro"
          />
        </Card>
        <Card>
          <Stat
            value={position ? formatUsd(position.currentValue) : "$0.00"}
            label={
              position
                ? t.vault.inVaultShares(
                    Number(position.shares).toLocaleString(locale === "es" ? "es" : "en-US", {
                      maximumFractionDigits: 2,
                    }),
                  )
                : t.vault.inVault
            }
            accent="oro"
          />
        </Card>
        <Card>
          <Stat
            value={position?.strategy ? "Blend" : "·"}
            label={t.vault.strategy}
            accent="brote"
          />
        </Card>
      </div>

      {live && <VaultManage address={address} onDone={refreshPosition} />}

      <Card className="mt-4">
        <CardLabel>{t.vault.yourSplit}</CardLabel>
        <p className="mb-5 text-sm opacity-55">{t.vault.splitBody}</p>
        <SplitBar spendableBps={spendableBps} />
      </Card>

      <Card className="mt-4">
        <CardLabel>{t.vault.howItWorks}</CardLabel>
        <ol className="space-y-3 text-sm opacity-70">
          <li className="flex gap-3">
            <span className="text-oro">1.</span> {t.vault.step1}
          </li>
          <li className="flex gap-3">
            <span className="text-oro">2.</span> {t.vault.step2}
          </li>
          <li className="flex gap-3">
            <span className="text-oro">3.</span> {t.vault.step3}
          </li>
        </ol>
      </Card>

      {!live && (
        <div className="mt-4 rounded-md border border-dashed border-oro/25 bg-oro/5 px-5 py-4 text-sm">
          <div className="font-medium text-oro">{t.vault.previewTitle}</div>
          <p className="mt-1 opacity-60">{t.vault.previewBody}</p>
        </div>
      )}
    </div>
  );
}
