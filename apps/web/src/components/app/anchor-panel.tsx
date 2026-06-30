"use client";

import { useState } from "react";
import { Card, CardLabel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { config } from "@/lib/config";
import { useWallet } from "@/lib/wallet";

type Status = "idle" | "authenticating" | "interactive" | "polling" | "done" | "error";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Validate a SEP-10 challenge before the wallet signs it — never sign a server
 * transaction blindly. Asserts it is a real auth challenge: right network, the
 * anchor's signing key as source, sequence 0, and a `<home_domain> auth`
 * manage_data op whose source is this user. Throws if anything is off.
 */
async function assertValidChallenge(xdr: string, networkPassphrase: string, account: string) {
  if (networkPassphrase !== config.networkPassphrase) {
    throw new Error("Anchor challenge is for the wrong network.");
  }
  const info = await api.anchorInfo();
  const { TransactionBuilder } = await import("@stellar/stellar-sdk");
  const tx = TransactionBuilder.fromXDR(xdr, networkPassphrase) as {
    source: string;
    sequence: string;
    timeBounds?: unknown;
    operations: { type: string; source?: string; name?: string }[];
  };
  if (info.signingKey && tx.source !== info.signingKey) {
    throw new Error("Challenge is not from the anchor's signing key.");
  }
  if (tx.sequence !== "0") throw new Error("Challenge sequence must be 0.");
  if (!tx.timeBounds) throw new Error("Challenge has no time bounds.");
  const first = tx.operations[0];
  if (
    !first ||
    first.type !== "manageData" ||
    first.source !== account ||
    first.name !== `${info.homeDomain} auth`
  ) {
    throw new Error("Not a valid SEP-10 auth challenge.");
  }
}

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
      // SEP-10: validate the challenge, sign it, exchange for a JWT.
      const { transaction, networkPassphrase } = await api.anchorChallenge(address);
      await assertValidChallenge(transaction, networkPassphrase, address);
      const signed = await signTransaction(transaction);
      const { token } = await api.anchorToken(signed);

      // SEP-24: get the interactive URL and open the anchor's hosted form.
      setStatus("interactive");
      setMessage("Opening the anchor…");
      const { url, id } = await api.anchorInteractive(kind, token, address, asset);
      if (new URL(url).protocol !== "https:") {
        throw new Error("Anchor returned a non-https URL.");
      }
      const popup = window.open(url, "anchor", "width=480,height=720");
      if (popup) popup.opener = null; // break the opener ref (anti-tabnabbing)
      else setMessage("Allow popups to continue with the anchor.");

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
