"use client";

import { api, type AccountInfo, type SplitPreview } from "../api";
import { useLookup } from "./resource";

/** The recipient's account state, so the form can warn before a failed send. */
export function useRecipient(to: string, valid: boolean): AccountInfo | null {
  return useLookup(valid ? () => api.account(to) : null, [to, valid]);
}

/** The recipient's own spendable ratio (bps), which decides how USDC splits. */
export function useRecipientSplit(to: string, enabled: boolean): number | null {
  const ratio = useLookup(enabled ? () => api.ratio(to) : null, [to, enabled]);
  return ratio?.spendableBps ?? null;
}

/** Spendable/savings breakdown of `amount` under a ratio (default split if null). */
export function useSplitPreview(
  amount: string,
  spendableBps: number | null,
  enabled: boolean,
): SplitPreview | null {
  return useLookup(
    enabled ? () => api.previewSplit(amount, spendableBps ?? undefined) : null,
    [amount, spendableBps, enabled],
  );
}
