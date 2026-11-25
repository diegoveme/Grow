import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fromStroops, toStroops, type VaultPosition } from '@raiz/shared';
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
        const res = await sdk.getVaultAPY(contracts.defindexVault, await this.defindexNetwork());
        // The DeFindex API reports vault APY as a percentage (19.4 = 19.4%),
        // while the UI works in fractions (0.194).
        const percent = Number(res?.apy);
        if (!Number.isFinite(percent)) throw new Error(`unexpected APY payload ${JSON.stringify(res)}`);
        return { apy: percent / 100, source: 'defindex' };
      } catch (err) {
        this.logger.warn(`DeFindex APY failed, falling back to Blend: ${String(err)}`);
      }
    }
    return { apy: await this.getBlendApy(), source: 'blend' };
  }

  /** A depositor's vault position (current USDC value, APY, strategy). */
  async getPosition(user: string): Promise<VaultPosition> {
    const { contracts } = this.cfg();
    if (!contracts.defindexVault) {
      throw new ServiceUnavailableException('DEFINDEX_VAULT_ADDRESS is not configured.');
    }
    const sdk = await this.defindex();
    const balance = await sdk.getVaultBalance(
      contracts.defindexVault,
      user,
      await this.defindexNetwork(),
    );
    const { apy } = await this.getApy();
    // underlyingBalance is per vault asset, in stroops; this vault holds USDC only.
    const stroops = BigInt(Math.trunc(Number(balance.underlyingBalance?.[0] ?? 0)));
    return {
      vaultAddress: contracts.defindexVault,
      currentValue: fromStroops(stroops, 7),
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
    try {
      const res = await sdk.depositToVault(
        contracts.defindexVault,
        { amounts: [Number(toStroops(amount))], caller, invest: true, slippageBps: 100 },
        await this.defindexNetwork(),
      );
      return this.extractXdr(res);
    } catch (err) {
      throw this.vaultError(err, 'deposit');
    }
  }

  /**
   * Build an unsigned DeFindex withdraw transaction (XDR) for `amount` USDC.
   * Withdraws by underlying amount, so the user never has to think in vault
   * shares (dfTokens), which are not 1:1 with USDC.
   */
  async buildWithdraw(amount: string, caller: string): Promise<string> {
    const { contracts } = this.cfg();
    if (!contracts.defindexVault) {
      throw new ServiceUnavailableException('DEFINDEX_VAULT_ADDRESS is not configured.');
    }
    const sdk = await this.defindex();
    try {
      const res = await sdk.withdrawFromVault(
        contracts.defindexVault,
        { amounts: [Number(toStroops(amount))], caller, slippageBps: 100 },
        await this.defindexNetwork(),
      );
      return this.extractXdr(res);
    } catch (err) {
      throw this.vaultError(err, 'withdraw');
    }
  }

  /** Turn raw DeFindex SDK/simulation errors into clear, user-facing messages. */
  private vaultError(err: unknown, action: 'deposit' | 'withdraw'): never {
    const msg = String((err as Error)?.message ?? err);
    const net = this.cfg().network === 'PUBLIC' ? 'mainnet' : 'testnet';
    if (/missing value|non-existing|MissingValue/i.test(msg)) {
      throw new BadRequestException(
        `This DeFindex vault isn't deployed on ${net}. Vaults run on mainnet — set a ${net} ` +
          `vault in DEFINDEX_VAULT_ADDRESS, or move the app to PUBLIC to use it.`,
      );
    }
    if (/InsufficientBalance|underfunded/i.test(msg)) {
      throw new BadRequestException(`Not enough USDC in your wallet to ${action}.`);
    }
    throw new BadRequestException(`Vault ${action} failed: ${msg.slice(0, 180)}`);
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

  /** DeFindex transaction responses carry the unsigned tx in `xdr`. */
  private extractXdr(res: { xdr: string | null }): string {
    const xdr = res.xdr;
    if (!xdr) {
      throw new ServiceUnavailableException('DeFindex did not return a transaction to sign.');
    }
    return xdr;
  }
}
