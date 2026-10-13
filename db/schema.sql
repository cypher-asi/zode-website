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

-- What a user has changed about themselves in portal settings, over what ZOS
-- returns at sign-in (the ZOS token isn't kept, so edits can't go back to ZOS).
-- Null columns fall back to ZOS. The photo lives in the private Blob store
-- under avatars/<user id>/, served by /api/account/avatar/<user id>.
create table if not exists account_profiles (
  user_id text primary key,
  display_name text,
  avatar_pathname text,
  updated_at timestamptz not null default now()
);

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

-- Whether ZODE would buy the site or lease it. It picks the room's summary
-- economics and its standard folders; existing rooms were all purchases.
alter table data_rooms add column if not exists kind text not null default 'purchase'
  check (kind in ('purchase', 'lease'));

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

-- Diligence tags from a bulk import's file index (date, doctype, status, md5, ...).
alter table data_room_files add column if not exists metadata jsonb;

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

-- Executed mutual NDAs. The stamped PDF lives in the private Blob store at
-- blob_pathname; pdf_sha256 fingerprints it, and the row keeps every value
-- that was stamped so the agreement can be read without the file.
create table if not exists mndas (
  id uuid primary key default gen_random_uuid(),
  signed_at timestamptz not null default now(),
  template_version text not null,
  entity_name text not null,
  entity_type text not null,
  entity_address text not null,
  signer_name text not null,
  signer_title text not null,
  signer_email text not null,
  -- The ZOS account that signed while logged in. Only agreements bound to an
  -- account satisfy a data room's MNDA requirement, since ZOS doesn't verify emails.
  user_id text,
  room_id uuid references data_rooms (id) on delete set null,
  zode_signer_name text not null,
  zode_signer_title text not null,
  blob_pathname text not null unique,
  pdf_sha256 text not null,
  ip text,
  user_agent text
);

create index if not exists mndas_user_idx on mndas (user_id) where user_id is not null;
create index if not exists mndas_signed_at_idx on mndas (signed_at desc);

-- Invites that require the invitee to sign the MNDA before they can join.
alter table data_room_members add column if not exists requires_mnda boolean not null default false;

-- A room's diligence summary, its landing page. `diligence` answers the fixed
-- questions in src/features/data-room/summary.ts and `economics` holds only the
-- sourced site facts; revenue and IRR are computed from the compute model on view.
-- Written by scripts/write-room-summary.mjs.
create table if not exists data_room_summaries (
  room_id uuid primary key references data_rooms (id) on delete cascade,
  diligence jsonb not null,
  economics jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by_email text not null
);

-- News and changelog posts, written by ZODE admins in the portal. The body is
-- Markdown, and images live in the private Blob store under posts/, served by
-- /post-media. The author is a snapshot of the ZOS account that created the
-- post, since accounts live in ZOS rather than here.
create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('news', 'changelog')),
  status text not null default 'draft' check (status in ('draft', 'published')),
  slug text not null,
  title text not null default '',
  summary text not null default '',
  body_md text not null default '',
  -- Changelog only, e.g. "1.4".
  version text,
  cover_pathname text,
  author_user_id text not null,
  author_name text not null,
  author_email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by_email text,
  -- Set on first publish and kept through later edits, so the post's date doesn't move.
  published_at timestamptz,
  unique (kind, slug)
);

create index if not exists posts_published_idx on posts (kind, published_at desc) where status = 'published';

-- The mailing list: one row per email. Signing up is double opt-in, since
-- anyone can type any address: a row is 'pending' until the emailed link is
-- followed. user_id links the ZOS account that signed up while logged in with
-- this same email. ip and user_agent record where consent was given.
create table if not exists mailing_list_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text,
  status text not null default 'pending' check (status in ('pending', 'subscribed', 'unsubscribed')),
  -- Where they signed up, e.g. 'news', 'changelog', 'settings'.
  source text,
  user_id text,
  -- sha256 of the emailed confirmation token; cleared once confirmed.
  confirm_token_hash text unique,
  confirm_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  ip text,
  user_agent text
);

