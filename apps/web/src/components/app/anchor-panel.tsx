"use client";

import { useState } from "react";
import { ExplorerLink } from "@/components/app/explorer-link";
import { Button } from "@/components/ui/button";
import { Card, CardLabel } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { authenticate, startInteractive, waitForAnchor } from "@/lib/anchor";
import { explorerTx } from "@/lib/config";
import { useWallet } from "@/lib/wallet";

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
      setMessage("Authenticating with the anchor (SEP-10)…");
      const token = await authenticate(address, signTransaction);

      setStatus("interactive");
      setMessage("Opening the anchor…");
      const { url, id } = await startInteractive(kind, token, address, asset);
      const popup = window.open(url, "anchor", "width=480,height=720");
      if (popup) popup.opener = null; // break the opener ref (anti-tabnabbing)

      setStatus("polling");
      setMessage(popup ? "Complete the form in the anchor window…" : "Allow popups to continue with the anchor.");
      const outcome = await waitForAnchor(token, id, (s) => setMessage(`Anchor status: ${humanize(s)}`));

      if (outcome.kind === "completed") {
        setStatus("done");
        setMessage("Done. The anchor settled your transaction.");
        setSettledHash(outcome.hash);
        popup?.close();
      } else if (outcome.kind === "failed") {
        setStatus("error");
        setMessage(`Anchor returned: ${humanize(outcome.status)}`);
      } else {
        setStatus("idle");
        setMessage("Timed out waiting for the anchor. Check Activity later.");
      }
    } catch (e) {
      setStatus("error");
      const m = e instanceof Error ? e.message : String(e);
      setMessage(m.toLowerCase().includes("reject") ? "Signature rejected." : m);
    }
  }

  return (
    <Card>
      <CardLabel>Cash in / out · anchor (SEP-24)</CardLabel>
      <p className="mb-4 text-sm opacity-55">
        Fund your wallet from fiat, or cash out a remittance, through a Stellar anchor (SEP-10
        auth + SEP-24 interactive). Uses the testnet reference anchor.
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
          {busy ? "Working…" : "Deposit (cash in)"}
        </Button>
        <Button variant="ghost" onClick={() => start("withdraw")} disabled={busy}>
          Cash out
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
          <ExplorerLink href={explorerTx(settledHash)}>View settlement on StellarView</ExplorerLink>
        </p>
      )}
    </Card>
  );
}
