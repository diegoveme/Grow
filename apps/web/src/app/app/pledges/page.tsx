"use client";

import { useState } from "react";
import { isStellarAddress, isValidAmount } from "@raiz/shared";
import { ExplorerLink } from "@/components/app/explorer-link";
import { PageHeader } from "@/components/app/page-header";
import { AmountInput } from "@/components/ui/amount-input";
import { Button } from "@/components/ui/button";
import { Card, CardLabel } from "@/components/ui/card";
import { Field, TextInput } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { api, type PledgeView } from "@/lib/api";
import { explorerTx } from "@/lib/config";
import { formatUsd, shortAddress, timeUntil } from "@/lib/format";
import { usePledges, useSplitterConfig } from "@/lib/hooks";
import { useTx } from "@/lib/use-tx";
import { useWallet } from "@/lib/wallet";

type Window = "1h" | "7d" | "30d" | "90d";
const WINDOWS: Record<Window, number> = { "1h": 3_600, "7d": 7 * 86_400, "30d": 30 * 86_400, "90d": 90 * 86_400 };
const WINDOW_LABELS: Record<Window, string> = { "1h": "1 hour", "7d": "7 days", "30d": "30 days", "90d": "90 days" };

const expired = (p: PledgeView) => new Date(p.expiresAt).getTime() < Date.now();

/**
 * Conditional remittances: money a sender earmarks for a specific payee
 * (school fees, a clinic, rent). The family releases it straight to the
 * payee; if it isn't used before the deadline, the sender takes it back.
 */
export default function PledgesPage() {
  const { address } = useWallet();
  const { data: pledges, refresh } = usePledges(address);
  const splitter = useSplitterConfig();
  const tx = useTx();
  const [beneficiary, setBeneficiary] = useState("");
  const [payee, setPayee] = useState("");
  const [amount, setAmount] = useState("");
  const [window, setWindow] = useState<Window>("30d");
  const [lastHash, setLastHash] = useState<string | null>(null);

  const valid =
    isStellarAddress(beneficiary) &&
    isStellarAddress(payee) &&
    isValidAmount(amount) &&
    Number(amount) > 0;

  async function create() {
    if (!address || !valid) return;
    const expiresAt = new Date(Date.now() + WINDOWS[window] * 1000).toISOString();
    const hash = await tx.run(
      () => api.buildCreatePledge(address, beneficiary, payee, amount, expiresAt),
      api.submitSoroban,
    );
    if (hash) {
      setLastHash(hash);
      setAmount("");
      void refresh();
    }
  }

  async function settle(kind: "release" | "refund", id: number) {
    if (!address) return;
    const hash = await tx.run(
      () => (kind === "release" ? api.buildReleasePledge(address, id) : api.buildRefundPledge(address, id)),
      api.submitSoroban,
    );
    if (hash) {
      setLastHash(hash);
      void refresh();
    }
  }

  if (!address) return null;

  const toRelease = (pledges ?? []).filter((p) => p.beneficiary === address);
  const sent = (pledges ?? []).filter((p) => p.from === address);

  return (
    <div className="mx-auto max-w-2xl animate-rise">
      <PageHeader
        eyebrow="Earmarked"
        title="Pay it where it's needed"
        subtitle="Set money aside for a specific purpose, like school fees or a clinic. Your family pays it straight to them; if it isn't used in time, it comes back to you."
      />

      <Card>
        <CardLabel>Earmark a payment</CardLabel>
        <div className="space-y-4">
          <Field label="Who decides when to pay (your family)">
            <TextInput
              value={beneficiary}
              onChange={(e) => setBeneficiary(e.target.value.trim())}
              placeholder="G…"
              spellCheck={false}
              className="font-mono"
            />
          </Field>
          <Field label="Who gets paid (school, clinic, landlord…)">
            <TextInput
              value={payee}
              onChange={(e) => setPayee(e.target.value.trim())}
              placeholder="G…"
              spellCheck={false}
              className="font-mono"
            />
          </Field>
          <Field
            label="Amount (USDC)"
            hint={splitter ? `beta limit ${formatUsd(splitter.userCap)}` : undefined}
          >
            <AmountInput value={amount} onChange={setAmount} />
          </Field>
          <Field label="Can be paid within">
            <Segmented
              value={window}
              onChange={setWindow}
              accent="oro"
              options={(Object.keys(WINDOWS) as Window[]).map((w) => ({ value: w, label: WINDOW_LABELS[w] }))}
            />
          </Field>
        </div>
        <Button variant="gold" onClick={create} disabled={!valid || tx.loading} className="mt-6 w-full">
          {tx.loading ? "Signing…" : "Earmark it"}
        </Button>
        {tx.error && <p className="mt-3 text-center text-xs text-oro">{tx.error}</p>}
        {lastHash && !tx.loading && (
          <p className="mt-3 text-center text-xs text-brote">
            <ExplorerLink href={explorerTx(lastHash)}>Done · view transaction</ExplorerLink>
          </p>
        )}
      </Card>

      <Card className="mt-4">
        <CardLabel>Waiting for you to pay</CardLabel>
        <PledgeList
          items={toRelease}
          empty="Nobody has earmarked a payment for you."
          action={(p) =>
            expired(p) ? (
              <span className="text-xs opacity-50">expired</span>
            ) : (
              <Button variant="gold" onClick={() => settle("release", p.id)} disabled={tx.loading}>
                Pay {shortAddress(p.payee, 4, 4)}
              </Button>
            )
          }
        />
      </Card>

      <Card className="mt-4">
        <CardLabel>You earmarked</CardLabel>
        <PledgeList
          items={sent}
          empty="You haven't earmarked any payment."
          action={(p) =>
            expired(p) ? (
              <Button variant="ghost" onClick={() => settle("refund", p.id)} disabled={tx.loading}>
                Take it back
              </Button>
            ) : (
              <span className="text-xs opacity-50">waiting</span>
            )
          }
        />
      </Card>
    </div>
  );
}

function PledgeList({
  items,
  empty,
  action,
}: {
  items: PledgeView[];
  empty: string;
  action: (p: PledgeView) => React.ReactNode;
}) {
  if (!items.length) return <p className="text-sm opacity-50">{empty}</p>;
  return (
    <ul className="divide-y divide-luz/5">
      {items.map((p) => (
        <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
          <div>
            <div>
              {formatUsd(p.amount)} for{" "}
              <span className="font-mono text-xs">{shortAddress(p.payee, 4, 4)}</span>
            </div>
            <div className="text-xs opacity-50">
              {expired(p) ? "expired" : `pay ${timeUntil(p.expiresAt)}`} · from{" "}
              <span className="font-mono">{shortAddress(p.from, 4, 4)}</span>
            </div>
          </div>
          {action(p)}
        </li>
      ))}
    </ul>
  );
}
