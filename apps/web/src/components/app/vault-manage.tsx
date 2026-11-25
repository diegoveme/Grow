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
import { useT } from "@/lib/i18n";

type Mode = "deposit" | "savings" | "withdraw";

/**
 * Deposit into / withdraw from the DeFindex vault (which supplies into Blend),
 * or move Grow savings into it: withdraw_savings, then deposit (two signatures).
 */
export function VaultManage({ address, onDone }: { address: string; onDone: () => void }) {
  const t = useT();
  const tx = useTx();
  const { data: position, refresh: refreshSavings } = usePosition(address);
  const [mode, setMode] = useState<Mode>("deposit");
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<string | null>(null);
  const savings = Number(position?.savings ?? 0);
  const positive = isValidAmount(amount) && Number(amount) > 0;
  const valid = mode === "savings" ? positive && Number(amount) <= savings : positive;

  async function run() {
    if (!valid) return;
    let hash: string | null;
    if (mode === "savings") {
      setStep(t.vault.stepOut);
      hash = await tx.run(() => api.buildWithdrawSavings(address, amount), api.submitSoroban);
      if (hash) {
        setStep(t.vault.stepIn);
        hash = await tx.run(() => api.buildVaultDeposit(address, amount), api.submitSoroban);
      }
      setStep(null);
      void refreshSavings();
    } else {
      hash = await tx.run(
        () =>
          mode === "deposit"
            ? api.buildVaultDeposit(address, amount)
            : api.buildVaultWithdraw(address, amount),
        api.submitSoroban,
      );
    }
    if (hash) {
      setAmount("");
      setTimeout(onDone, 1500);
    }
  }

  return (
    <Card className="mt-4">
      <CardLabel>{t.vault.manage}</CardLabel>

      <Segmented
        className="mb-4"
        accent="oro"
        value={mode}
        onChange={setMode}
        options={[
          { value: "deposit", label: t.vault.fromWallet },
          { value: "savings", label: t.vault.fromSavings, disabled: savings <= 0 },
          { value: "withdraw", label: t.vault.withdraw },
        ]}
      />

      <Field
        label={mode === "withdraw" ? t.vault.amountWithdraw : t.vault.amountDeposit}
        hint={mode === "savings" ? t.vault.savingsHint(formatUsd(savings)) : undefined}
      >
        <AmountInput value={amount} onChange={setAmount} />
      </Field>

      <Button variant="gold" onClick={run} disabled={!valid || tx.loading} className="mt-5 w-full">
        {tx.loading
          ? (step ?? t.vault.submitting)
          : mode === "withdraw"
            ? t.vault.withdrawBtn
            : mode === "savings"
              ? t.vault.moveSavingsBtn
              : t.vault.depositBtn}
      </Button>

      <TxStatus
        error={tx.error}
        hash={tx.hash}
        success={mode === "withdraw" ? t.vault.withdrawn : t.vault.deposited}
        center
      />

      <p className="mt-3 text-center text-xs opacity-40">
        {t.vault.footnote}
      </p>
    </Card>
  );
}
