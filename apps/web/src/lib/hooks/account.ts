"use client";

import { api, type AccountInfo, type PaymentRecord } from "../api";
import { useResource } from "./resource";

/** Balances, funding and trustline state of an account, polled. */
export function useAccount(address: string | null, pollMs = 12000) {
  return useResource<AccountInfo>(
    address ? () => api.account(address) : null,
    [address],
    pollMs,
  );
}

/** Activity feed of an account, polled. */
export function usePayments(address: string | null, limit = 25, pollMs = 15000) {
  return useResource<PaymentRecord[]>(
    address ? () => api.payments(address, limit) : null,
    [address, limit],
    pollMs,
  );
}
