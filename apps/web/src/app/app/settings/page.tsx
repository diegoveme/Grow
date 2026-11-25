"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { SplitBar } from "@/components/app/split-bar";
import { Card, CardLabel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConnectButton } from "@/components/connect-button";
import { ExplorerLink } from "@/components/app/explorer-link";
import { TxStatus } from "@/components/app/tx-status";
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
        eyebrow="Settings"
        title="Settings"
        subtitle="Tune how your money splits, and manage your connection."
      />

      {/* Split */}
      <Card>
        <CardLabel>Spendable vs. growing</CardLabel>
        <p className="mb-6 text-sm opacity-55">
          Choose how much of each incoming USDC remittance stays spendable, and how much takes
          root in the yield vault.
        </p>

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
          <span>{spendable}% spendable</span>
          <span>{100 - spendable}% growing</span>
        </div>

        <Button onClick={save} disabled={tx.loading} className="mt-6 w-full sm:w-auto">
          {tx.loading ? "Saving…" : "Save split on-chain"}
        </Button>
        <TxStatus error={tx.error} hash={saved ? tx.hash : null} success="Split saved on-chain ✓" />
      </Card>

      {/* Connection */}
      <Card className="mt-4">
        <CardLabel>Connection</CardLabel>
        <dl className="space-y-3 text-sm">
          <Row
            label="Wallet"
            value={shortAddress(address, 8, 8)}
            href={explorerAccount(address)}
            mono
          />
          <Row label="Network" value={config.network === "PUBLIC" ? "Mainnet" : "Stellar Testnet"} />
          <Row
            label="USDC contract"
            value={shortAddress(config.usdcContractId, 6, 6)}
            href={explorerContract(config.usdcContractId)}
            mono
          />
          {splitter && (
            <Row
              label="Grow contract"
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
