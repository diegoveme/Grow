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
import { useTx } from "@/lib/use-tx";

type Mode = "deposit" | "withdraw";

/** Deposit into / withdraw from the DeFindex vault (which supplies into Blend). */
export function VaultManage({ address, onDone }: { address: string; onDone: () => void }) {
  const tx = useTx();
  const [mode, setMode] = useState<Mode>("deposit");
  const [amount, setAmount] = useState("");
  const valid = isValidAmount(amount) && Number(amount) > 0;

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

      <Segmented
        className="mb-4"
        accent="oro"
        value={mode}
        onChange={setMode}
        options={[
          { value: "deposit", label: "Deposit" },
          { value: "withdraw", label: "Withdraw" },
        ]}
      />

      <Field label={`Amount to ${mode} (USDC)`}>
        <AmountInput value={amount} onChange={setAmount} />
      </Field>

      <Button variant="gold" onClick={run} disabled={!valid || tx.loading} className="mt-5 w-full">
        {tx.loading ? "Submitting…" : mode === "deposit" ? "Deposit to vault" : "Withdraw from vault"}
      </Button>

      <TxStatus
        error={tx.error}
        hash={tx.hash}
        success={mode === "deposit" ? "Deposited" : "Withdrawn"}
        center
      />

      <p className="mt-3 text-center text-xs opacity-40">
        Deposits supply into the Blend pool via DeFindex. You need USDC in your wallet.
      </p>
    </Card>
  );
}
