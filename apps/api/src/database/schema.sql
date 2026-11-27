-- Grow · Supabase/Postgres schema
-- Off-chain metadata for remittances moving through the pipeline. The chain is
-- the source of truth for balances; this table powers the dashboard timeline.

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
-- One row per on-chain transaction; also the ON CONFLICT target for inserts.
create unique index if not exists remittances_tx_hash_key on remittances (tx_hash);

-- Indexed yield_splitter events (stats) and the RPC cursor per contract.
create table if not exists contract_events (
  id           text primary key,
  contract_id  text        not null,
  ledger       integer     not null,
  tx_hash      text        not null,
  closed_at    timestamptz not null,
  type         text        not null,
  account      text,
  from_address text,
  amount       text,
  spendable    text,
  savings      text
);
create index if not exists contract_events_contract_idx on contract_events (contract_id, ledger);
-- Schedule/pledge id and the other party (added with recurring and conditional remittances).
alter table contract_events add column if not exists ref text;
alter table contract_events add column if not exists counterparty text;
create table if not exists sync_cursors (
  name       text primary key,
  cursor     text        not null,
  updated_at timestamptz not null default now()
);
-- Grow reaches Postgres only as the table owner, which bypasses RLS. Enabling it
-- with no policies keeps Supabase's public Data API (anon/authenticated keys)
-- from reading or writing these tables.
alter table remittances enable row level security;
alter table contract_events enable row level security;
alter table sync_cursors enable row level security;
