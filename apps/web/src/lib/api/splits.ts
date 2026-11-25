import type { AccountState, SplitterConfig } from "@raiz/shared";
import { post, request } from "./client";
import type { SplitPreview } from "./types";

/** yield_splitter contract: position, settings and transaction builders. */
export const splitsApi = {
  previewSplit: (amount: string, spendableBps?: number) =>
    post<SplitPreview>("/remittances/preview", { amount, spendableBps }),
  position: (address: string) => request<AccountState>(`/splits/${address}`),
  splitterConfig: () => request<SplitterConfig>("/splits/config"),
  ratio: (address: string) =>
    request<{ spendableBps: number; vaultBps: number }>(`/splits/${address}/ratio`),
  buildSetSplit: (user: string, spendableBps: number) =>
    post<{ xdr: string }>("/splits/ratio/build", { user, spendableBps }),
  /** Send USDC through the contract: spendable to `to`, savings held for `to`. */
  buildReceive: (from: string, to: string, amount: string) =>
    post<{ xdr: string }>("/splits/receive/build", { from, to, amount }),
  buildDepositSavings: (user: string, amount: string) =>
    post<{ xdr: string }>("/splits/deposit/build", { user, amount }),
  /** Pay `to` straight out of `user`'s savings. */
  buildPayFromSavings: (user: string, to: string, amount: string) =>
    post<{ xdr: string }>("/splits/pay/build", { user, to, amount }),
  buildWithdrawSavings: (to: string, amount: string) =>
    post<{ xdr: string }>("/splits/withdraw/build", { to, amount }),
  submitSoroban: (signedXdr: string) =>
    post<{ hash: string; status: string }>("/splits/submit", { signedXdr }),
};
