import { config } from "./config";
import type { AccountState, Remittance, VaultPosition } from "@raiz/shared";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${config.apiUrl}/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
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

export const api = {
  health: () => request<{ status: string; network: string }>("/health"),

  // Splits / contract
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
  buildReceive: (from: string, to: string, amount: string) =>
    request<{ xdr: string }>("/splits/receive/build", {
      method: "POST",
      body: JSON.stringify({ from, to, amount }),
    }),
  buildWithdraw: (to: string, amount: string) =>
    request<{ xdr: string }>("/splits/withdraw/build", {
      method: "POST",
      body: JSON.stringify({ to, amount }),
    }),
  buildDepositVault: (to: string) =>
    request<{ xdr: string }>("/splits/deposit-vault/build", {
      method: "POST",
      body: JSON.stringify({ to }),
    }),
  submit: (signedXdr: string) =>
    request<{ hash: string; status: string }>("/splits/submit", {
      method: "POST",
      body: JSON.stringify({ signedXdr }),
    }),

  // Vault
  vaultApy: () => request<{ apy: number; source: string }>("/vault/apy"),
  vaultPosition: (address: string) => request<VaultPosition>(`/vault/position/${address}`),

  // Remittances
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

  // Anchor (SEP-24)
  anchorInfo: () =>
    request<{ homeDomain: string; testAsset: string; currencies: { code?: string }[] }>(
      "/anchor/info",
    ),
};
