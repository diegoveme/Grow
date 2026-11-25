"use client";

import { DEFAULT_SPLIT, type AccountState, type SplitterConfig } from "@raiz/shared";
import { api } from "../api";
import { useResource } from "./resource";

/** The account's savings + split in the yield_splitter contract. */
export function usePosition(address: string | null, pollMs = 15000) {
  return useResource<AccountState>(
    address ? () => api.position(address) : null,
    [address],
    pollMs,
  );
}

/** Contract settings (savings cap, paused), or null if not configured. */
export function useSplitterConfig() {
  return useResource<SplitterConfig>(() => api.splitterConfig(), []).data;
}

/** The account's spendable basis points, falling back to the default split. */
export function useRatio(address: string | null): number {
  const { data } = useResource(address ? () => api.ratio(address) : null, [address]);
  return data?.spendableBps ?? DEFAULT_SPLIT.spendableBps;
}