create index if not exists mailing_list_subscribers_user_idx on mailing_list_subscribers (user_id) where user_id is not null;
create index if not exists mailing_list_subscribers_status_idx on mailing_list_subscribers (status, created_at desc);

-- Every ZOS account seen signing in to this site, refreshed at each sign-in, so
-- the data room share dialog can suggest people. ZOS doesn't verify emails, so
-- this only feeds suggestions: access is still granted by the emailed invite link.
-- display_name is null for accounts backfilled from records that carry no name.
create table if not exists account_directory (
  user_id text primary key,
  email text not null,
  display_name text,
  last_seen_at timestamptz not null default now()
);

create index if not exists account_directory_email_idx on account_directory (lower(email));

-- Backfill from accounts that left a record before the directory existed; each
-- source takes its latest row per account, and earlier sources win.
insert into account_directory (user_id, email, display_name, last_seen_at)
select distinct on (user_id) user_id, lower(signer_email), signer_name, signed_at
from mndas where user_id is not null
order by user_id, signed_at desc
on conflict (user_id) do nothing;

insert into account_directory (user_id, email, display_name, last_seen_at)
select distinct on (user_id) user_id, lower(email), name, created_at
from compute_orders where user_id is not null
order by user_id, created_at desc
on conflict (user_id) do nothing;

insert into account_directory (user_id, email, display_name, last_seen_at)
select distinct on (user_id) user_id, lower(email), null, coalesce(accepted_at, invited_at)
from data_room_members where user_id is not null
order by user_id, coalesce(accepted_at, invited_at) desc
on conflict (user_id) do nothing;

-- The site's own record of each ZOS account. `id` is the ZODE user id,
-- numbered in the order accounts arrived; other tables still key by ZOS id.
-- `role` is site-wide and separate from data room roles: 'member' (shown as
-- Regular) is everyone who signs up; 'team' is the ZODE team, who can open
-- data rooms; super admins can do all that, see every account's records and
-- set anyone's role. A row is added at sign-in.
create table if not exists users (
  id bigint generated always as identity primary key,
  zos_user_id text not null unique,
  role text not null default 'member' check (role in ('member', 'team', 'super_admin')),
  role_updated_at timestamptz,
  role_updated_by bigint references users (id),
  created_at timestamptz not null default now()
);

alter table users drop constraint if exists users_role_check;
alter table users add constraint users_role_check check (role in ('member', 'team', 'super_admin'));

-- Inserts below skip existing rows with `not exists` rather than `on conflict`,
-- which would spend an id on every row it skips, at every build.

-- Bootstrap: n3o (n3o@zero.tech) is user 1 and the first super admin. Only
-- inserted once, so a later change to the role sticks.
insert into users (zos_user_id, role, role_updated_at)
select 'f977959f-08db-4e09-b730-b5d7a6577481', 'super_admin', now()
where not exists (select 1 from users where zos_user_id = 'f977959f-08db-4e09-b730-b5d7a6577481');

-- Every account seen before this table existed, or whose sign-in couldn't add its row.
insert into users (zos_user_id)
select d.user_id from account_directory d
where not exists (select 1 from users u where u.zos_user_id = d.user_id)
order by d.last_seen_at;

-- Invites to the ZODE team, sent by super admins from Settings > Team to an
-- email that may not have an account yet. Accepting needs the emailed link and
-- a sign-in with the same email, then sets that account's role to 'team'.
create table if not exists team_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  -- sha256 of the emailed token; cleared once accepted.
  invite_token_hash text unique,
  invite_expires_at timestamptz,
  invited_by bigint references users (id),
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  accepted_user_id bigint references users (id)
);

create unique index if not exists team_invites_pending_email_idx on team_invites (email) where accepted_at is null;
