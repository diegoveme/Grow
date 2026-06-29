import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import postgres from 'postgres';
import type { AppConfig } from '../config/configuration';

const SCHEMA = `
create table if not exists remittances (
  id            uuid primary key,
  from_address  text        not null,
  to_address    text        not null,
  amount        text        not null,
  asset         text        not null default 'USDC',
  status        text        not null default 'pending',
  spendable_bps integer     not null,
  vault_bps     integer     not null,
  tx_hash       text,
  created_at    timestamptz not null default now()
);
create index if not exists remittances_to_idx on remittances (to_address);
create index if not exists remittances_from_idx on remittances (from_address);
create index if not exists remittances_created_idx on remittances (created_at desc);
`;

/**
 * Supabase (Postgres) connection via postgres.js. Connects lazily and degrades
 * gracefully: if DATABASE_URL is missing or the connection/schema setup fails,
 * `enabled` stays false and callers fall back to in-memory storage. This keeps
 * the API booting in every environment.
 */
@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private client?: postgres.Sql;

  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  get enabled(): boolean {
    return Boolean(this.client);
  }

  get sql(): postgres.Sql {
    if (!this.client) throw new Error('Database is not configured');
    return this.client;
  }

  async onModuleInit(): Promise<void> {
    const url = this.config.get('databaseUrl', { infer: true });
    if (!url) {
      this.logger.warn('DATABASE_URL not set — remittances will use in-memory storage.');
      return;
    }
    try {
      // Parse into an options object rather than handing postgres.js the raw
      // URL: this works identically under Node and Bun and lets us force SSL.
      const u = new URL(url);
      const client = postgres({
        host: u.hostname,
        port: Number(u.port || 5432),
        database: u.pathname.slice(1) || 'postgres',
        username: decodeURIComponent(u.username),
        password: decodeURIComponent(u.password),
        ssl: 'require',
        max: 5,
        prepare: false, // safe with Supabase's transaction pooler
        connect_timeout: 10,
      });
      await client.unsafe(SCHEMA);
      this.client = client;
      this.logger.log('Connected to Supabase Postgres and ensured schema.');
    } catch (err) {
      this.logger.error(`Database setup failed, falling back to memory: ${String(err)}`);
      this.client = undefined;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.end({ timeout: 5 });
  }
}
