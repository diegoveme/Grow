"use client";

import { useState } from "react";
import { ExplorerLink } from "@/components/app/explorer-link";
import { Button } from "@/components/ui/button";
import { Card, CardLabel } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { authenticate, startInteractive, waitForAnchor } from "@/lib/anchor";
import { explorerTx } from "@/lib/config";
import { useWallet } from "@/lib/wallet";
import { useT } from "@/lib/i18n";

type Status = "idle" | "authenticating" | "interactive" | "polling" | "done" | "error";

/** Assets offered by the testnet reference anchor; XLM is "native" in SEP-24. */
type AnchorAsset = "USDC" | "native" | "SRT";

const humanize = (status: string) => status.replace(/_/g, " ");

/**
 * SEP-10 (auth) + SEP-24 (interactive deposit/withdraw) against the testnet
 * reference anchor: cash in to fund, or cash out a remittance to fiat. The
 * protocol steps live in lib/anchor.ts; this component only drives the UI.
 */
export function AnchorPanel() {
  const { address, signTransaction } = useWallet();
  const t = useT();
  const [asset, setAsset] = useState<AnchorAsset>("USDC");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  /** On-chain hash of the anchor's settlement, once it reports one. */
  const [settledHash, setSettledHash] = useState<string | null>(null);
  const busy = status === "authenticating" || status === "interactive" || status === "polling";

  async function start(kind: "deposit" | "withdraw") {
    if (!address) return;
    setSettledHash(null);
    try {
      setStatus("authenticating");
      setMessage(t.anchor.authenticating);
      const token = await authenticate(address, signTransaction);

      setStatus("interactive");
      setMessage(t.anchor.opening);
      const { url, id } = await startInteractive(kind, token, address, asset);
      const popup = window.open(url, "anchor", "width=480,height=720");
      if (popup) popup.opener = null; // break the opener ref (anti-tabnabbing)

      setStatus("polling");
      setMessage(popup ? t.anchor.completeForm : t.anchor.allowPopups);
      const outcome = await waitForAnchor(token, id, (s) => setMessage(t.anchor.status(humanize(s))));

      if (outcome.kind === "completed") {
        setStatus("done");
        setMessage(t.anchor.done);
        setSettledHash(outcome.hash);
        popup?.close();
      } else if (outcome.kind === "failed") {
        setStatus("error");
        setMessage(t.anchor.returned(humanize(outcome.status)));
      } else {
        setStatus("idle");
        setMessage(t.anchor.timedOut);
      }
    } catch (e) {
      setStatus("error");
      const m = e instanceof Error ? e.message : String(e);
      setMessage(m.toLowerCase().includes("reject") ? t.anchor.rejected : m);
    }
  }

  return (
    <Card>
      <CardLabel>{t.anchor.title}</CardLabel>
      <p className="mb-4 text-sm opacity-55">
        {t.anchor.body}
      </p>

      <Segmented
        className="mb-4"
        value={asset}
        onChange={setAsset}
        options={[
          { value: "USDC", label: "USDC" },
          { value: "native", label: "XLM" },
          { value: "SRT", label: "SRT" },
        ]}
      />

      <div className="grid grid-cols-2 gap-2">
        <Button variant="primary" onClick={() => start("deposit")} disabled={busy}>
          {busy ? t.anchor.working : t.anchor.deposit}
        </Button>
        <Button variant="ghost" onClick={() => start("withdraw")} disabled={busy}>
          {t.anchor.cashOut}
        </Button>
      </div>

      {message && (
        <p
          className={`mt-3 text-xs ${
            status === "error" ? "text-oro" : status === "done" ? "text-brote" : "opacity-60"
          }`}
        >
          {message}
        </p>
      )}
      {settledHash && (
        <p className="mt-2 text-xs text-brote">
          <ExplorerLink href={explorerTx(settledHash)}>{t.anchor.viewSettlement}</ExplorerLink>
        </p>
      )}
    </Card>
  );
}
