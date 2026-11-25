import type { AccountState, SplitterConfig } from "@raiz/shared";
import { post, request } from "./client";
import type { PledgeView, ScheduleView, SplitPreview } from "./types";

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
  /** One signature, several recipients; each split by their own ratio. */
  buildSendBatch: (from: string, payments: { to: string; amount: string }[]) =>
    post<{ xdr: string }>("/splits/batch/build", { from, payments }),

  // Recurring remittances
  buildScheduleAllowance: (from: string, amount: string, intervalSecs: number, runs: number) =>
    post<{ xdr: string }>("/splits/schedules/approve/build", { from, amount, intervalSecs, runs }),
  buildCreateSchedule: (
    from: string,
    to: string,
    amount: string,
    intervalSecs: number,
    runs: number,
  ) => post<{ xdr: string }>("/splits/schedules/build", { from, to, amount, intervalSecs, runs }),
  buildRunSchedule: (caller: string, id: number) =>
    post<{ xdr: string }>(`/splits/schedules/${id}/run/build`, { caller }),
  buildCancelSchedule: (caller: string, id: number) =>
    post<{ xdr: string }>(`/splits/schedules/${id}/cancel/build`, { caller }),
  schedules: (address: string) =>
    request<ScheduleView[]>(`/splits/schedules?address=${encodeURIComponent(address)}`),

  // Conditional remittances (pledges)
  buildCreatePledge: (
    from: string,
    beneficiary: string,
    payee: string,
    amount: string,
    expiresAt: string,
  ) =>
    post<{ xdr: string }>("/splits/pledges/build", { from, beneficiary, payee, amount, expiresAt }),
  buildReleasePledge: (caller: string, id: number) =>
    post<{ xdr: string }>(`/splits/pledges/${id}/release/build`, { caller }),
  buildRefundPledge: (caller: string, id: number) =>
    post<{ xdr: string }>(`/splits/pledges/${id}/refund/build`, { caller }),
  pledges: (address: string) =>
    request<PledgeView[]>(`/splits/pledges?address=${encodeURIComponent(address)}`),

  submitSoroban: (signedXdr: string) =>
    post<{ hash: string; status: string }>("/splits/submit", { signedXdr }),
};
