import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from './database/database.service';
import type { AppConfig } from './config/configuration';

@Injectable()
export class AppService {
  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    private readonly db: DatabaseService,
  ) {}

  health() {
    const contracts = this.config.get('contracts', { infer: true });
    return {
      name: 'raiz-api',
      status: 'ok',
      network: this.config.get('network', { infer: true }),
      database: this.db.enabled ? 'supabase' : 'memory',
      configured: {
        yieldSplitter: Boolean(contracts.yieldSplitter),
        blendPool: Boolean(contracts.blendPool),
        defindexVault: Boolean(contracts.defindexVault),
      },
    };
  }
}
