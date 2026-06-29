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
    const db = this.config.get('database', { infer: true });

    // Prefer individual vars (password passed raw — no URL-encoding needed for
    // @, spaces, etc.), falling back to a full DATABASE_URL.
    let conn: ConnectionParts | undefined;
    if (db.host && db.password) {
      conn = {
        host: db.host,
        port: db.port,
        database: db.name,
        username: db.user,
        password: db.password,
      };
    } else if (db.url) {
      conn = parseConnectionString(db.url);
    }

    if (!conn) {
      this.logger.warn(
        'No database configured (set DATABASE_HOST + DATABASE_PASSWORD, or DATABASE_URL) — using in-memory storage.',
      );
      return;
    }

    try {
      const client = postgres({
        ...conn,
        ssl: 'require',
        max: 5,
        prepare: false, // safe with Supabase's transaction pooler
        connect_timeout: 10,
      });
      await client.unsafe(SCHEMA);
      this.client = client;
      this.logger.log(
        `Connected to Postgres at ${conn.host}:${conn.port} (db "${conn.database}") and ensured schema.`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Database setup failed (host ${conn.host}), falling back to memory: ${message}`,
      );
      this.client = undefined;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.end({ timeout: 5 });
  }
}

interface ConnectionParts {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

/**
 * Parse a Postgres connection string into parts. Prefers the WHATWG URL parser,
 * but falls back to a manual parse so passwords with unencoded special
 * characters (common with auto-generated DB passwords) still work.
 */
export function parseConnectionString(url: string): ConnectionParts {
  try {
    const u = new URL(url);
    if (!u.hostname) throw new Error('missing host');
    return {
      host: u.hostname,
      port: Number(u.port || 5432),
      database: u.pathname.slice(1) || 'postgres',
      username: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
    };
  } catch {
    const body = url.trim().replace(/^postgres(?:ql)?:\/\//, '');
    const at = body.lastIndexOf('@');
    const creds = body.slice(0, at);
    const rest = body.slice(at + 1);
    const colon = creds.indexOf(':');
    const username = decodeURIComponent(creds.slice(0, colon));
    const password = decodeURIComponent(creds.slice(colon + 1));
    const slash = rest.indexOf('/');
    const hostPort = slash === -1 ? rest : rest.slice(0, slash);
    const database = (slash === -1 ? 'postgres' : rest.slice(slash + 1)).split('?')[0] || 'postgres';
    const [host, port] = hostPort.split(':');
    return { host, port: Number(port || 5432), database, username, password };
  }
}
