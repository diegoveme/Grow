"use client";

import { useState } from "react";
import { isValidAmount } from "@raiz/shared";
import { TxStatus } from "@/components/app/tx-status";
import { AmountInput } from "@/components/ui/amount-input";
import { Button } from "@/components/ui/button";
import { Card, CardLabel } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { api } from "@/lib/api";
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
      void refresh();
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
          <Segmented
            className="mt-5"
            accent="oro"
            value={mode}
            onChange={(m) => {
              setMode(m);
              tx.reset();
            }}
            options={[
              { value: "add", label: "Set aside" },
              { value: "withdraw", label: "Withdraw", disabled: !hasSavings },
            ]}
          />

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Field
                label={mode === "add" ? "Move from your wallet (USDC)" : "Withdraw to your wallet (USDC)"}
              >
                <AmountInput value={amount} onChange={setAmount} />
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

      <TxStatus error={tx.error} hash={tx.hash} success={mode === "add" ? "Saved" : "Withdrawn"} />
    </Card>
  );
}
