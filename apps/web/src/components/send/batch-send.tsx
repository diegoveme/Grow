"use client";

import { useState } from "react";
import { isStellarAddress, isValidAmount } from "@raiz/shared";
import { TxStatus } from "@/components/app/tx-status";
import { AmountInput } from "@/components/ui/amount-input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, TextInput } from "@/components/ui/field";
import { api } from "@/lib/api";
import { formatUsd } from "@/lib/format";
import { useAccount } from "@/lib/hooks";
import { useTx } from "@/lib/use-tx";
import { useWallet } from "@/lib/wallet";

const MAX_PEOPLE = 10;

interface Row {
  to: string;
  amount: string;
}

const emptyRow = (): Row => ({ to: "", amount: "" });

/**
 * Send USDC to several people with one signature (send_batch). Each person
 * gets their own split: part to their wallet, part saved for them.
 */
export function BatchSend() {
  const { address } = useWallet();
  const { data: info, refresh } = useAccount(address);
  const tx = useTx();
  const [rows, setRows] = useState<Row[]>([emptyRow(), emptyRow()]);

  const update = (i: number, patch: Partial<Row>) =>
    setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));

  const filled = rows.filter((r) => r.to || r.amount);
  const rowValid = (r: Row) =>
    isStellarAddress(r.to) && r.to !== address && isValidAmount(r.amount) && Number(r.amount) > 0;
  const allValid = filled.length > 0 && filled.every(rowValid);
  const total = filled.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const overBalance = total > Number(info?.usdc ?? 0);

  async function send() {
    if (!address || !allValid || overBalance) return;
    const payments = filled.map(({ to, amount }) => ({ to, amount }));
    const hash = await tx.run(() => api.buildSendBatch(address, payments), api.submitSoroban);
    if (hash) {
      setRows([emptyRow(), emptyRow()]);
      void refresh();
    }
  }

  return (
    <Card>
      <p className="mb-4 text-sm opacity-55">
        Pay up to {MAX_PEOPLE} people in one go. Each one receives according to their own split.
      </p>

      <div className="space-y-3">
        {rows.map((row, i) => (
          <div key={i} className="flex gap-2">
            <div className="flex-1">
              <Field label={`Person ${i + 1}`}>
                <TextInput
                  value={row.to}
                  onChange={(e) => update(i, { to: e.target.value.trim() })}
                  placeholder="G…"
                  spellCheck={false}
                  className="font-mono"
                />
              </Field>
            </div>
            <div className="w-28">
              <Field label="USDC">
                <AmountInput value={row.amount} onChange={(amount) => update(i, { amount })} />
              </Field>
            </div>
            {rows.length > 1 && (
              <button
                type="button"
                aria-label={`Remove person ${i + 1}`}
                onClick={() => setRows((r) => r.filter((_, j) => j !== i))}
                className="mt-6 px-2 text-luz-tenue/60 hover:text-oro"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      {rows.length < MAX_PEOPLE && (
        <button
          type="button"
          onClick={() => setRows((r) => [...r, emptyRow()])}
          className="mt-3 text-xs text-agua/80 hover:text-agua"
        >
          + Add another person
        </button>
      )}

      <div className="mt-5 flex justify-between text-sm">
        <span className="opacity-60">Total</span>
        <span className="font-medium">{formatUsd(total)}</span>
      </div>
      {overBalance && (
        <p className="mt-2 text-xs text-oro">The total exceeds your USDC balance.</p>
      )}
      {filled.length > 0 && !allValid && (
        <p className="mt-2 text-xs text-luz-tenue/70">
          Check each address (G…) and amount. You can&apos;t include yourself.
        </p>
      )}

      <Button
        variant="gold"
        onClick={send}
        disabled={!allValid || overBalance || tx.loading}
        className="mt-6 w-full"
      >
        {tx.loading ? "Sending…" : `Send to ${filled.length || ""} ${filled.length === 1 ? "person" : "people"}`}
      </Button>
      <TxStatus error={tx.error} hash={tx.hash} success="Sent to everyone" center />
    </Card>
  );
}
