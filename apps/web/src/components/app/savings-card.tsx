"use client";

import { useState } from "react";
import { isValidAmount } from "@raiz/shared";
import { Card, CardLabel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";
import { ExternalIcon } from "@/components/app/icons";
import { api } from "@/lib/api";
import { explorerTx } from "@/lib/config";
import { formatUsd } from "@/lib/format";
import { usePosition } from "@/lib/hooks";
import { useTx } from "@/lib/use-tx";

type Mode = "add" | "withdraw";

/**
 * Savings the yield_splitter contract holds for the connected recipient (the
 * saved part of every USDC remittance, plus anything they set aside), with
 * forms to add USDC from the wallet or withdraw back to it.
 */
export function SavingsCard({ address }: { address: string }) {
  const { data: position, error, refresh } = usePosition(address);
  const tx = useTx();
  const [mode, setMode] = useState<Mode>("add");
  const [amount, setAmount] = useState("");

  const savings = position?.savings ?? "0";
  const hasSavings = Number(savings) > 0;
  const positive = isValidAmount(amount) && Number(amount) > 0;
  const valid = mode === "add" ? positive : positive && Number(amount) <= Number(savings);

  async function submit() {
    if (!valid) return;
    const hash = await tx.run(
      () =>
        mode === "add"
          ? api.buildDepositSavings(address, amount)
          : api.buildWithdrawSavings(address, amount),
      api.submitSoroban,
    );
    if (hash) {
      setAmount("");
      refresh();
    }
  }

  return (
    <Card>
      <CardLabel>Savings in Grow</CardLabel>
      <div className="font-display text-4xl font-bold text-oro">
        {position ? formatUsd(savings) : <span className="opacity-40">·</span>}
      </div>
      <p className="mt-1 text-xs opacity-45">
        {error && !position
          ? "The Grow contract is not reachable right now."
          : "The saved part of the remittances you receive, plus what you set aside. Only you can withdraw it."}
      </p>

      {position && (
        <>
          <div className="mt-5 grid grid-cols-2 gap-2">
            {(["add", "withdraw"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  tx.reset();
                }}
                disabled={m === "withdraw" && !hasSavings}
                className={`rounded-[2px] border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-30 ${
                  mode === m
                    ? "border-oro bg-oro/10 text-oro"
                    : "border-luz/10 text-luz-tenue/60 hover:border-luz/25"
                }`}
              >
                {m === "add" ? "Set aside" : "Withdraw"}
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Field
                label={mode === "add" ? "Move from your wallet (USDC)" : "Withdraw to your wallet (USDC)"}
              >
                <TextInput
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder="0.00"
                  inputMode="decimal"
                />
              </Field>
            </div>
            {mode === "withdraw" && (
              <Button variant="ghost" onClick={() => setAmount(savings)} disabled={tx.loading}>
                Max
              </Button>
            )}
            <Button variant="gold" onClick={submit} disabled={!valid || tx.loading}>
              {tx.loading ? "Signing…" : mode === "add" ? "Set aside" : "Withdraw"}
            </Button>
          </div>
        </>
      )}

      {tx.error && <p className="mt-3 text-xs text-oro">{tx.error}</p>}
      {tx.hash && (
        <a
          href={explorerTx(tx.hash)}
          target="_blank"
          rel="noreferrer"
          className="mt-3 flex items-center gap-1.5 text-xs text-brote hover:underline"
        >
          {mode === "add" ? "Saved" : "Withdrawn"} · view transaction{" "}
          <ExternalIcon width={13} height={13} />
        </a>
      )}
    </Card>
  );
}
