"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { SplitBar } from "@/components/app/split-bar";
import { Card, CardLabel, Stat } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";
import { ExternalIcon } from "@/components/app/icons";
import { useWallet } from "@/lib/wallet";
import { useApy, useRatio } from "@/lib/hooks";
import { useTx } from "@/lib/use-tx";
import { api } from "@/lib/api";
import type { VaultPosition } from "@raiz/shared";
import { explorerTx } from "@/lib/config";
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
        eyebrow="Yield"
        title="Make it grow"
        subtitle="The part of every remittance you save takes root in a DeFindex vault, which supplies into a Blend lending pool and earns USDC yield."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <Stat
            value={apy ? formatApy(apy.apy) : "·"}
            label={apy ? `APY · ${apy.source}` : "APY · not configured"}
            accent="oro"
          />
        </Card>
        <Card>
          <Stat
            value={position ? formatUsd(position.currentValue) : "$0.00"}
            label="In vault"
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
        <CardLabel>How yield works</CardLabel>
        <ol className="space-y-3 text-sm opacity-70">
          <li className="flex gap-3">
            <span className="text-oro">1.</span> You receive USDC; your chosen share is routed
            to the vault instead of sitting idle.
          </li>
          <li className="flex gap-3">
            <span className="text-oro">2.</span> The DeFindex vault supplies that USDC into a
            Blend lending pool as collateral.
          </li>
          <li className="flex gap-3">
            <span className="text-oro">3.</span> Borrowers pay interest; your balance grows in
            USDC. Withdraw any time, even cash out via a SEP-24 anchor.
          </li>
        </ol>
      </Card>

      {!live && (
        <div className="mt-4 rounded-md border border-dashed border-oro/25 bg-oro/5 px-5 py-4 text-sm">
          <div className="font-medium text-oro">Yield is in preview</div>
          <p className="mt-1 opacity-60">
            Live deposits/withdrawals go on once a DeFindex vault address + API key and a Blend
            testnet pool are configured. The split, balances, send and receive all work today.
          </p>
        </div>
      )}
    </div>
  );
}

/** Deposit into / withdraw from the DeFindex vault (which supplies into Blend). */
function VaultManage({ address, onDone }: { address: string; onDone: () => void }) {
  const tx = useTx();
  const [mode, setMode] = useState<"deposit" | "withdraw">("deposit");
  const [amount, setAmount] = useState("");
  const valid = Number(amount) > 0;

  async function run() {
    if (!valid) return;
    const hash = await tx.run(
      () =>
        mode === "deposit"
          ? api.buildVaultDeposit(address, amount)
          : api.buildVaultWithdraw(address, amount),
      api.submitSoroban,
    );
    if (hash) {
      setAmount("");
      setTimeout(onDone, 1500);
    }
  }

  return (
    <Card className="mt-4">
      <CardLabel>Manage your vault</CardLabel>

      <div className="mb-4 grid grid-cols-2 gap-2">
        {(["deposit", "withdraw"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-[2px] border px-4 py-2.5 text-sm font-medium capitalize transition-colors ${
              mode === m
                ? "border-oro bg-oro/10 text-oro"
                : "border-luz/10 text-luz-tenue/60 hover:border-luz/25"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      <Field label={`Amount to ${mode} (USDC)`}>
        <TextInput
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
          placeholder="0.00"
          inputMode="decimal"
        />
      </Field>

      <Button variant="gold" onClick={run} disabled={!valid || tx.loading} className="mt-5 w-full">
        {tx.loading
          ? "Submitting…"
          : mode === "deposit"
            ? "Deposit to vault"
            : "Withdraw from vault"}
      </Button>

      {tx.error && <p className="mt-3 text-center text-xs text-oro">{tx.error}</p>}
      {tx.hash && (
        <a
          href={explorerTx(tx.hash)}
          target="_blank"
          rel="noreferrer"
          className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-brote hover:underline"
        >
          {mode === "deposit" ? "Deposited" : "Withdrawn"} · view transaction{" "}
          <ExternalIcon width={13} height={13} />
        </a>
      )}

      <p className="mt-3 text-center text-xs opacity-40">
        Deposits supply into the Blend pool via DeFindex. You need USDC in your wallet.
      </p>
    </Card>
  );
}
