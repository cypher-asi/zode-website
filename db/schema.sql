-- Orders placed from the /buy-compute configurator. Every statement is
-- idempotent; `npm run db:migrate` applies this file as-is.

create table if not exists compute_orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  mode text not null check (mode in ('buy', 'rent')),
  status text not null default 'new',
  name text not null,
  email text not null,
  company text,
  notes text,
  -- The configuration as chosen, and the quote recomputed from it on the server.
  config jsonb not null,
  quote jsonb not null,
  -- Buy: the financed monthly payment. Rent: the estimated monthly bill.
  monthly_usd numeric(14, 2) not null,
  -- Buy only: the full purchase price.
  total_usd numeric(16, 2)
);

create index if not exists compute_orders_created_at_idx on compute_orders (created_at desc);
