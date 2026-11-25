"use client";

import { api } from "../api";
import { useResource } from "./resource";

/** Live vault APY ({ apy, source }) or null when no pool/vault is configured. */
export function useApy() {
  return useResource(() => api.vaultApy(), []).data;
}
