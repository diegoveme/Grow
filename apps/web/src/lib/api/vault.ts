import type { VaultPosition } from "@raiz/shared";
import { post, request } from "./client";

/** DeFindex vault (Blend strategy): APY, position, deposit/withdraw. */
export const vaultApi = {
  vaultApy: () => request<{ apy: number; source: string }>("/vault/apy"),
  vaultPosition: (address: string) => request<VaultPosition>(`/vault/position/${address}`),
  buildVaultDeposit: (caller: string, amount: string) =>
    post<{ xdr: string }>("/vault/deposit/build", { caller, amount }),
  buildVaultWithdraw: (caller: string, amount: string) =>
    post<{ xdr: string }>("/vault/withdraw/build", { caller, amount }),
};
