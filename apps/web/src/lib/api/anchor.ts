import { post, request } from "./client";

/** SEP-10 auth and SEP-24 interactive deposit/withdraw through the API proxy. */
export const anchorApi = {
  anchorInfo: () =>
    request<{
      homeDomain: string;
      testAsset: string;
      webAuth: string;
      transferServer: string;
      signingKey?: string;
      currencies: { code?: string }[];
    }>("/anchor/info"),
  anchorChallenge: (account: string) =>
    post<{ transaction: string; networkPassphrase: string }>("/anchor/sep10/challenge", { account }),
  anchorToken: (signedXdr: string) =>
    post<{ token: string }>("/anchor/sep10/token", { signedXdr }),
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
