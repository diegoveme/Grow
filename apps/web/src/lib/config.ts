/** Client configuration sourced from public env vars (testnet defaults). */
export const config = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001",
  network: (process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? "TESTNET") as "TESTNET" | "PUBLIC",
  networkPassphrase:
    process.env.NEXT_PUBLIC_STELLAR_NETWORK === "PUBLIC"
      ? "Public Global Stellar Network ; September 2015"
      : "Test SDF Network ; September 2015",
};
