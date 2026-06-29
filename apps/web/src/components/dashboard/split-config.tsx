"use client";

import { useEffect, useState } from "react";
import { Card, CardLabel } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useTx } from "@/lib/use-tx";
import { useWallet } from "@/lib/wallet";

/** Lets the recipient pick how much of each remittance stays spendable. */
export function SplitConfig({ onSaved }: { onSaved?: () => void }) {
  const { address } = useWallet();
  const [spendablePct, setSpendablePct] = useState(70);
  const [savedPct, setSavedPct] = useState<number | null>(null);
  const tx = useTx();

  useEffect(() => {
    if (!address) return;
    api
      .ratio(address)
      .then((r) => {
        setSpendablePct(Math.round(r.spendableBps / 100));
        setSavedPct(Math.round(r.spendableBps / 100));
      })
      .catch(() => setSavedPct(null));
  }, [address]);

  const dirty = savedPct === null || spendablePct !== savedPct;
  const vaultPct = 100 - spendablePct;

  async function save() {
    if (!address) return;
    const hash = await tx.run(() => api.buildSetSplit(address, spendablePct * 100));
    if (hash) {
      setSavedPct(spendablePct);
      onSaved?.();
    }
  }

  return (
    <Card>
      <CardLabel>Your split</CardLabel>
      <p className="mb-5 text-sm opacity-60">
        How much of every remittance stays spendable versus grows in the vault.
      </p>

      <div className="mb-2 flex h-3 gap-0.5 overflow-hidden rounded-[1px]">
        <div className="bg-agua transition-all" style={{ flex: spendablePct }} />
        <div className="bg-oro transition-all" style={{ flex: vaultPct }} />
      </div>
      <div className="mb-5 flex justify-between text-sm">
        <span className="text-agua">{spendablePct}% spendable</span>
        <span className="text-oro">{vaultPct}% vault</span>
      </div>

      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={spendablePct}
        onChange={(e) => setSpendablePct(Number(e.target.value))}
        className="w-full accent-agua"
        aria-label="Spendable percentage"
      />

      <button
        onClick={save}
        disabled={!dirty || tx.loading || !address}
        className="mt-5 w-full rounded-[2px] bg-agua px-4 py-2.5 text-sm font-medium uppercase tracking-wide text-tierra transition-colors hover:bg-agua-palo disabled:opacity-40"
      >
        {tx.loading ? "Saving on-chain…" : dirty ? "Save ratio" : "Saved"}
      </button>
      {tx.error && <p className="mt-3 text-xs text-oro">{tx.error}</p>}
      {tx.hash && <p className="mt-3 text-xs text-brote">Saved · tx {tx.hash.slice(0, 8)}…</p>}
    </Card>
  );
}
