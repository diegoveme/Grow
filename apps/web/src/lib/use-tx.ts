"use client";

import { useState, useCallback } from "react";
import { useWallet } from "./wallet";
import { api } from "./api";

export interface TxState {
  loading: boolean;
  error: string | null;
  hash: string | null;
}

/**
 * Runs the standard Raíz transaction lifecycle: ask the API to build an
 * unsigned XDR, sign it with the connected wallet, then submit it back through
 * the API. Surfaces loading/error/hash for the UI.
 */
export function useTx() {
  const { signTransaction } = useWallet();
  const [state, setState] = useState<TxState>({ loading: false, error: null, hash: null });

  const run = useCallback(
    async (buildXdr: () => Promise<{ xdr: string }>) => {
      setState({ loading: true, error: null, hash: null });
      try {
        const { xdr } = await buildXdr();
        const signed = await signTransaction(xdr);
        const { hash } = await api.submit(signed);
        setState({ loading: false, error: null, hash });
        return hash;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setState({ loading: false, error: friendly(message), hash: null });
        return null;
      }
    },
    [signTransaction],
  );

  const reset = useCallback(() => setState({ loading: false, error: null, hash: null }), []);

  return { ...state, run, reset };
}

function friendly(message: string): string {
  if (message.includes("503")) {
    return "This action needs the on-chain contract configured. Deploy it and set the env vars.";
  }
  if (message.toLowerCase().includes("user") && message.toLowerCase().includes("reject")) {
    return "Signature request was rejected.";
  }
  return message.replace(/^API \d+:\s*/, "");
}
