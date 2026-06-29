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
  defindexApiKey?: string;
  databaseUrl?: string;
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
    defindexApiKey: process.env.DEFINDEX_API_KEY?.trim() || undefined,
    databaseUrl: process.env.DATABASE_URL?.trim() || undefined,
  };
};
