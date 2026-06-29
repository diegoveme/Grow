import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from './config/configuration';

@Injectable()
export class AppService {
  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  health() {
    const contracts = this.config.get('contracts', { infer: true });
    return {
      name: 'raiz-api',
      status: 'ok',
      network: this.config.get('network', { infer: true }),
      configured: {
        yieldSplitter: Boolean(contracts.yieldSplitter),
        blendPool: Boolean(contracts.blendPool),
        defindexVault: Boolean(contracts.defindexVault),
      },
    };
  }
}
