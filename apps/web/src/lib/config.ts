/** Client configuration sourced from public env vars (testnet defaults). */
type Network = "TESTNET" | "PUBLIC";

/** USDC Stellar Asset Contract per network (testnet: USDC:GATALTG…, mainnet: Circle). */
const USDC: Record<Network, string> = {
  TESTNET: "CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU",
  PUBLIC: "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
};

const network = (process.env.NEXT_PUBLIC_STELLAR_NETWORK || "TESTNET") as Network;
const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const usdcContractId = process.env.NEXT_PUBLIC_USDC_TOKEN_ID || USDC[network];

// Pages are prerendered at build time, so a bad combination fails the build
// instead of shipping a site that mixes networks.
const problems = [
  network !== "TESTNET" &&
    network !== "PUBLIC" &&
    `NEXT_PUBLIC_STELLAR_NETWORK must be TESTNET or PUBLIC, got "${network}".`,
  network === "PUBLIC" &&
    /localhost|127\.0\.0\.1/.test(apiUrl) &&
    "NEXT_PUBLIC_API_URL must point at the mainnet API.",
  usdcContractId === USDC[network === "PUBLIC" ? "TESTNET" : "PUBLIC"] &&
    "NEXT_PUBLIC_USDC_TOKEN_ID belongs to the other network.",
].filter(Boolean);
if (problems.length) {
  throw new Error(`Invalid web network configuration: ${problems.join(" ")}`);
}

export const config = {
  apiUrl,
  network,
  networkPassphrase:
    network === "PUBLIC"
      ? "Public Global Stellar Network ; September 2015"
      : "Test SDF Network ; September 2015",
  usdcContractId,
  /** StellarView explorer base for the active network ("/en/public" now redirects). */
  explorer:
    network === "PUBLIC"
      ? "https://stellarview.acachete.xyz/en/mainnet"
      : "https://stellarview.acachete.xyz/en/testnet",
};

export const explorerTx = (hash: string) => `${config.explorer}/tx/${hash}`;
export const explorerAccount = (address: string) => `${config.explorer}/account/${address}`;
export const explorerContract = (id: string) => `${config.explorer}/contract/${id}`;
