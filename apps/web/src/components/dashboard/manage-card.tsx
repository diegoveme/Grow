"use client";

import { useState } from "react";
import { Card, CardLabel } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useTx } from "@/lib/use-tx";
import { useWallet } from "@/lib/wallet";

/** Recipient-side actions: move the earmarked portion to the vault, and
 *  withdraw spendable USDC. */
export function ManageCard({ onChange }: { onChange?: () => void }) {
  const { address } = useWallet();
  const [amount, setAmount] = useState("");
  const deposit = useTx();
  const withdraw = useTx();

  async function doDeposit() {
    if (!address) return;
    const hash = await deposit.run(() => api.buildDepositVault(address));
    if (hash) onChange?.();
  }

  async function doWithdraw() {
    if (!address || !(Number(amount) > 0)) return;
    const hash = await withdraw.run(() => api.buildWithdraw(address, amount));
    if (hash) {
      setAmount("");
      onChange?.();
    }
  }

  return (
    <Card>
      <CardLabel>Manage funds</CardLabel>

      <button
        onClick={doDeposit}
        disabled={!address || deposit.loading}
        className="w-full rounded-[2px] border border-oro/40 px-4 py-2.5 text-sm uppercase tracking-wide text-oro transition-colors hover:bg-oro/10 disabled:opacity-40"
      >
        {deposit.loading ? "Depositing…" : "Move earmarked → vault"}
      </button>
      {deposit.error && <p className="mt-2 text-xs text-oro">{deposit.error}</p>}
      {deposit.hash && <p className="mt-2 text-xs text-brote">Deposited ✓</p>}

      <div className="my-5 h-px bg-luz/5" />

      <label className="mb-1 block text-xs uppercase tracking-wider opacity-50">
        Withdraw spendable (USDC)
      </label>
      <div className="flex gap-2">
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
          placeholder="50.00"
          inputMode="decimal"
          className="w-full rounded-[2px] border border-luz/10 bg-tierra px-3 py-2.5 text-sm outline-none focus:border-agua"
        />
        <button
          onClick={doWithdraw}
          disabled={!address || !(Number(amount) > 0) || withdraw.loading}
          className="shrink-0 rounded-[2px] bg-agua px-4 text-sm font-medium uppercase tracking-wide text-tierra transition-colors hover:bg-agua-palo disabled:opacity-40"
        >
          {withdraw.loading ? "…" : "Withdraw"}
        </button>
      </div>
      {withdraw.error && <p className="mt-2 text-xs text-oro">{withdraw.error}</p>}
      {withdraw.hash && <p className="mt-2 text-xs text-brote">Withdrawn ✓</p>}
    </Card>
  );
}
