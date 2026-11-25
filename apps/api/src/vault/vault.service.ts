import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { xdr } from '@stellar/stellar-sdk';
import { fromStroops, toStroops, type VaultPosition } from '@raiz/shared';
import type { AppConfig } from '../config/configuration';
import { SorobanService } from '../stellar/soroban.service';
import { addressArg, i128, vec } from '../stellar/scval';
import { sharesForAmount, withSlippage } from './vault-math';

/** DeFindex shares (dfTokens) use 7 decimals; price is quoted per 1 share. */
const ONE_SHARE = 10_000_000n;
/** Max slippage accepted on deposits and withdrawals: 1%. */
const SLIPPAGE_BPS = 100n;

/**
 * Savings vault: a DeFindex vault whose strategy supplies USDC into a Blend
 * lending pool. Deposits, withdrawals and positions talk to the vault
 * contract directly over Soroban RPC, so no DeFindex API key is needed.
 * The rate comes from the DeFindex API when a key is set, else straight from
 * the Blend pool.
 */
@Injectable()
export class VaultService {
  private readonly logger = new Logger(VaultService.name);

  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    private readonly soroban: SorobanService,
  ) {}

  private cfg() {
    return {
      contracts: this.config.get('contracts', { infer: true }),
      rpc: this.config.get('sorobanRpcUrl', { infer: true }),
      passphrase: this.config.get('networkPassphrase', { infer: true }),
      apiKey: this.config.get('defindexApiKey', { infer: true }),
      network: this.config.get('network', { infer: true }),
    };
  }

  private vaultId(): string {
    const vault = this.cfg().contracts.defindexVault;
    if (!vault) throw new ServiceUnavailableException('DEFINDEX_VAULT_ADDRESS is not configured.');
    return vault;
  }

  // ── Rate ──────────────────────────────────────────────────────────────────

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

  /** Vault rate: DeFindex API if a key is set, else the Blend pool it supplies. */
  async getApy(): Promise<{ apy: number; source: string }> {
    const { contracts, apiKey, network } = this.cfg();
    if (contracts.defindexVault && apiKey) {
      try {
        const { DefindexSDK, SupportedNetworks } = await import('@defindex/sdk');
        const sdk = new DefindexSDK({ apiKey });
        const res = await sdk.getVaultAPY(
          contracts.defindexVault,
          network === 'PUBLIC' ? SupportedNetworks.MAINNET : SupportedNetworks.TESTNET,
        );
        // The DeFindex API reports vault APY as a percentage (19.4 = 19.4%).
        const percent = Number(res?.apy);
        if (!Number.isFinite(percent)) throw new Error(`unexpected APY payload ${JSON.stringify(res)}`);
        return { apy: percent / 100, source: 'defindex' };
      } catch (err) {
        this.logger.warn(`DeFindex APY failed, falling back to Blend: ${String(err)}`);
      }
    }
    return { apy: await this.getBlendApy(), source: 'blend' };
  }

  // ── Position ──────────────────────────────────────────────────────────────

  /** Shares (dfTokens) an account holds in the vault. */
  private async shares(user: string): Promise<bigint> {
    return BigInt(await this.soroban.readContract<bigint>(this.vaultId(), 'balance', [addressArg(user)]));
  }

  /** USDC (base units) one share is worth right now. */
  private async pricePerShare(): Promise<bigint> {
    const [amount] = await this.soroban.readContract<bigint[]>(
      this.vaultId(),
      'get_asset_amounts_per_shares',
      [i128(ONE_SHARE)],
    );
    return BigInt(amount ?? 0n);
  }

  /** A depositor's vault position: current USDC value, shares, rate. */
  async getPosition(user: string): Promise<VaultPosition> {
    const vault = this.vaultId();
    const [shares, price, rate] = await Promise.all([
      this.shares(user),
      this.pricePerShare(),
      this.getApy().catch(() => ({ apy: 0, source: 'unavailable' })),
    ]);
    return {
      vaultAddress: vault,
      currentValue: fromStroops((shares * price) / ONE_SHARE, 7),
      shares: fromStroops(shares, 7),
      apy: rate.apy,
      strategy: 'Blend USDC pool',
    };
  }

  // ── Transactions ──────────────────────────────────────────────────────────

  /** Unsigned deposit of `amount` USDC, invested into the strategy right away. */
  async buildDeposit(amount: string, caller: string): Promise<string> {
    const stroops = toStroops(amount);
    return this.soroban
      .buildInvocation(caller, this.vaultId(), 'deposit', [
        vec([i128(stroops)]),
        vec([i128(withSlippage(stroops, SLIPPAGE_BPS))]),
        addressArg(caller),
        xdr.ScVal.scvBool(true),
      ])
      .catch((err) => this.vaultError(err, 'deposit'));
  }

  /**
   * Unsigned withdrawal of `amount` USDC. The vault burns shares, so the
   * amount is converted at the current price (rounding up so the user gets
   * at least what they asked for); asking for about everything withdraws all
   * shares.
   */
  async buildWithdraw(amount: string, caller: string): Promise<string> {
    const wanted = toStroops(amount);
    const [held, price] = await Promise.all([this.shares(caller), this.pricePerShare()]);
    if (held === 0n) throw new BadRequestException('You have nothing in the vault yet.');
    const shares = sharesForAmount(wanted, price, ONE_SHARE, held);
    const expected = (shares * price) / ONE_SHARE;
    return this.soroban
      .buildInvocation(caller, this.vaultId(), 'withdraw', [
        i128(shares),
        vec([i128(withSlippage(expected, SLIPPAGE_BPS))]),
        addressArg(caller),
      ])
      .catch((err) => this.vaultError(err, 'withdraw'));
  }

  /** Keep the user-facing message from SorobanService; add context otherwise. */
  private vaultError(err: unknown, action: 'deposit' | 'withdraw'): never {
    if (err instanceof BadRequestException || err instanceof ServiceUnavailableException) throw err;
    const msg = String((err as Error)?.message ?? err);
    throw new BadRequestException(`Vault ${action} failed: ${msg.slice(0, 180)}`);
  }
}
