import { assertNetworkConfig, NETWORK_DEFAULTS, networkConfigProblems } from './network';

const T = NETWORK_DEFAULTS.TESTNET;
const P = NETWORK_DEFAULTS.PUBLIC;

const mainnet = {
  STELLAR_NETWORK: 'PUBLIC',
  SOROBAN_RPC_URL: 'https://rpc.example-provider.io/mainnet',
  YIELD_SPLITTER_CONTRACT_ID: 'CBEQUA2ET4XTZAMDB3ZOB6MUOA2B6ACZ6TV2GCDHFTETKBVG7TMBZCYA',
};

describe('networkConfigProblems', () => {
  it('accepts an empty env (testnet defaults)', () => {
    expect(networkConfigProblems({})).toEqual([]);
  });

  it('accepts a complete mainnet env and relies on mainnet defaults', () => {
    expect(networkConfigProblems(mainnet)).toEqual([]);
  });

  it('requires an RPC and the contract on mainnet', () => {
    expect(networkConfigProblems({ STELLAR_NETWORK: 'PUBLIC' })).toEqual([
      'SOROBAN_RPC_URL is required on PUBLIC.',
      'YIELD_SPLITTER_CONTRACT_ID is required on PUBLIC.',
    ]);
  });

  it('rejects testnet values on mainnet', () => {
    const problems = networkConfigProblems({
      ...mainnet,
      SOROBAN_RPC_URL: T.sorobanRpcUrl,
      HORIZON_URL: `${T.horizonUrl}/`,
      USDC_TOKEN_ID: T.usdcToken,
      USDC_ISSUER: T.usdcIssuer,
      STELLAR_NETWORK_PASSPHRASE: T.passphrase,
    });
    expect(problems).toHaveLength(5);
  });

  it('rejects a mainnet USDC on testnet', () => {
    expect(networkConfigProblems({ USDC_TOKEN_ID: P.usdcToken, USDC_ISSUER: P.usdcIssuer })).toEqual([
      'USDC_TOKEN_ID is the mainnet USDC.',
      'USDC_ISSUER is the mainnet issuer.',
    ]);
  });

  it('rejects an unknown network name', () => {
    expect(networkConfigProblems({ STELLAR_NETWORK: 'MAINNET' })).toEqual([
      'STELLAR_NETWORK must be TESTNET or PUBLIC, got "MAINNET".',
    ]);
  });
});

describe('assertNetworkConfig', () => {
  it('throws listing every problem', () => {
    expect(() => assertNetworkConfig({ STELLAR_NETWORK: 'PUBLIC' })).toThrow(
      /SOROBAN_RPC_URL is required[\s\S]*YIELD_SPLITTER_CONTRACT_ID is required/,
    );
  });
});
