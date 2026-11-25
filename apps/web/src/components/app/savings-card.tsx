"use client";

import { useState } from "react";
import { isStellarAddress, isValidAmount } from "@raiz/shared";
import { TxStatus } from "@/components/app/tx-status";
import { AmountInput } from "@/components/ui/amount-input";
import { Button } from "@/components/ui/button";
import { Card, CardLabel } from "@/components/ui/card";
import { Field, TextInput } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { api } from "@/lib/api";
import { formatUsd } from "@/lib/format";
import { usePosition } from "@/lib/hooks";
import { useTx } from "@/lib/use-tx";

type Mode = "add" | "withdraw" | "pay";

/**
 * Savings the yield_splitter contract holds for the connected recipient (the
 * saved part of every USDC remittance, plus anything they set aside), with
 * forms to add USDC from the wallet, withdraw back to it, or pay someone
 * (a school, a clinic) straight out of savings.
 */
export function SavingsCard({ address }: { address: string }) {
  const { data: position, error, refresh } = usePosition(address);
  const tx = useTx();
  const [mode, setMode] = useState<Mode>("add");
  const [amount, setAmount] = useState("");
  const [payee, setPayee] = useState("");

  const savings = position?.savings ?? "0";
  const hasSavings = Number(savings) > 0;
  const positive = isValidAmount(amount) && Number(amount) > 0;
  const withinSavings = positive && Number(amount) <= Number(savings);
  const validPayee = isStellarAddress(payee) && payee !== address;
  const valid =
    mode === "add" ? positive : mode === "withdraw" ? withinSavings : withinSavings && validPayee;

  async function submit() {
    if (!valid) return;
    const hash = await tx.run(
      () =>
        mode === "add"
          ? api.buildDepositSavings(address, amount)
          : mode === "withdraw"
            ? api.buildWithdrawSavings(address, amount)
            : api.buildPayFromSavings(address, payee, amount),
      api.submitSoroban,
    );
    if (hash) {
      setAmount("");
      setPayee("");
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
              { value: "pay", label: "Pay", disabled: !hasSavings },
            ]}
          />

          {mode === "pay" && (
            <div className="mt-4">
              <Field label="Pay to (school, clinic, landlord…)" hint={payee && !validPayee ? "check the address" : undefined}>
                <TextInput
                  value={payee}
                  onChange={(e) => setPayee(e.target.value.trim())}
                  placeholder="G…"
                  spellCheck={false}
                  className="font-mono"
                />
              </Field>
            </div>
          )}

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Field
                label={
                  mode === "add"
                    ? "Move from your wallet (USDC)"
                    : mode === "withdraw"
                      ? "Withdraw to your wallet (USDC)"
                      : "Amount from savings (USDC)"
                }
              >
                <AmountInput value={amount} onChange={setAmount} />
              </Field>
            </div>
            {mode !== "add" && (
              <Button variant="ghost" onClick={() => setAmount(savings)} disabled={tx.loading}>
                Max
              </Button>
            )}
            <Button variant="gold" onClick={submit} disabled={!valid || tx.loading}>
              {tx.loading ? "Signing…" : mode === "add" ? "Set aside" : mode === "withdraw" ? "Withdraw" : "Pay"}
            </Button>
          </div>
        </>
      )}

      <TxStatus
        error={tx.error}
        hash={tx.hash}
        success={mode === "add" ? "Saved" : mode === "withdraw" ? "Withdrawn" : "Paid"}
      />
    </Card>
  );
}
