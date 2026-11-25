import { post, request } from "./client";
import type { AccountInfo, AssetCode, PaymentRecord } from "./types";

/** Classic layer: balances, history, XLM/USDC payments, trustline, faucet. */
export const accountsApi = {
  health: () =>
    request<{ status: string; network: string; database: string }>("/health"),

  

  account: (address: string) => request<AccountInfo>(`/accounts/${address}`),
  payments: (address: string, limit = 25) =>
    request<PaymentRecord[]>(`/accounts/${address}/payments?limit=${limit}`),
  fund: (address: string) =>
    request<{ funded: boolean }>(`/accounts/${address}/fund`, { method: "POST" }),
  buildPayment: (body: {
    from: string;
    to: string;
    asset: AssetCode;
    amount: string;
    memo?: string;
  }) =>
    post<{ xdr: string }>("/accounts/payment/build", body),
  buildTrustline: (account: string) =>
    post<{ xdr: string }>("/accounts/trustline/build", { account }),
  submitClassic: (signedXdr: string) =>
    post<{ hash: string; status: string }>("/accounts/submit", { signedXdr }),
};
