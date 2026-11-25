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

/**
 * Savings the yield_splitter contract holds for the connected recipient (the
 * saved part of every USDC remittance), with a withdraw-to-wallet form.
 */
export function SavingsCard({ address }: { address: string }) {
  const { data: position, error, refresh } = usePosition(address);
  const tx = useTx();
  const [amount, setAmount] = useState("");

  const savings = position?.savings ?? "0";
  const hasSavings = Number(savings) > 0;
  const valid = isValidAmount(amount) && Number(amount) > 0 && Number(amount) <= Number(savings);

  async function withdraw() {
    if (!valid) return;
    const hash = await tx.run(
      () => api.buildWithdrawSavings(address, amount),
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
          : "The saved part of the remittances you receive. Only you can withdraw it."}
      </p>

      {hasSavings && (
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Field label="Withdraw to your wallet (USDC)">
              <TextInput
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="0.00"
                inputMode="decimal"
              />
            </Field>
          </div>
          <Button variant="ghost" onClick={() => setAmount(savings)} disabled={tx.loading}>
            Max
          </Button>
          <Button variant="gold" onClick={withdraw} disabled={!valid || tx.loading}>
            {tx.loading ? "Withdrawing…" : "Withdraw"}
          </Button>
        </div>
      )}

      {tx.error && <p className="mt-3 text-xs text-oro">{tx.error}</p>}
      {tx.hash && (
        <a
          href={explorerTx(tx.hash)}
          target="_blank"
          rel="noreferrer"
          className="mt-3 flex items-center gap-1.5 text-xs text-brote hover:underline"
        >
          Withdrawn · view transaction <ExternalIcon width={13} height={13} />
        </a>
      )}
    </Card>
  );
}
