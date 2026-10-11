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

-- The ZOS account that placed the order while signed in. The portal lists
-- orders by this, never by email, since ZOS doesn't verify addresses.
alter table compute_orders add column if not exists user_id text;
create index if not exists compute_orders_user_idx on compute_orders (user_id, created_at desc) where user_id is not null;

-- One row per sign-in. The signed session cookie names a row, so logging out
-- (or revoking the row) ends the session even if the cookie is kept.
create table if not exists account_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create index if not exists account_sessions_user_idx on account_sessions (user_id);

-- Fixed-window request counters for rate limiting (see src/lib/rateLimit.ts).
create table if not exists rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits integer not null default 1,
  primary key (key, window_start)
);

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

-- Data rooms: private file shares in the portal. File bytes live in a private
-- Vercel Blob store under data-rooms/<room id>/; these tables hold the rest.
create table if not exists data_rooms (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  created_by_user_id text not null,
  created_by_email text not null
);

-- One row per invited email. A row grants access only once its invite link has
-- been accepted by a signed-in ZOS account with that email, which binds user_id.
create table if not exists data_room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references data_rooms (id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'viewer')),
  user_id text,
  invited_by_email text,
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  -- sha256 of the emailed token; cleared once accepted.
  invite_token_hash text unique,
  invite_expires_at timestamptz,
  unique (room_id, email)
);

create unique index if not exists data_room_members_room_user_idx
  on data_room_members (room_id, user_id) where user_id is not null;
create index if not exists data_room_members_user_idx on data_room_members (user_id) where user_id is not null;

create table if not exists data_room_folders (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references data_rooms (id) on delete cascade,
  parent_id uuid references data_room_folders (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create index if not exists data_room_folders_room_idx on data_room_folders (room_id);

-- Deleted files keep their row (deleted_at set) so the audit trail still names them.
create table if not exists data_room_files (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references data_rooms (id) on delete cascade,
  folder_id uuid references data_room_folders (id) on delete set null,
  name text not null,
  content_type text not null,
  size_bytes bigint not null,
  blob_pathname text not null unique,
  uploaded_by_email text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists data_room_files_room_idx on data_room_files (room_id) where deleted_at is null;

-- Audit trail, visible to the room's admins only.
create table if not exists data_room_events (
  id bigint generated always as identity primary key,
  room_id uuid not null references data_rooms (id) on delete cascade,
  file_id uuid references data_room_files (id) on delete set null,
  actor_user_id text,
  actor_email text not null,
  action text not null,
  -- Snapshot of what the event touched (file name, invitee, role), since rows change later.
  detail jsonb not null default '{}',
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists data_room_events_room_created_idx on data_room_events (room_id, created_at desc);
