import { request } from "./client";

export interface DailyVolume {
  date: string;
  remittances: number;
  volume: string;
}

/** Public usage of the yield_splitter contract (GET /api/stats). */
export interface PublicStats {
  contractId: string;
  network: string;
  remittances: number;
  volume: string;
  paidToWallets: string;
  savedFromRemittances: string;
  setAside: string;
  withdrawn: string;
  uniqueSenders: number;
  uniqueRecipients: number;
  savingsHeld: string | null;
  firstEventAt: string | null;
  lastEventAt: string | null;
  syncedLedger: number | null;
  daily: DailyVolume[];
}

/** Indexed on-chain usage, computed by the API from contract events. */
export const statsApi = {
  stats: () => request<PublicStats>("/stats"),
};
