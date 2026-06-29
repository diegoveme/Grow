-- Raíz · Supabase/Postgres schema
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
