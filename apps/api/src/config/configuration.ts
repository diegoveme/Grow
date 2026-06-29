import { Networks } from '@stellar/stellar-sdk';

/** Centralised, typed configuration sourced from the environment. */
export interface AppConfig {
  port: number;
  corsOrigin: string;
  network: 'TESTNET' | 'PUBLIC';
  networkPassphrase: string;
  sorobanRpcUrl: string;
  horizonUrl: string;
  anchor: {
    homeDomain: string;
    testAsset: string;
  };
  contracts: {
    yieldSplitter?: string;
    blendPool?: string;
    defindexVault?: string;
    usdcToken: string;
  };
  /** Classic USDC asset (code + issuer) backing the SAC in `contracts.usdcToken`. */
  usdc: {
    code: string;
    issuer: string;
  };
  defindexApiKey?: string;
  database: {
    url?: string;
    host?: string;
    port: number;
    user: string;
    password?: string;
    name: string;
  };
}

export default (): AppConfig => {
  const network = (process.env.STELLAR_NETWORK ?? 'TESTNET') as 'TESTNET' | 'PUBLIC';
  return {
    port: Number(process.env.API_PORT ?? 3001),
    corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    network,
    networkPassphrase:
      process.env.STELLAR_NETWORK_PASSPHRASE ??
      (network === 'PUBLIC' ? Networks.PUBLIC : Networks.TESTNET),
    sorobanRpcUrl: process.env.SOROBAN_RPC_URL ?? 'https://soroban-testnet.stellar.org',
    horizonUrl: process.env.HORIZON_URL ?? 'https://horizon-testnet.stellar.org',
    anchor: {
      homeDomain: process.env.ANCHOR_HOME_DOMAIN ?? 'testanchor.stellar.org',
      testAsset: process.env.ANCHOR_TEST_ASSET ?? 'SRT',
    },
    contracts: {
      yieldSplitter: process.env.YIELD_SPLITTER_CONTRACT_ID || undefined,
      blendPool: process.env.BLEND_POOL_ID || undefined,
      defindexVault: process.env.DEFINDEX_VAULT_ADDRESS || undefined,
      usdcToken:
        process.env.USDC_TOKEN_ID ??
        'CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU',
    },
    usdc: {
      code: process.env.USDC_CODE ?? 'USDC',
      // Classic issuer whose SAC equals contracts.usdcToken on testnet.
      issuer:
        process.env.USDC_ISSUER ??
        'GATALTGTWIOT6BUDBCZM3Q4OQ4BO2COLOAZ7IYSKPLC2PMSOPPGF5V56',
    },
    defindexApiKey: process.env.DEFINDEX_API_KEY?.trim() || undefined,
    database: {
      // A full connection string is supported, but individual vars take
      // precedence and avoid URL-encoding pitfalls for passwords with @, spaces, etc.
      url: process.env.DATABASE_URL?.trim() || undefined,
      host: process.env.DATABASE_HOST?.trim() || undefined,
      port: Number(process.env.DATABASE_PORT ?? 5432),
      user: process.env.DATABASE_USER?.trim() || 'postgres',
      password: process.env.DATABASE_PASSWORD || undefined,
      name: process.env.DATABASE_NAME?.trim() || 'postgres',
    },
  };
};
