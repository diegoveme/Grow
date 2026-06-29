"use client";

import { useState, useCallback } from "react";
import { useWallet } from "./wallet";
import { api } from "./api";

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
        const { hash } = await submit(signed);
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
  const lower = message.toLowerCase();
  if (message.includes("503")) {
    return "This action needs an on-chain contract/vault configured first.";
  }
  if (lower.includes("user") && (lower.includes("reject") || lower.includes("declin"))) {
    return "Signature request was rejected.";
  }
  if (lower.includes("op_no_trust") || lower.includes("no usdc trustline")) {
    return "The recipient hasn't added USDC yet, so they can't receive it.";
  }
  if (lower.includes("op_underfunded") || lower.includes("underfunded")) {
    return "Not enough balance for this payment (remember XLM keeps a small reserve).";
  }
  if (lower.includes("not funded")) {
    return "Your account isn't funded yet. Use “Fund testnet XLM” first.";
  }
  return message.replace(/^API \d+:\s*/, "");
}
