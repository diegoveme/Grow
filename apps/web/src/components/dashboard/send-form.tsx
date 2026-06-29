"use client";

import { useEffect, useState } from "react";
import { Card, CardLabel } from "@/components/ui/card";
import { api, type SplitPreview } from "@/lib/api";
import { useTx } from "@/lib/use-tx";
import { useWallet } from "@/lib/wallet";
import { formatUsd } from "@/lib/format";

const G_ADDRESS = /^G[A-Z2-7]{55}$/;

/** Send a remittance from the connected wallet to a recipient. */
export function SendForm({ onSent }: { onSent?: () => void }) {
  const { address } = useWallet();
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [preview, setPreview] = useState<SplitPreview | null>(null);
  const tx = useTx();

  const validAddress = G_ADDRESS.test(to);
  const validAmount = Number(amount) > 0;

  useEffect(() => {
    if (!validAmount) {
      setPreview(null);
      return;
    }
    let active = true;
    api
      .previewSplit(amount)
      .then((p) => active && setPreview(p))
      .catch(() => active && setPreview(null));
    return () => {
      active = false;
    };
  }, [amount, validAmount]);

  async function send() {
    if (!address || !validAddress || !validAmount) return;
    const hash = await tx.run(() => api.buildReceive(address, to, amount));
    if (hash) {
      await api.createRemittance({ from: address, to, amount }).catch(() => undefined);
      setTo("");
      setAmount("");
      onSent?.();
    }
  }

  return (
    <Card>
      <CardLabel>Send a remittance</CardLabel>

      <label className="mb-1 block text-xs uppercase tracking-wider opacity-50">Recipient</label>
      <input
        value={to}
        onChange={(e) => setTo(e.target.value.trim())}
        placeholder="G…"
        spellCheck={false}
        className="mb-4 w-full rounded-[2px] border border-luz/10 bg-tierra px-3 py-2.5 font-mono text-sm outline-none focus:border-agua"
      />

      <label className="mb-1 block text-xs uppercase tracking-wider opacity-50">
        Amount (USDC)
      </label>
      <input
        value={amount}
        onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
        placeholder="200.00"
        inputMode="decimal"
        className="w-full rounded-[2px] border border-luz/10 bg-tierra px-3 py-2.5 text-sm outline-none focus:border-agua"
      />

      {preview && (
        <div className="mt-4 flex items-center justify-between rounded-[2px] bg-tierra/60 px-3 py-2.5 text-sm">
          <span className="text-agua">{formatUsd(preview.spendable)} spendable</span>
          <span className="opacity-30">+</span>
          <span className="text-oro">{formatUsd(preview.vault)} to vault</span>
        </div>
      )}

      <button
        onClick={send}
        disabled={!address || !validAddress || !validAmount || tx.loading}
        className="mt-5 w-full rounded-[2px] bg-agua px-4 py-2.5 text-sm font-medium uppercase tracking-wide text-tierra transition-colors hover:bg-agua-palo disabled:opacity-40"
      >
        {tx.loading ? "Sending…" : "Send & split"}
      </button>
      {tx.error && <p className="mt-3 text-xs text-oro">{tx.error}</p>}
      {tx.hash && (
        <p className="mt-3 text-xs text-brote">Sent · tx {tx.hash.slice(0, 8)}…</p>
      )}
    </Card>
  );
}
