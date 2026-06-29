import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StellarToml } from '@stellar/stellar-sdk';
import type { AppConfig } from '../config/configuration';

export interface AnchorEndpoints {
  webAuth: string;
  transferServer: string;
  signingKey?: string;
  currencies: { code?: string; issuer?: string }[];
}

/**
 * SEP-10 (auth) + SEP-24 (interactive deposit/withdraw) against the configured
 * Stellar anchor. The browser wallet signs the SEP-10 challenge; this service
 * proxies the anchor's REST endpoints and resolves its stellar.toml.
 */
@Injectable()
export class AnchorService {
  private readonly logger = new Logger(AnchorService.name);
  private endpoints?: AnchorEndpoints;

  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  private homeDomain(): string {
    return this.config.get('anchor', { infer: true }).homeDomain;
  }

  /** Resolve and cache the anchor's SEP-1 stellar.toml endpoints. */
  async info(): Promise<AnchorEndpoints & { homeDomain: string; testAsset: string }> {
    if (!this.endpoints) {
      const toml = await StellarToml.Resolver.resolve(this.homeDomain());
      this.endpoints = {
        webAuth: toml.WEB_AUTH_ENDPOINT as string,
        transferServer: toml.TRANSFER_SERVER_SEP0024 as string,
        signingKey: toml.SIGNING_KEY as string | undefined,
        currencies: ((toml.CURRENCIES as { code?: string; issuer?: string }[]) ?? []).map(
          (c) => ({ code: c.code, issuer: c.issuer }),
        ),
      };
    }
    return {
      ...this.endpoints,
      homeDomain: this.homeDomain(),
      testAsset: this.config.get('anchor', { infer: true }).testAsset,
    };
  }

  /** SEP-10 step 1 — fetch the challenge transaction for the user to sign. */
  async challenge(account: string): Promise<{ transaction: string; networkPassphrase: string }> {
    const { webAuth } = await this.info();
    const res = await fetch(`${webAuth}?account=${encodeURIComponent(account)}`);
    if (!res.ok) {
      throw new InternalServerErrorException(`Anchor challenge failed: ${res.status}`);
    }
    const body = (await res.json()) as { transaction: string; network_passphrase: string };
    return { transaction: body.transaction, networkPassphrase: body.network_passphrase };
  }

  /** SEP-10 step 2 — exchange the signed challenge for a JWT. */
  async token(signedXdr: string): Promise<{ token: string }> {
    const { webAuth } = await this.info();
    const res = await fetch(webAuth, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transaction: signedXdr }),
    });
    if (!res.ok) {
      throw new InternalServerErrorException(`Anchor token failed: ${res.status}`);
    }
    return (await res.json()) as { token: string };
  }

  /** SEP-24 — start an interactive deposit; returns the popup url + tx id. */
  async deposit(jwt: string, assetCode: string, account: string) {
    return this.interactive('deposit', jwt, assetCode, account);
  }

  /** SEP-24 — start an interactive withdrawal. */
  async withdraw(jwt: string, assetCode: string, account: string) {
    return this.interactive('withdraw', jwt, assetCode, account);
  }

  private async interactive(
    kind: 'deposit' | 'withdraw',
    jwt: string,
    assetCode: string,
    account: string,
  ): Promise<{ url: string; id: string; type: string }> {
    const { transferServer } = await this.info();
    const res = await fetch(`${transferServer}/transactions/${kind}/interactive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ asset_code: assetCode, account }),
    });
    if (!res.ok) {
      throw new InternalServerErrorException(`Anchor ${kind} failed: ${res.status}`);
    }
    return (await res.json()) as { url: string; id: string; type: string };
  }

  /** SEP-24 — poll a transaction's status. */
  async transaction(jwt: string, id: string) {
    const { transferServer } = await this.info();
    const res = await fetch(`${transferServer}/transaction?id=${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    if (!res.ok) {
      throw new InternalServerErrorException(`Anchor transaction lookup failed: ${res.status}`);
    }
    return (await res.json()) as { transaction: Record<string, unknown> };
  }
}
