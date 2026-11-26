import { Networks } from '@stellar/stellar-sdk';

export type StellarNetwork = 'TESTNET' | 'PUBLIC';

interface NetworkDefaults {
  passphrase: string;
  /** SDF runs no public mainnet RPC, so mainnet has no default. */
  sorobanRpcUrl?: string;
  horizonUrl: string;
  /** SAC of the USDC the contract is deployed with. */
  usdcToken: string;
  /** Classic issuer of that USDC (code USDC). */
  usdcIssuer: string;
}

export const NETWORK_DEFAULTS: Record<StellarNetwork, NetworkDefaults> = {
  TESTNET: {
    passphrase: Networks.TESTNET,
    sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
    horizonUrl: 'https://horizon-testnet.stellar.org',
    // USDC:GATALTG… on testnet, the asset the DeFindex testnet vault uses.
    usdcToken: 'CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU',
    usdcIssuer: 'GATALTGTWIOT6BUDBCZM3Q4OQ4BO2COLOAZ7IYSKPLC2PMSOPPGF5V56',
  },
  PUBLIC: {
    passphrase: Networks.PUBLIC,
    horizonUrl: 'https://horizon.stellar.org',
    // Circle USDC on mainnet and its Stellar Asset Contract.
    usdcToken: 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75',
    usdcIssuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
  },
};

type Env = Record<string, string | undefined>;

const set = (env: Env, key: string) => env[key]?.trim() || undefined;
const sameUrl = (a: string, b?: string) =>
  !!b && a.replace(/\/+$/, '').toLowerCase() === b.replace(/\/+$/, '').toLowerCase();

/**
 * Configuration mistakes that would mix networks or leave mainnet half set
 * up. Empty when the environment is consistent.
 */
export function networkConfigProblems(env: Env): string[] {
  const network = set(env, 'STELLAR_NETWORK') ?? 'TESTNET';
  if (network !== 'TESTNET' && network !== 'PUBLIC') {
    return [`STELLAR_NETWORK must be TESTNET or PUBLIC, got "${network}".`];
  }
  const own = NETWORK_DEFAULTS[network];
  const other = NETWORK_DEFAULTS[network === 'PUBLIC' ? 'TESTNET' : 'PUBLIC'];
  const problems: string[] = [];

  if (network === 'PUBLIC') {
    for (const key of ['SOROBAN_RPC_URL', 'YIELD_SPLITTER_CONTRACT_ID']) {
      if (!set(env, key)) problems.push(`${key} is required on PUBLIC.`);
    }
  }

  const passphrase = set(env, 'STELLAR_NETWORK_PASSPHRASE');
  if (passphrase && passphrase !== own.passphrase) {
    problems.push(`STELLAR_NETWORK_PASSPHRASE does not match ${network}.`);
  }

  const rpc = set(env, 'SOROBAN_RPC_URL');
  const horizon = set(env, 'HORIZON_URL');
  const urlLooksWrong = (url: string, otherDefault?: string) =>
    sameUrl(url, otherDefault) || (network === 'PUBLIC' && /testnet/i.test(url));
  if (rpc && urlLooksWrong(rpc, other.sorobanRpcUrl)) {
    problems.push(`SOROBAN_RPC_URL points at the other network.`);
  }
  if (horizon && urlLooksWrong(horizon, other.horizonUrl)) {
    problems.push(`HORIZON_URL points at the other network.`);
  }
  if (set(env, 'USDC_TOKEN_ID') === other.usdcToken) {
    problems.push(`USDC_TOKEN_ID is the ${network === 'PUBLIC' ? 'testnet' : 'mainnet'} USDC.`);
  }
  if (set(env, 'USDC_ISSUER') === other.usdcIssuer) {
    problems.push(`USDC_ISSUER is the ${network === 'PUBLIC' ? 'testnet' : 'mainnet'} issuer.`);
  }
  return problems;
}

/** Fail fast at boot instead of serving a half-configured or mixed network. */
export function assertNetworkConfig(env: Env): void {
  const problems = networkConfigProblems(env);
  if (problems.length) {
    throw new Error(`Invalid network configuration:\n- ${problems.join('\n- ')}`);
  }
}
