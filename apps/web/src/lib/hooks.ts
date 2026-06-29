"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_SPLIT } from "@raiz/shared";
import { api, type AccountInfo, type PaymentRecord } from "./api";

/** Generic async resource with manual + interval refresh. */
function useResource<T>(
  loader: (() => Promise<T>) | null,
  deps: unknown[],
  pollMs = 0,
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!loader) return;
    setLoading(true);
    try {
      setData(await loader());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    void refresh();
    if (!pollMs || !loader) return;
    const id = setInterval(() => void refresh(), pollMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh, pollMs]);

  return { data, loading, error, refresh };
}

export function useAccount(address: string | null, pollMs = 12000) {
  return useResource<AccountInfo>(
    address ? () => api.account(address) : null,
    [address],
    pollMs,
  );
}

export function usePayments(address: string | null, limit = 25, pollMs = 15000) {
  return useResource<PaymentRecord[]>(
    address ? () => api.payments(address, limit) : null,
    [address, limit],
    pollMs,
  );
}

/** The account's spendable basis points, falling back to the default split. */
export function useRatio(address: string | null): number {
  const { data } = useResource(address ? () => api.ratio(address) : null, [address]);
  return data?.spendableBps ?? DEFAULT_SPLIT.spendableBps;
}

/** Live vault APY ({ apy, source }) or null when no pool/vault is configured. */
export function useApy() {
  return useResource(() => api.vaultApy(), []).data;
}

/** Clipboard copy with a transient "copied" flag. */
export function useCopy(timeout = 1400) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), timeout);
      } catch {
        /* clipboard unavailable */
      }
    },
    [timeout],
  );
  return { copied, copy };
}
