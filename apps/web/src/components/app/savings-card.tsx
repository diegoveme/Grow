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
import { useT } from "@/lib/i18n";

type Mode = "add" | "withdraw" | "pay";

/**
 * Savings the yield_splitter contract holds for the connected recipient (the
 * saved part of every USDC remittance, plus anything they set aside), with
 * forms to add USDC from the wallet, withdraw back to it, or pay someone
 * (a school, a clinic) straight out of savings.
 */
export function SavingsCard({ address }: { address: string }) {
  const t = useT();
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
      <CardLabel>{t.savings.label}</CardLabel>
      <div className="font-display text-4xl font-bold text-oro">
        {position ? formatUsd(savings) : <span className="opacity-40">·</span>}
      </div>
      <p className="mt-1 text-xs opacity-45">
        {error && !position
          ? t.savings.unreachable
          : t.savings.body}
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
              { value: "add", label: t.savings.setAside },
              { value: "withdraw", label: t.savings.withdraw, disabled: !hasSavings },
              { value: "pay", label: t.savings.pay, disabled: !hasSavings },
            ]}
          />

          {mode === "pay" && (
            <div className="mt-4">
              <Field label={t.savings.payTo} hint={payee && !validPayee ? t.common.checkAddress : undefined}>
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
                    ? t.savings.fromWallet
                    : mode === "withdraw"
                      ? t.savings.toWallet
                      : t.savings.fromSavings
                }
              >
                <AmountInput value={amount} onChange={setAmount} />
              </Field>
            </div>
            {mode !== "add" && (
              <Button variant="ghost" onClick={() => setAmount(savings)} disabled={tx.loading}>
                {t.common.max}
              </Button>
            )}
            <Button variant="gold" onClick={submit} disabled={!valid || tx.loading}>
              {tx.loading
                ? t.common.signing
                : mode === "add"
                  ? t.savings.setAside
                  : mode === "withdraw"
                    ? t.savings.withdraw
                    : t.savings.pay}
            </Button>
          </div>
        </>
      )}

      <TxStatus
        error={tx.error}
        hash={tx.hash}
        success={
          mode === "add"
            ? t.savings.savedDone
            : mode === "withdraw"
              ? t.savings.withdrawnDone
              : t.savings.paidDone
        }
      />
    </Card>
  );
}
