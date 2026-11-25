"use client";

import { useState } from "react";
import Link from "next/link";
import { isStellarAddress, isValidAmount } from "@raiz/shared";
import { PageHeader } from "@/components/app/page-header";
import { SplitBar } from "@/components/app/split-bar";
import { TxStatus } from "@/components/app/tx-status";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AmountInput } from "@/components/ui/amount-input";
import { Field, TextInput } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { api, type AccountInfo } from "@/lib/api";
import { ASSETS, SENDABLE_ASSETS, type AssetCode } from "@/lib/assets";
import { formatAmount, formatUsd } from "@/lib/format";
import {
  useAccount,
  useRecipient,
  useRecipientSplit,
  useSplitPreview,
  useSplitterConfig,
} from "@/lib/hooks";
import { useTx } from "@/lib/use-tx";
import { useWallet } from "@/lib/wallet";

/** Why the recipient can't get this asset yet, or a heads-up; null if fine. */
function recipientNotice(asset: AssetCode, recipient: AccountInfo | null): string | null {
  if (!recipient) return null;
  if (asset === "USDC" && !recipient.exists)
    return "This account isn't activated yet. Send it some XLM first so it can hold USDC.";
  if (asset === "USDC" && !recipient.usdcTrustline)
    return "This recipient hasn't added USDC yet, so they can't receive it.";
  if (asset === "XLM" && !recipient.exists)
    return "New account. This payment will activate it on the network.";
  return null;
}

export default function SendPage() {
  const { address } = useWallet();
  const { data: info, refresh } = useAccount(address);
  const splitter = useSplitterConfig();
  const tx = useTx();

  const [asset, setAsset] = useState<AssetCode>("USDC");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");

  const isUsdc = asset === "USDC";
  const validAddress = isStellarAddress(to);
  const validAmount = isValidAmount(amount) && Number(amount) > 0;
  const isSelf = validAddress && to === address;

  // The recipient's own split decides how a USDC remittance takes root.
  const recipient = useRecipient(to, validAddress);
  const recipientBps = useRecipientSplit(to, isUsdc && validAddress);
  const preview = useSplitPreview(amount, recipientBps, isUsdc && validAmount);

  const available = isUsdc ? (info?.usdc ?? "0") : (info?.xlm ?? "0");
  const overBalance = validAmount && Number(amount) > Number(available);
  const notice = validAddress ? recipientNotice(asset, recipient) : null;
  const paused = isUsdc && splitter?.paused === true;
  const blocking =
    paused || (isUsdc && recipient ? !recipient.exists || !recipient.usdcTrustline : false);

  async function send() {
    if (!address || !validAddress || !validAmount || isSelf || blocking) return;
    const hash = isUsdc
      ? await tx.run(() => api.buildReceive(address, to, amount), api.submitSoroban)
      : await tx.run(() => api.buildPayment({ from: address, to, asset, amount, memo }));
    if (!hash) return;
    if (isUsdc) await api.recordRemittance(hash).catch(() => undefined);
    setAmount("");
    setMemo("");
    void refresh();
  }

  if (!address) return null;

  return (
    <div className="mx-auto max-w-xl animate-rise">
      <PageHeader
        eyebrow="Send"
        title="Send money"
        subtitle="USDC goes through Grow and is split by the recipient's choice. XLM is sent directly. Both settle in seconds."
      />

      <Card>
        <Field label="Asset">
          <Segmented
            value={asset}
            onChange={setAsset}
            options={SENDABLE_ASSETS.map((a) => ({
              value: a,
              label: ASSETS[a].label,
              accent: ASSETS[a].accent,
            }))}
          />
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
          <Field label={`Amount (${asset})`} hint={`Available: ${formatAmount(available)} ${asset}`}>
            <AmountInput value={amount} onChange={setAmount} />
          </Field>
        </div>

        {/* Memos only travel with direct (classic) payments. */}
        {!isUsdc && (
          <div className="mt-4">
            <Field label="Memo" hint="optional">
              <TextInput
                value={memo}
                onChange={(e) => setMemo(e.target.value.slice(0, 28))}
                placeholder="e.g. For groceries"
              />
            </Field>
          </div>
        )}

        {isUsdc && preview && (
          <div className="mt-5 rounded-md border border-luz/5 bg-tierra/50 p-4">
            <div className="mb-3 text-xs uppercase tracking-wider opacity-50">
              How it takes root
            </div>
            <SplitBar spendableBps={preview.spendableBps} />
            <div className="mt-4 flex justify-between text-sm">
              <span className="text-agua">{formatUsd(preview.spendable)} to their wallet</span>
              <span className="text-oro">{formatUsd(preview.vault)} saved for them</span>
            </div>
            {splitter && (
              <p className="mt-3 text-xs opacity-45">
                Beta limit: Grow holds up to {formatUsd(splitter.userCap)} of savings per
                recipient.
              </p>
            )}
          </div>
        )}

        {overBalance && (
          <p className="mt-4 text-xs text-oro">Amount exceeds your available {asset} balance.</p>
        )}
        {paused && (
          <p className="mt-3 text-xs text-oro">
            USDC remittances are paused for maintenance. Please try again later.
          </p>
        )}
        {notice && (
          <p className={`mt-3 text-xs ${blocking ? "text-oro" : "text-luz-tenue/60"}`}>{notice}</p>
        )}

        <Button
          variant={ASSETS[asset].accent === "oro" ? "gold" : "primary"}
          onClick={send}
          disabled={!validAddress || !validAmount || isSelf || overBalance || blocking || tx.loading}
          className="mt-6 w-full"
        >
          {tx.loading ? "Sending…" : `Send ${asset}`}
        </Button>

        <TxStatus error={tx.error} hash={tx.hash} success="Sent successfully" center />
      </Card>

      <p className="mt-4 text-center text-xs opacity-40">
        Don&apos;t have funds yet?{" "}
        <Link href="/app/receive" className="text-agua/70 hover:text-agua">
          Fund your wallet →
        </Link>
      </p>
    </div>
  );
}
