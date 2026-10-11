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

-- Requests from the "Talk to an Engineer" form; the team emails or texts back to book a meeting.
create table if not exists engineer_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status text not null default 'new',
  -- Any of 'buy' and 'rent'.
  interests text[] not null,
  -- A node-count bucket id from talk-to-an-engineer/options.ts.
  deployment_size text not null,
  name text not null,
  title text,
  website text,
  phone text not null,
  email text not null
);

create index if not exists engineer_requests_created_at_idx on engineer_requests (created_at desc);
