"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardLabel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CopyIcon, CheckIcon } from "@/components/app/icons";
import { api } from "@/lib/api";
import { useTx } from "@/lib/use-tx";
import { useWallet } from "@/lib/wallet";
import { useAccount, useCopy } from "@/lib/hooks";
import { config } from "@/lib/config";

export default function ReceivePage() {
  const { address } = useWallet();
  const { data: info, refresh } = useAccount(address);
  const { copied, copy } = useCopy();
  const trustTx = useTx();

  const [funding, setFunding] = useState(false);
  const [fundMsg, setFundMsg] = useState<string | null>(null);

  async function fund() {
    if (!address) return;
    setFunding(true);
    setFundMsg(null);
    try {
      const { funded } = await api.fund(address);
      setFundMsg(funded ? "Funded! 10,000 testnet XLM added." : "Already funded or unavailable.");
      setTimeout(refresh, 1500);
    } catch {
      setFundMsg("Could not reach friendbot. Try again.");
    } finally {
      setFunding(false);
    }
  }

  async function addTrustline() {
    if (!address) return;
    const hash = await trustTx.run(() => api.buildTrustline(address));
    if (hash) setTimeout(refresh, 1500);
  }

  if (!address) return null;

  const isTestnet = config.network !== "PUBLIC";

  return (
    <div className="mx-auto max-w-xl animate-rise">
      <PageHeader
        eyebrow="Receive"
        title="Receive money"
        subtitle="Share your address to get paid in XLM or USDC."
      />

      <Card className="text-center">
        <CardLabel>Your Stellar address</CardLabel>
        <div className="mx-auto mb-5 w-fit rounded-md bg-luz p-3">
          <QRCodeSVG value={address} size={168} bgColor="#F7F0E0" fgColor="#1C1A14" />
        </div>
        <div className="mx-auto mb-4 break-all rounded-[2px] border border-luz/10 bg-tierra px-4 py-3 font-mono text-xs leading-relaxed">
          {address}
        </div>
        <Button variant="ghost" onClick={() => copy(address)} className="mx-auto">
          {copied ? <CheckIcon width={15} height={15} /> : <CopyIcon width={15} height={15} />}
          {copied ? "Copied" : "Copy address"}
        </Button>
      </Card>

      {/* USDC trustline */}
      <Card className="mt-4">
        <CardLabel>USDC</CardLabel>
        {info?.usdcTrustline ? (
          <div className="flex items-center gap-2 text-sm text-brote">
            <CheckIcon width={16} height={16} />
            USDC is enabled. You can receive it.
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm opacity-55">
              To receive USDC you need a one-time trustline. This is a tiny on-chain transaction
              you sign with your wallet.
            </p>
            <Button
              variant="gold"
              onClick={addTrustline}
              disabled={trustTx.loading || !info?.funded}
              className="w-full sm:w-auto"
            >
              {trustTx.loading ? "Adding…" : "Add USDC trustline"}
            </Button>
            {!info?.funded && (
              <p className="mt-3 text-xs text-oro">Fund your account with XLM first.</p>
            )}
            {trustTx.error && <p className="mt-3 text-xs text-oro">{trustTx.error}</p>}
            {trustTx.hash && (
              <p className="mt-3 text-xs text-brote">USDC enabled ✓</p>
            )}
          </>
        )}
      </Card>

      {/* Testnet faucet */}
      {isTestnet && (
        <Card className="mt-4">
          <CardLabel>Testnet faucet</CardLabel>
          <p className="mb-4 text-sm opacity-55">
            Need funds to try Grow? Get free testnet XLM from friendbot.
          </p>
          <Button variant="ghost" onClick={fund} disabled={funding} className="w-full sm:w-auto">
            {funding ? "Funding…" : "Fund testnet XLM"}
          </Button>
          {fundMsg && <p className="mt-3 text-xs text-brote">{fundMsg}</p>}
        </Card>
      )}
    </div>
  );
}
