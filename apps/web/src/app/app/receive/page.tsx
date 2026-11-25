"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { PageHeader } from "@/components/app/page-header";
import { AnchorPanel } from "@/components/app/anchor-panel";
import { Card, CardLabel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CopyIcon, CheckIcon } from "@/components/app/icons";
import { ExplorerLink } from "@/components/app/explorer-link";
import { TxStatus } from "@/components/app/tx-status";
import { api } from "@/lib/api";
import { useTx } from "@/lib/use-tx";
import { useWallet } from "@/lib/wallet";
import { useAccount, useCopy } from "@/lib/hooks";
import { config, explorerAccount } from "@/lib/config";
import { useT } from "@/lib/i18n";

export default function ReceivePage() {
  const { address } = useWallet();
  const t = useT();
  const { data: info, refresh } = useAccount(address);
  const { copied, copy } = useCopy();
  const trustTx = useTx();
  const usdcTx = useTx();

  const [funding, setFunding] = useState(false);
  const [fundMsg, setFundMsg] = useState<string | null>(null);

  async function fund() {
    if (!address) return;
    setFunding(true);
    setFundMsg(null);
    try {
      const { funded } = await api.fund(address);
      setFundMsg(funded ? t.receive.funded : t.receive.alreadyFunded);
      setTimeout(refresh, 1500);
    } catch {
      setFundMsg(t.receive.friendbotDown);
    } finally {
      setFunding(false);
    }
  }

  /** Testnet: swap 100 XLM for test USDC on the DEX, so Grow can be tried. */
  async function getTestUsdc() {
    if (!address) return;
    const hash = await usdcTx.run(() => api.buildTestUsdc(address, "100"));
    if (hash) setTimeout(refresh, 1500);
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
        eyebrow={t.receive.eyebrow}
        title={t.receive.title}
        subtitle={t.receive.subtitle}
      />

      <Card className="text-center">
        <CardLabel>{t.receive.yourAddress}</CardLabel>
        <div className="mx-auto mb-5 w-fit rounded-md bg-luz p-3">
          <QRCodeSVG value={address} size={168} bgColor="#F7F0E0" fgColor="#1C1A14" />
        </div>
        <div className="mx-auto mb-4 break-all rounded-[2px] border border-luz/10 bg-tierra px-4 py-3 font-mono text-xs leading-relaxed">
          {address}
        </div>
        <Button variant="ghost" onClick={() => copy(address)} className="mx-auto">
          {copied ? <CheckIcon width={15} height={15} /> : <CopyIcon width={15} height={15} />}
          {copied ? t.receive.copied : t.receive.copy}
        </Button>
        <div className="mt-3 text-xs text-agua/70">
          <ExplorerLink href={explorerAccount(address)}>{t.receive.viewOnExplorer}</ExplorerLink>
        </div>
      </Card>

      {/* USDC trustline */}
      <Card className="mt-4">
        <CardLabel>USDC</CardLabel>
        {info?.usdcTrustline ? (
          <div className="flex items-center gap-2 text-sm text-brote">
            <CheckIcon width={16} height={16} />
            {t.receive.usdcEnabled}
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm opacity-55">{t.receive.trustlineBody}</p>
            <Button
              variant="gold"
              onClick={addTrustline}
              disabled={trustTx.loading || !info?.funded}
              className="w-full sm:w-auto"
            >
              {trustTx.loading ? t.receive.adding : t.receive.addTrustline}
            </Button>
            {!info?.funded && (
              <p className="mt-3 text-xs text-oro">{t.receive.fundFirst}</p>
            )}
            <TxStatus error={trustTx.error} hash={trustTx.hash} success={t.receive.trustlineDone} />
          </>
        )}
      </Card>

      {/* Cash in / out via a Stellar anchor (SEP-24). Only the testnet reference
          anchor is wired today; mainnet cash-out is out of scope for the beta. */}
      <div className="mt-4">
        {isTestnet ? (
          <AnchorPanel />
        ) : (
          <Card>
            <CardLabel>{t.receive.cashInOut}</CardLabel>
            <p className="text-sm opacity-55">{t.receive.cashOutSoon}</p>
          </Card>
        )}
      </div>

      {/* Testnet faucet */}
      {isTestnet && (
        <Card className="mt-4">
          <CardLabel>{t.receive.faucet}</CardLabel>
          <p className="mb-4 text-sm opacity-55">{t.receive.faucetBody}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="ghost" onClick={fund} disabled={funding}>
              {funding ? t.receive.funding : t.receive.fundXlm}
            </Button>
            <Button
              variant="gold"
              onClick={getTestUsdc}
              disabled={usdcTx.loading || !info?.usdcTrustline}
            >
              {usdcTx.loading ? t.receive.swapping : t.receive.getUsdc}
            </Button>
          </div>
          {!info?.usdcTrustline && (
            <p className="mt-3 text-xs opacity-55">{t.receive.usdcNeedsTrustline}</p>
          )}
          {fundMsg && <p className="mt-3 text-xs text-brote">{fundMsg}</p>}
          <TxStatus error={usdcTx.error} hash={usdcTx.hash} success={t.receive.usdcDone} />
        </Card>
      )}
    </div>
  );
}
