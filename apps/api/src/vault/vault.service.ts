import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { toStroops, type VaultPosition } from '@raiz/shared';
import type { AppConfig } from '../config/configuration';

/**
 * Yield layer. Reads APY from Blend (directly, via RPC — no key needed) and
 * builds DeFindex vault deposit/withdraw transactions (DeFindex's SDK is
 * API-backed and returns unsigned XDR, so the API key stays server-side here
 * and the wallet signs in the browser).
 *
 * The third-party SDKs are loaded lazily so the app boots even when a vault or
 * pool is not yet configured.
 */
@Injectable()
export class VaultService {
  private readonly logger = new Logger(VaultService.name);

  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  private cfg() {
    return {
      contracts: this.config.get('contracts', { infer: true }),
      rpc: this.config.get('sorobanRpcUrl', { infer: true }),
      passphrase: this.config.get('networkPassphrase', { infer: true }),
      apiKey: this.config.get('defindexApiKey', { infer: true }),
      network: this.config.get('network', { infer: true }),
    };
  }

  /** Map the app network to the DeFindex SDK's network enum (testnet ↔ mainnet). */
  private async defindexNetwork() {
    const { SupportedNetworks } = await import('@defindex/sdk');
    return this.cfg().network === 'PUBLIC'
      ? SupportedNetworks.MAINNET
      : SupportedNetworks.TESTNET;
  }

  /** Supply APY (as a fraction, 0.06 = 6%) for the configured Blend USDC pool. */
  async getBlendApy(): Promise<number> {
    const { contracts, rpc, passphrase } = this.cfg();
    if (!contracts.blendPool) {
      throw new ServiceUnavailableException('BLEND_POOL_ID is not configured.');
    }
    try {
      // blend-sdk exposes a versioned Pool loader; tolerate either name.
      const blend = (await import('@blend-capital/blend-sdk')) as Record<string, any>;
      const PoolCls = blend.PoolV2 ?? blend.Pool;
      const network = { rpc, passphrase, opts: { allowHttp: rpc.startsWith('http://') } };
      const pool = await PoolCls.load(network, contracts.blendPool);
      const reserves: Map<string, any> = pool.reserves;
      const reserve = reserves.get(contracts.usdcToken) ?? [...reserves.values()][0];
      if (!reserve) throw new Error('no reserves in pool');
      return Number(reserve.estSupplyApy ?? reserve.supplyApr ?? 0);
    } catch (err) {
      this.logger.error(`Blend APY read failed: ${String(err)}`);
      throw new ServiceUnavailableException('Could not read Blend pool APY');
    }
  }

  /** APY for the DeFindex vault if configured, else falls back to the Blend pool. */
  async getApy(): Promise<{ apy: number; source: string }> {
    const { contracts, apiKey } = this.cfg();
    if (contracts.defindexVault && apiKey) {
      try {
        const sdk = await this.defindex();
        const apy = await sdk.getVaultAPY(contracts.defindexVault, await this.defindexNetwork());
        return { apy: Number(apy), source: 'defindex' };
      } catch (err) {
        this.logger.warn(`DeFindex APY failed, falling back to Blend: ${String(err)}`);
      }
    }
    return { apy: await this.getBlendApy(), source: 'blend' };
  }

  /** A recipient's vault position (principal, current value, APY, strategy). */
  async getPosition(user: string): Promise<VaultPosition> {
    const { contracts } = this.cfg();
    if (!contracts.defindexVault) {
      throw new ServiceUnavailableException('DEFINDEX_VAULT_ADDRESS is not configured.');
    }
    const sdk = await this.defindex();
    const balance = (await sdk.getVaultBalance(
      contracts.defindexVault,
      user,
      await this.defindexNetwork(),
    )) as unknown as Record<string, unknown>;
    const { apy } = await this.getApy();
    const ub = balance.underlyingBalance ?? balance.totalBalance ?? balance.balance;
    const current = String(Array.isArray(ub) ? ub[0] ?? 0 : ub ?? 0);
    return {
      vaultAddress: contracts.defindexVault,
      principal: current,
      currentValue: current,
      apy,
      strategy: 'Blend USDC pool',
    };
  }

  /** Build an unsigned DeFindex deposit transaction (XDR) for the wallet to sign. */
  async buildDeposit(amount: string, caller: string): Promise<string> {
    const { contracts } = this.cfg();
    if (!contracts.defindexVault) {
      throw new ServiceUnavailableException('DEFINDEX_VAULT_ADDRESS is not configured.');
    }
    const sdk = await this.defindex();
    const res = await sdk.depositToVault(
      contracts.defindexVault,
      { amounts: [Number(toStroops(amount))], caller, invest: true, slippageBps: 100 },
      await this.defindexNetwork(),
    );
    return this.extractXdr(res);
  }

  /** Build an unsigned DeFindex withdraw transaction (XDR). */
  async buildWithdraw(shares: string, caller: string): Promise<string> {
    const { contracts } = this.cfg();
    if (!contracts.defindexVault) {
      throw new ServiceUnavailableException('DEFINDEX_VAULT_ADDRESS is not configured.');
    }
    const sdk = await this.defindex();
    const res = await sdk.withdrawShares(
      contracts.defindexVault,
      { shares: Number(toStroops(shares)), caller, slippageBps: 100 },
      await this.defindexNetwork(),
    );
    return this.extractXdr(res);
  }

  private async defindex() {
    const { apiKey } = this.cfg();
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'DEFINDEX_API_KEY is not configured (required for vault operations).',
      );
    }
    const { DefindexSDK } = await import('@defindex/sdk');
    return new DefindexSDK({ apiKey });
  }

  /** DeFindex responses carry the unsigned tx under a few possible keys. */
  private extractXdr(res: unknown): string {
    const r = res as Record<string, string | undefined>;
    const xdr = r.xdr ?? r.transaction ?? r.unsignedTransaction ?? r.envelope;
    if (!xdr) {
      throw new ServiceUnavailableException('DeFindex did not return a transaction to sign.');
    }
    return xdr;
  }
}
