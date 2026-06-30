import { config } from "./config";
import type { AccountState, AssetCode, Remittance, VaultPosition } from "@raiz/shared";

export type { AssetCode };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${config.apiUrl}/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let message = `API ${res.status}`;
    try {
      const body = await res.json();
      const m = body?.message;
      message = Array.isArray(m) ? m.join(", ") : (m ?? body?.error ?? message);
    } catch {
      message = `${message}: ${await res.text().catch(() => "")}`;
    }
    throw new Error(String(message));
  }
  return (await res.json()) as T;
}

export interface SplitPreview {
  amount: string;
  spendableBps: number;
  vaultBps: number;
  spendable: string;
  vault: string;
}

export interface BalanceEntry {
  asset: AssetCode;
  balance: string;
  issuer?: string;
}

export interface AccountInfo {
  address: string;
  exists: boolean;
  funded: boolean;
  usdcTrustline: boolean;
  balances: BalanceEntry[];
  xlm: string;
  usdc: string | null;
}

export interface PaymentRecord {
  id: string;
  type: string;
  direction: "in" | "out" | "self";
  asset: AssetCode | string;
  amount: string;
  from: string;
  to: string;
  createdAt: string;
  hash: string;
}

export const api = {
  health: () =>
    request<{ status: string; network: string; database: string }>("/health"),

  // ── Real money (classic) ────────────────────────────────────────────────
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
    request<{ xdr: string }>("/accounts/payment/build", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  buildTrustline: (account: string) =>
    request<{ xdr: string }>("/accounts/trustline/build", {
      method: "POST",
      body: JSON.stringify({ account }),
    }),
  submitClassic: (signedXdr: string) =>
    request<{ hash: string; status: string }>("/accounts/submit", {
      method: "POST",
      body: JSON.stringify({ signedXdr }),
    }),

  // ── Splits / contract (Soroban) ─────────────────────────────────────────
  previewSplit: (amount: string, spendableBps?: number) =>
    request<SplitPreview>("/remittances/preview", {
      method: "POST",
      body: JSON.stringify({ amount, spendableBps }),
    }),
  position: (address: string) => request<AccountState>(`/splits/${address}`),
  ratio: (address: string) =>
    request<{ spendableBps: number; vaultBps: number }>(`/splits/${address}/ratio`),
  buildSetSplit: (user: string, spendableBps: number) =>
    request<{ xdr: string }>("/splits/ratio/build", {
      method: "POST",
      body: JSON.stringify({ user, spendableBps }),
    }),
  submitSoroban: (signedXdr: string) =>
    request<{ hash: string; status: string }>("/splits/submit", {
      method: "POST",
      body: JSON.stringify({ signedXdr }),
    }),

  // ── Vault / yield ───────────────────────────────────────────────────────
  vaultApy: () => request<{ apy: number; source: string }>("/vault/apy"),
  vaultPosition: (address: string) => request<VaultPosition>(`/vault/position/${address}`),
  buildVaultDeposit: (caller: string, amount: string) =>
    request<{ xdr: string }>("/vault/deposit/build", {
      method: "POST",
      body: JSON.stringify({ caller, amount }),
    }),
  buildVaultWithdraw: (caller: string, amount: string) =>
    request<{ xdr: string }>("/vault/withdraw/build", {
      method: "POST",
      body: JSON.stringify({ caller, amount }),
    }),

  // ── Remittances (DB) ────────────────────────────────────────────────────
  remittances: (address?: string) =>
    request<Remittance[]>(`/remittances${address ? `?address=${address}` : ""}`),
  createRemittance: (body: {
    from: string;
    to: string;
    amount: string;
    spendableBps?: number;
  }) =>
    request<Remittance>("/remittances", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  // ── Anchor (SEP-10 + SEP-24) ────────────────────────────────────────────
  anchorInfo: () =>
    request<{ homeDomain: string; testAsset: string; currencies: { code?: string }[] }>(
      "/anchor/info",
    ),
  anchorChallenge: (account: string) =>
    request<{ transaction: string; networkPassphrase: string }>("/anchor/sep10/challenge", {
      method: "POST",
      body: JSON.stringify({ account }),
    }),
  anchorToken: (signedXdr: string) =>
    request<{ token: string }>("/anchor/sep10/token", {
      method: "POST",
      body: JSON.stringify({ signedXdr }),
    }),
  anchorInteractive: (
    kind: "deposit" | "withdraw",
    jwt: string,
    account: string,
    assetCode: string,
  ) =>
    request<{ url: string; id: string; type: string }>(`/anchor/sep24/${kind}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ account, assetCode }),
    }),
  anchorTransaction: (jwt: string, id: string) =>
    request<{ transaction: Record<string, unknown> }>(
      `/anchor/sep24/transaction?id=${encodeURIComponent(id)}`,
      { headers: { Authorization: `Bearer ${jwt}` } },
    ),
};
