import type { Remittance } from "@raiz/shared";
import { post, request } from "./client";

/** Remittance timeline, recorded by tx hash and verified on-chain by the API. */
export const remittancesApi = {
  remittances: (address: string) =>
    request<Remittance[]>(`/remittances?address=${encodeURIComponent(address)}`),
  /** Record a remittance; the API verifies the receive() tx on-chain first. */
  recordRemittance: (txHash: string) =>
    post<Remittance>("/remittances", { txHash }),
};
