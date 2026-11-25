"use client";

import { useState, useCallback } from "react";
import { useWallet } from "./wallet";
import { useT } from "./i18n";
import type { Messages } from "./i18n/en";
import { api } from "./api";
import { config } from "./config";

export interface TxState {
  loading: boolean;
  error: string | null;
  hash: string | null;
}

type Submitter = (signedXdr: string) => Promise<{ hash: string; status: string }>;

/**
 * Runs the standard Grow transaction lifecycle: ask the API to build an
 * unsigned XDR, sign it with the connected wallet, then submit it. Classic
 * (XLM/USDC payments, trustlines) submit through Horizon; contract calls go
 * through the Soroban submitter. Surfaces loading/error/hash for the UI.
 */
export function useTx() {
  const { signTransaction } = useWallet();
  const t = useT();
  const [state, setState] = useState<TxState>({ loading: false, error: null, hash: null });

  const run = useCallback(
    async (
      buildXdr: () => Promise<{ xdr: string }>,
      submit: Submitter = api.submitClassic,
    ) => {
      setState({ loading: true, error: null, hash: null });
      try {
        const { xdr } = await buildXdr();
        const signed = await signTransaction(xdr);
        const { hash, status } = await submit(signed);
        if (status !== "SUCCESS") {
          // Still pending after the API's wait: don't claim success yet.
          throw new Error(t.errors.pending(status, hash));
        }
        setState({ loading: false, error: null, hash });
        return hash;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setState({ loading: false, error: friendly(message, t.errors), hash: null });
        return null;
      }
    },
    [signTransaction, t],
  );

  const reset = useCallback(() => setState({ loading: false, error: null, hash: null }), []);

  return { ...state, run, reset };
}

/** Turn wallet/network errors into a message in the app's language. */
function friendly(message: string, t: Messages["errors"]): string {
  const lower = message.toLowerCase();
  if (message.includes("503")) return t.notConfigured;
  if (lower.includes("user") && (lower.includes("reject") || lower.includes("declin"))) {
    return t.rejected;
  }
  if (lower.includes("op_no_trust") || lower.includes("no usdc trustline")) return t.noTrustline;
  if (lower.includes("op_underfunded") || lower.includes("underfunded")) return t.underfunded;
  if (lower.includes("not funded") || lower.includes("not activated")) {
    return config.network === "PUBLIC" ? t.notActivated : t.notFunded;
  }
  return message.replace(/^API \d+:\s*/, "");
}
