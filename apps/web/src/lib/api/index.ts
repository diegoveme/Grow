import { accountsApi } from "./accounts";
import { anchorApi } from "./anchor";
import { remittancesApi } from "./remittances";
import { splitsApi } from "./splits";
import { statsApi } from "./stats";
import { vaultApi } from "./vault";

export * from "./types";
export type { DailyVolume, PublicStats } from "./stats";
export { accountsApi, anchorApi, remittancesApi, splitsApi, statsApi, vaultApi };

/** Every Grow API call, grouped by domain in ./accounts, ./splits, etc. */
export const api = {
  ...accountsApi,
  ...splitsApi,
  ...vaultApi,
  ...remittancesApi,
  ...anchorApi,
  ...statsApi,
};
