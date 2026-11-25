"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { SplitBar } from "@/components/app/split-bar";
import { Card, CardLabel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConnectButton } from "@/components/connect-button";
import { ExplorerLink } from "@/components/app/explorer-link";
import { TxStatus } from "@/components/app/tx-status";
import { Segmented } from "@/components/ui/segmented";
import { useTheme, type ThemePreference } from "@/lib/theme";
import { useLocale, useT, type Locale } from "@/lib/i18n";
import { api } from "@/lib/api";
import { useSplitterConfig } from "@/lib/hooks";
import { useTx } from "@/lib/use-tx";
import { useWallet } from "@/lib/wallet";
import { config, explorerAccount, explorerContract } from "@/lib/config";
import { shortAddress } from "@/lib/format";
import { DEFAULT_SPLIT } from "@raiz/shared";

const DEFAULT_SPENDABLE_PCT = DEFAULT_SPLIT.spendableBps / 100;

export default function SettingsPage() {
  const { address } = useWallet();
  const t = useT();
  const tx = useTx();
  const splitter = useSplitterConfig();
  const [spendable, setSpendable] = useState(DEFAULT_SPENDABLE_PCT); // percent
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!address) return;
    api
      .ratio(address)
      .then((r) => setSpendable(Math.round(r.spendableBps / 100)))
      .catch(() => setSpendable(DEFAULT_SPENDABLE_PCT));
  }, [address]);

  async function save() {
    if (!address) return;
    setSaved(false);
    const hash = await tx.run(
      () => api.buildSetSplit(address, spendable * 100),
      api.submitSoroban,
    );
    if (hash) setSaved(true);
  }

  if (!address) return null;

  return (
    <div className="mx-auto max-w-2xl animate-rise">
      <PageHeader
        eyebrow={t.settings.eyebrow}
        title={t.settings.title}
        subtitle={t.settings.subtitle}
      />

      {/* Split */}
      <Card>
        <CardLabel>{t.settings.splitLabel}</CardLabel>
        <p className="mb-6 text-sm opacity-55">{t.settings.splitBody}</p>

        <SplitBar spendableBps={spendable * 100} className="mb-6" />

        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={spendable}
          onChange={(e) => {
            setSpendable(Number(e.target.value));
            setSaved(false);
          }}
          className="w-full accent-agua"
        />
        <div className="mt-2 flex justify-between text-xs opacity-50">
          <span>{t.settings.spendablePct(spendable)}</span>
          <span>{t.settings.savedPct(100 - spendable)}</span>
        </div>

        <Button onClick={save} disabled={tx.loading} className="mt-6 w-full sm:w-auto">
          {tx.loading ? t.settings.saving : t.settings.save}
        </Button>
        <TxStatus error={tx.error} hash={saved ? tx.hash : null} success={t.settings.saved} />
      </Card>

      <Appearance />
      <Language />

      {/* Connection */}
      <Card className="mt-4">
        <CardLabel>{t.settings.connection}</CardLabel>
        <dl className="space-y-3 text-sm">
          <Row
            label={t.settings.wallet}
            value={shortAddress(address, 8, 8)}
            href={explorerAccount(address)}
            mono
          />
          <Row
            label={t.settings.network}
            value={config.network === "PUBLIC" ? t.network.mainnet : t.network.testnet}
          />
          <Row
            label={t.settings.usdcContract}
            value={shortAddress(config.usdcContractId, 6, 6)}
            href={explorerContract(config.usdcContractId)}
            mono
          />
          {splitter && (
            <Row
              label={t.settings.growContract}
              value={shortAddress(splitter.contractId, 6, 6)}
              href={explorerContract(splitter.contractId)}
              mono
            />
          )}
        </dl>
        <div className="mt-5">
          <ConnectButton />
        </div>
      </Card>
    </div>
  );
}

/** Light paper, or a neutral dark gray-black that keeps the greens vivid. */
function Appearance() {
  const { preference, resolved, setPreference } = useTheme();
  const t = useT();
  return (
    <Card className="mt-4">
      <CardLabel>{t.settings.appearance}</CardLabel>
      <p className="mb-4 text-sm opacity-55">{t.settings.appearanceBody}</p>
      <Segmented<ThemePreference>
        value={preference}
        onChange={setPreference}
        options={[
          { value: "light", label: t.settings.themeLight },
          { value: "dark", label: t.settings.themeDark },
          { value: "system", label: t.settings.themeSystem },
        ]}
      />
      {preference === "system" && (
        <p className="mt-3 text-xs opacity-50">
          {t.settings.followingDevice(resolved === "dark")}
        </p>
      )}
    </Card>
  );
}

/** English or Spanish, remembered on this device. */
function Language() {
  const { locale, setLocale } = useLocale();
  const t = useT();
  return (
    <Card className="mt-4">
      <CardLabel>{t.settings.language}</CardLabel>
      <p className="mb-4 text-sm opacity-55">{t.settings.languageBody}</p>
      <Segmented<Locale>
        value={locale}
        onChange={setLocale}
        options={[
          { value: "es", label: "Español" },
          { value: "en", label: "English" },
        ]}
      />
    </Card>
  );
}

function Row({
  label,
  value,
  mono,
  href,
}: {
  label: string;
  value: string;
  mono?: boolean;
  /** StellarView page for this value, if it lives on-chain. */
  href?: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-luz/5 pb-3 last:border-0 last:pb-0">
      <dt className="opacity-50">{label}</dt>
      <dd className={mono ? "font-mono text-xs" : ""}>
        {href ? (
          <ExplorerLink href={href} className="text-agua">
            {value}
          </ExplorerLink>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}
