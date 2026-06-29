/**
 * Stellar / Soroban network configuration.
 *
 * Defaults target TESTNET. Contract addresses for Blend & DeFindex are read
 * from environment at the app layer (pools/vaults are deployed on-demand by
 * their factories), with the well-known factory/token addresses below as a
 * starting point.
 */

export const TESTNET_PASSPHRASE = 'Test SDF Network ; September 2015';
export const PUBLIC_PASSPHRASE = 'Public Global Stellar Network ; September 2015';

export const TESTNET = {
  passphrase: TESTNET_PASSPHRASE,
  sorobanRpc: 'https://soroban-testnet.stellar.org',
  horizon: 'https://horizon-testnet.stellar.org',
  friendbot: 'https://friendbot.stellar.org',
} as const;

/** SEP-24 reference anchor used for the interactive deposit/withdraw demo. */
export const TESTNET_ANCHOR = {
  homeDomain: 'testanchor.stellar.org',
  toml: 'https://testanchor.stellar.org/.well-known/stellar.toml',
  webAuth: 'https://testanchor.stellar.org/auth',
  transferServerSep24: 'https://testanchor.stellar.org/sep24',
  /** SRT is the recommended end-to-end test asset on this anchor. */
  testAssetCode: 'SRT',
} as const;

/**
 * Well-known testnet contract addresses (Blend V2 deployment + DeFindex factory).
 * Individual pool / vault addresses are deployed on-demand and supplied via env.
 */
export const TESTNET_CONTRACTS = {
  blend: {
    poolFactoryV2: 'CDV6RX4CGPCOKGTBFS52V3LMWQGZN3LCQTXF5RVPOOCG4XVMHXQ4NTF6',
    backstopV2: 'CBDVWXT433PRVTUNM56C3JREF3HIZHRBA64NB2C3B2UNCKIS65ZYCLZA',
  },
  defindex: {
    factory: 'CDSCWE4GLNBYYTES2OCYDFQA2LLY4RBIAX6ZI32VSUXD7GO6HRPO4A32',
  },
  tokens: {
    usdc: 'CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU',
    xlm: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
    blnd: 'CB22KRA3YZVCNCQI64JQ5WE7UY2VAV7WFLK6A2JN3HEX56T2EDAFO7QF',
  },
} as const;

/** Stellar assets use 7-decimal fixed point. */
export const STROOPS_PER_UNIT = 10_000_000n;

export type StellarNetwork = 'TESTNET' | 'PUBLIC';
