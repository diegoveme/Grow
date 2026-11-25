"use client";

import { useState } from "react";
import { isStellarAddress, isValidAmount } from "@raiz/shared";
import { ExplorerLink } from "@/components/app/explorer-link";
import { AmountInput } from "@/components/ui/amount-input";
import { Button } from "@/components/ui/button";
import { Card, CardLabel } from "@/components/ui/card";
import { Field, TextInput } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { api, type ScheduleView } from "@/lib/api";
import { config, explorerTx } from "@/lib/config";
import { formatUsd, shortAddress, timeUntil } from "@/lib/format";
import { useResource, useSchedules } from "@/lib/hooks";
import { useTx } from "@/lib/use-tx";
import { useWallet } from "@/lib/wallet";

type Every = "minute" | "week" | "month";

const INTERVALS: Record<Every, number> = { minute: 60, week: 7 * 86_400, month: 30 * 86_400 };
const LABELS: Record<Every, string> = { minute: "Every minute", week: "Every week", month: "Every month" };

const isDue = (s: ScheduleView) => new Date(s.nextAt).getTime() <= Date.now();

/**
 * Set up a remittance that repeats: one token approval, then the schedule.
 * The first payment goes out right away; later ones can be triggered by
 * anyone once due (a keeper, the recipient, or you from this list).
 */
export function RecurringSend() {
  const { address } = useWallet();
  const { data: schedules, refresh } = useSchedules(address);
  // With the keeper on, due payments go out by themselves.
  const keeperOn = useResource(() => api.health(), []).data?.keeper?.enabled === true;
  const tx = useTx();
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  // A one-minute interval exists so the flow can be tried quickly on testnet.
  const [every, setEvery] = useState<Every>("month");
  const [runs, setRuns] = useState(6);
  const [step, setStep] = useState<string | null>(null);
  const [lastHash, setLastHash] = useState<string | null>(null);

  const valid =
    isStellarAddress(to) && to !== address && isValidAmount(amount) && Number(amount) > 0;
  const options: Every[] = config.network === "PUBLIC" ? ["week", "month"] : ["minute", "week", "month"];

  async function create() {
    if (!address || !valid) return;
    const interval = INTERVALS[every];
    setLastHash(null);
    setStep("1/3 · Approve the total for these payments");
    const approved = await tx.run(
      () => api.buildScheduleAllowance(address, amount, interval, runs),
      api.submitSoroban,
    );
    if (!approved) return setStep(null);
    setStep("2/3 · Create the schedule");
    const created = await tx.run(
      () => api.buildCreateSchedule(address, to, amount, interval, runs),
      api.submitSoroban,
    );
    if (!created) return setStep(null);
    setStep("3/3 · Send the first payment");
    const latest = await api.schedules(address).catch(() => []);
    const mine = latest.find((s) => s.from === address && s.to === to && isDue(s));
    const first = mine
      ? await tx.run(() => api.buildRunSchedule(address, mine.id), api.submitSoroban)
      : null;
    setStep(null);
    setLastHash(first ?? created);
    setAmount("");
    void refresh();
  }

  async function act(kind: "run" | "cancel", id: number) {
    if (!address) return;
    const hash = await tx.run(
      () => (kind === "run" ? api.buildRunSchedule(address, id) : api.buildCancelSchedule(address, id)),
      api.submitSoroban,
    );
    if (hash) {
      setLastHash(hash);
      void refresh();
    }
  }

  return (
    <>
      <Card>
        <p className="mb-4 text-sm opacity-55">
          Send the same amount on a schedule. You approve the total once; each payment is split
          by the recipient&apos;s choice, like any Grow remittance.{" "}
          {keeperOn
            ? "The first goes now and the rest go out automatically when due."
            : "The first goes now; send the rest from the list below when they're due."}
        </p>

        <Field label="Recipient">
          <TextInput
            value={to}
            onChange={(e) => setTo(e.target.value.trim())}
            placeholder="G…"
            spellCheck={false}
            className="font-mono"
          />
        </Field>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Field label="Each payment (USDC)">
            <AmountInput value={amount} onChange={setAmount} />
          </Field>
          <Field label="How many times">
            <TextInput
              value={String(runs)}
              onChange={(e) => setRuns(Math.max(1, Math.min(120, Number(e.target.value) || 1)))}
              inputMode="numeric"
            />
          </Field>
        </div>

        <div className="mt-4">
          <Field label="Frequency">
            <Segmented
              value={every}
              onChange={setEvery}
              accent="oro"
              options={options.map((o) => ({ value: o, label: LABELS[o] }))}
            />
          </Field>
        </div>

        {valid && (
          <p className="mt-4 text-xs opacity-55">
            You approve {formatUsd(Number(amount) * runs)} in total. You can cancel anytime.
          </p>
        )}

        <Button variant="gold" onClick={create} disabled={!valid || tx.loading} className="mt-6 w-full">
          {tx.loading ? (step ?? "Signing…") : "Start recurring remittance"}
        </Button>
        {tx.error && <p className="mt-3 text-center text-xs text-oro">{tx.error}</p>}
        {lastHash && !tx.loading && (
          <p className="mt-3 text-center text-xs text-brote">
            <ExplorerLink href={explorerTx(lastHash)}>Done · view transaction</ExplorerLink>
          </p>
        )}
      </Card>

      <Card className="mt-4">
        <CardLabel>Your recurring remittances</CardLabel>
        {!schedules?.length ? (
          <p className="text-sm opacity-50">None yet.</p>
        ) : (
          <ul className="divide-y divide-luz/5">
            {schedules.map((s) => {
              const outgoing = s.from === address;
              return (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <div>
                      {formatUsd(s.amount)} {outgoing ? "to" : "from"}{" "}
                      <span className="font-mono text-xs">
                        {shortAddress(outgoing ? s.to : s.from, 4, 4)}
                      </span>
                    </div>
                    <div className="text-xs opacity-50">
                      {s.runsLeft} left · next {isDue(s) ? "due now" : timeUntil(s.nextAt)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {isDue(s) && (
                      <Button variant="ghost" onClick={() => act("run", s.id)} disabled={tx.loading}>
                        Send now
                      </Button>
                    )}
                    {outgoing && (
                      <Button variant="ghost" onClick={() => act("cancel", s.id)} disabled={tx.loading}>
                        Cancel
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
