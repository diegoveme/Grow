/** Client configuration sourced from public env vars (testnet defaults). */
const network = (process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? "TESTNET") as "TESTNET" | "PUBLIC";

export const config = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001",
  network,
  networkPassphrase:
    network === "PUBLIC"
      ? "Public Global Stellar Network ; September 2015"
      : "Test SDF Network ; September 2015",
  usdcContractId:
    process.env.NEXT_PUBLIC_USDC_TOKEN_ID ??
    "CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU",
  /** StellarView explorer base for the active network. */
  explorer:
    network === "PUBLIC"
      ? "https://stellarview.acachete.xyz/en/public"
      : "https://stellarview.acachete.xyz/en/testnet",
};

export const explorerTx = (hash: string) => `${config.explorer}/tx/${hash}`;
export const explorerAccount = (address: string) => `${config.explorer}/account/${address}`;
