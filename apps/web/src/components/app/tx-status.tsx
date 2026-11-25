"use client";

import { ExplorerLink } from "@/components/app/explorer-link";
import { explorerTx } from "@/lib/config";
import { useT } from "@/lib/i18n";

/**
 * Outcome of a transaction run through useTx: the error, or a success line
 * linking the transaction on StellarView.
 */
export function TxStatus({
  error,
  hash,
  success,
  center = false,
}: {
  error: string | null;
  hash: string | null;
  /** Success text shown before the link, e.g. "Sent successfully". */
  success: string;
  center?: boolean;
}) {
  const t = useT();
  const align = center ? "justify-center text-center" : "";
  return (
    <>
      {error && <p className={`mt-3 text-xs text-oro ${center ? "text-center" : ""}`}>{error}</p>}
      {hash && (
        <p className={`mt-3 flex text-xs text-brote ${align}`}>
          <ExplorerLink href={explorerTx(hash)}>{success} · {t.common.viewTransaction}</ExplorerLink>
        </p>
      )}
    </>
  );
}
