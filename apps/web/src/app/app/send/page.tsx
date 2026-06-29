"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { SplitBar } from "@/components/app/split-bar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";
import { ExternalIcon } from "@/components/app/icons";
import { api, type AccountInfo, type SplitPreview } from "@/lib/api";
import { ASSETS, SENDABLE_ASSETS, type AssetCode } from "@/lib/assets";
import { useTx } from "@/lib/use-tx";
import { useWallet } from "@/lib/wallet";
import { useAccount } from "@/lib/hooks";
import { explorerTx } from "@/lib/config";
import { formatAmount, formatUsd } from "@/lib/format";
import { isStellarAddress } from "@raiz/shared";

export default function SendPage() {
  const { address } = useWallet();
  const { data: info, refresh } = useAccount(address);
  const tx = useTx();

  const [asset, setAsset] = useState<AssetCode>("USDC");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [preview, setPreview] = useState<SplitPreview | null>(null);
  const [recipient, setRecipient] = useState<AccountInfo | null>(null);

  const validAddress = isStellarAddress(to);
  const isGold = ASSETS[asset].accent === "oro";
  const validAmount = Number(amount) > 0;
  const isSelf = validAddress && to === address;

  const available = asset === "USDC" ? info?.usdc ?? "0" : info?.xlm ?? "0";
  const overBalance = validAmount && Number(amount) > Number(available);

  // Split preview (USDC only, that's what takes root).
  useEffect(() => {
    if (asset !== "USDC" || !validAmount) {
      setPreview(null);
      return;
    }
    let active = true;
    api
      .previewSplit(amount)
      .then((p) => active && setPreview(p))
      .catch(() => active && setPreview(null));
    return () => {
      active = false;
    };
  }, [amount, validAmount, asset]);

  // Look up the recipient so we can warn before they fail to receive.
  useEffect(() => {
    if (!validAddress) {
      setRecipient(null);
      return;
    }
    let active = true;
    api
      .account(to)
      .then((r) => active && setRecipient(r))
      .catch(() => active && setRecipient(null));
    return () => {
      active = false;
    };
  }, [to, validAddress]);

  const recipientWarning = (() => {
    if (!validAddress || !recipient) return null;
    if (asset === "USDC" && !recipient.exists)
      return "This account isn't activated yet. Send it some XLM first so it can hold USDC.";
    if (asset === "USDC" && !recipient.usdcTrustline)
      return "This recipient hasn't added USDC yet, so they can't receive it.";
    if (asset === "XLM" && !recipient.exists)
      return "New account. This payment will activate it on the network.";
    return null;
  })();

  const blocking =
    asset === "USDC" && recipient
      ? !recipient.exists || !recipient.usdcTrustline
      : false;

  async function send() {
    if (!address || !validAddress || !validAmount || isSelf || blocking) return;
    const hash = await tx.run(() => api.buildPayment({ from: address, to, asset, amount, memo }));
    if (hash) {
      if (asset === "USDC") {
        await api.createRemittance({ from: address, to, amount }).catch(() => undefined);
      }
      setAmount("");
      setMemo("");
      refresh();
    }
  }

  if (!address) return null;

  return (
    <div className="mx-auto max-w-xl animate-rise">
      <PageHeader
        eyebrow="Send"
        title="Send money"
        subtitle="Transfer XLM or USDC to any Stellar address. It settles in seconds."
      />

      <Card>
        {/* Asset toggle */}
        <Field label="Asset">
          <div className="grid grid-cols-2 gap-2">
            {SENDABLE_ASSETS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAsset(a)}
                className={`rounded-[2px] border px-4 py-2.5 text-sm font-medium transition-colors ${
                  asset === a
                    ? ASSETS[a].accent === "oro"
                      ? "border-oro bg-oro/10 text-oro"
                      : "border-agua bg-agua/10 text-agua"
                    : "border-luz/10 text-luz-tenue/60 hover:border-luz/25"
                }`}
              >
                {ASSETS[a].label}
              </button>
            ))}
          </div>
        </Field>

        <div className="mt-4">
          <Field label="Recipient" hint={isSelf ? "that's you" : undefined}>
            <TextInput
              value={to}
              onChange={(e) => setTo(e.target.value.trim())}
              placeholder="G…"
              spellCheck={false}
              className="font-mono"
            />
          </Field>
        </div>

        <div className="mt-4">
          <Field
            label={`Amount (${asset})`}
            hint={`Available: ${formatAmount(available)} ${asset}`}
          >
            <TextInput
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="0.00"
              inputMode="decimal"
            />
          </Field>
        </div>

        <div className="mt-4">
          <Field label="Memo" hint="optional">
            <TextInput
              value={memo}
              onChange={(e) => setMemo(e.target.value.slice(0, 28))}
              placeholder="e.g. For groceries"
            />
          </Field>
        </div>

        {/* Split preview */}
        {asset === "USDC" && preview && (
          <div className="mt-5 rounded-md border border-luz/5 bg-tierra/50 p-4">
            <div className="mb-3 text-xs uppercase tracking-wider opacity-50">
              How it takes root
            </div>
            <SplitBar spendableBps={preview.spendableBps} />
            <div className="mt-4 flex justify-between text-sm">
              <span className="text-agua">{formatUsd(preview.spendable)} spendable</span>
              <span className="text-oro">{formatUsd(preview.vault)} growing</span>
            </div>
          </div>
        )}

        {/* Warnings */}
        {overBalance && (
          <p className="mt-4 text-xs text-oro">
            Amount exceeds your available {asset} balance.
          </p>
        )}
        {recipientWarning && (
          <p className={`mt-3 text-xs ${blocking ? "text-oro" : "text-luz-tenue/60"}`}>
            {recipientWarning}
          </p>
        )}

        <Button
          variant={isGold ? "gold" : "primary"}
          onClick={send}
          disabled={
            !validAddress || !validAmount || isSelf || overBalance || blocking || tx.loading
          }
          className="mt-6 w-full"
        >
          {tx.loading ? "Sending…" : `Send ${asset}`}
        </Button>

        {tx.error && <p className="mt-3 text-center text-xs text-oro">{tx.error}</p>}
        {tx.hash && (
          <a
            href={explorerTx(tx.hash)}
            target="_blank"
            rel="noreferrer"
            className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-brote hover:underline"
          >
            Sent successfully · view transaction <ExternalIcon width={13} height={13} />
          </a>
        )}
      </Card>

      <p className="mt-4 text-center text-xs opacity-40">
        Don't have funds yet?{" "}
        <Link href="/app/receive" className="text-agua/70 hover:text-agua">
          Fund your wallet →
        </Link>
      </p>
    </div>
  );
}
