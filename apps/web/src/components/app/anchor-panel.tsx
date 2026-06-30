"use client";

import { useState } from "react";
import { Card, CardLabel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useWallet } from "@/lib/wallet";

type Status = "idle" | "authenticating" | "interactive" | "polling" | "done" | "error";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * SEP-10 (auth) + SEP-24 (interactive deposit/withdraw) against the testnet
 * reference anchor: cash in to fund, or cash out a remittance to fiat. The
 * wallet signs the SEP-10 challenge; the anchor's hosted form opens in a popup
 * and we poll the transaction to completion.
 */
export function AnchorPanel() {
  const { address, signTransaction } = useWallet();
  const [asset, setAsset] = useState("USDC");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const busy = status === "authenticating" || status === "interactive" || status === "polling";

  async function start(kind: "deposit" | "withdraw") {
    if (!address) return;
    setStatus("authenticating");
    setMessage("Authenticating with the anchor (SEP-10)…");
    try {
      // SEP-10: sign the challenge with the wallet, exchange for a JWT.
      const { transaction } = await api.anchorChallenge(address);
      const signed = await signTransaction(transaction);
      const { token } = await api.anchorToken(signed);

      // SEP-24: get the interactive URL and open the anchor's hosted form.
      setStatus("interactive");
      setMessage("Opening the anchor…");
      const { url, id } = await api.anchorInteractive(kind, token, address, asset);
      const popup = window.open(url, "anchor", "width=480,height=720");
      if (!popup) {
        setMessage("Allow popups, or open the anchor here.");
      }

      // Poll until the anchor transaction settles.
      setStatus("polling");
      setMessage("Complete the form in the anchor window…");
      for (let i = 0; i < 150; i++) {
        await sleep(2500);
        try {
          const { transaction: tx } = await api.anchorTransaction(token, id);
          const st = String(tx.status ?? "");
          setMessage(`Anchor status: ${st.replace(/_/g, " ")}`);
          if (st === "completed") {
            setStatus("done");
            setMessage("Done — the anchor settled your transaction.");
            popup?.close();
            return;
          }
          if (["error", "refunded", "expired", "no_market", "too_small", "too_large"].includes(st)) {
            setStatus("error");
            setMessage(`Anchor returned: ${st.replace(/_/g, " ")}`);
            return;
          }
        } catch {
          /* keep polling */
        }
      }
      setStatus("idle");
      setMessage("Timed out waiting for the anchor. Check Activity later.");
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
        Fund your wallet from fiat, or cash out a remittance — through a Stellar anchor (SEP-10
        auth + SEP-24 interactive). Uses the testnet reference anchor.
      </p>

      <div className="mb-4 grid grid-cols-3 gap-2">
        {["USDC", "XLM", "SRT"].map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setAsset(a === "XLM" ? "native" : a)}
            className={`rounded-[2px] border px-3 py-2 text-sm font-medium transition-colors ${
              (asset === "native" ? "XLM" : asset) === a
                ? "border-agua bg-agua/10 text-agua"
                : "border-luz/10 text-luz-tenue/60 hover:border-luz/25"
            }`}
          >
            {a}
          </button>
        ))}
      </div>

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
    </Card>
  );
}
