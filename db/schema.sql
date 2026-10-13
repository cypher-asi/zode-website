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

-- Whether ZODE would buy the site, lease it, or rent colo space in it. It picks
-- the room's summary economics, a colo's being a lease's; existing rooms were
-- all purchases.
alter table data_rooms add column if not exists kind text not null default 'purchase'
  check (kind in ('purchase', 'lease', 'colo'));
alter table data_rooms drop constraint if exists data_rooms_kind_check;
alter table data_rooms add constraint data_rooms_kind_check check (kind in ('purchase', 'lease', 'colo'));

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
create index if not exists posts_updated_at_idx on posts (updated_at desc);

-- The mailing lists, 'news' and 'changelog': one row per email per list, each
-- joined and left on its own. Signing up is double opt-in, since anyone can
-- type any address: a row is 'pending' until the emailed link is followed.
-- user_id links the ZOS account that signed up while logged in with this same
-- email. ip and user_agent record where consent was given.
create table if not exists mailing_list_subscribers (
  id uuid primary key default gen_random_uuid(),
  list text not null,
  email text not null,
  name text,
  status text not null default 'pending' check (status in ('pending', 'subscribed', 'unsubscribed')),
  -- Where they signed up, e.g. 'news', 'changelog', 'post', 'settings'.
  source text,
  user_id text,
  -- sha256 of the emailed confirmation token; cleared once confirmed. Rows
  -- split from one sign-up share it, so its link confirms them all.
  confirm_token_hash text,
  confirm_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  ip text,
  user_agent text
);

-- Before the split there was one list for both, so every row from then goes on
-- both lists. Only rows with no list yet are copied, which is only ever once.
alter table mailing_list_subscribers add column if not exists list text;
alter table mailing_list_subscribers drop constraint if exists mailing_list_subscribers_email_key;
alter table mailing_list_subscribers drop constraint if exists mailing_list_subscribers_confirm_token_hash_key;

insert into mailing_list_subscribers
  (list, email, name, status, source, user_id, confirm_token_hash, confirm_expires_at,
   created_at, updated_at, confirmed_at, unsubscribed_at, ip, user_agent)
select 'changelog', email, name, status, source, user_id, confirm_token_hash, confirm_expires_at,
  created_at, updated_at, confirmed_at, unsubscribed_at, ip, user_agent
from mailing_list_subscribers where list is null;

update mailing_list_subscribers set list = 'news' where list is null;

alter table mailing_list_subscribers alter column list set not null;
alter table mailing_list_subscribers drop constraint if exists mailing_list_subscribers_list_check;
alter table mailing_list_subscribers add constraint mailing_list_subscribers_list_check check (list in ('news', 'changelog'));

create unique index if not exists mailing_list_subscribers_list_email_idx on mailing_list_subscribers (list, email);
create index if not exists mailing_list_subscribers_token_idx on mailing_list_subscribers (confirm_token_hash) where confirm_token_hash is not null;
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

-- Invites to ZODE, sent by super admins from Users or Settings > Team to an
-- email that may not have an account yet. Accepting needs the emailed link and
-- a sign-in with the same email; a 'team' invite then sets that account's role
-- to 'team', a 'member' invite leaves it Regular.
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

alter table team_invites add column if not exists role text not null default 'team';
alter table team_invites drop constraint if exists team_invites_role_check;
alter table team_invites add constraint team_invites_role_check check (role in ('member', 'team'));

-- ZRM: the team's CRM in the portal, People, Companies and Opportunities,
-- with the data model of OD3N (github.com/cypher-asi/oden). `legacy_id` holds
-- a record's OD3N id so `npm run zrm:import` can re-run without duplicating.
-- `active` pins a record to the top of its list.

-- Company categories, e.g. Neocloud or Hyperscaler. People and opportunities
-- show their company's types rather than having their own.
create table if not exists zrm_types (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  name text not null unique,
  color text not null default '#94A3B8',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists zrm_companies (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  name text not null,
  legal_name text,
  domain text,
  website text,
  industry text,
  employee_count integer,
  revenue text,
  founded_year integer,
  company_type text,
  description text,
  logo_url text,
  email text,
  phone text,
  linkedin_url text,
  twitter_url text,
  crunchbase_url text,
  location text,
  city text,
  state text,
  country text,
  funding_stage text,
  total_funding text,
  latest_round text,
  latest_valuation text,
  ticker text,
  market_cap text,
  technologies text[] not null default '{}',
  specialties text[] not null default '{}',
  tags text[] not null default '{}',
  active boolean not null default false,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists zrm_companies_name_idx on zrm_companies (lower(name));

create table if not exists zrm_company_types (
  company_id uuid not null references zrm_companies (id) on delete cascade,
  type_id uuid not null references zrm_types (id) on delete cascade,
  primary key (company_id, type_id)
);

create index if not exists zrm_company_types_type_idx on zrm_company_types (type_id);

create table if not exists zrm_people (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  first_name text,
  last_name text,
  title text,
  seniority text,
  department text,
  email text,
  personal_email text,
  email_status text,
  phone text,
  mobile_phone text,
  linkedin_url text,
  twitter_url text,
  github_url text,
  company_id uuid references zrm_companies (id) on delete set null,
  location text,
  city text,
  state text,
  country text,
  headline text,
  bio text,
  photo_url text,
  job_started_at date,
  skills text[] not null default '{}',
  tags text[] not null default '{}',
  active boolean not null default false,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists zrm_people_company_idx on zrm_people (company_id);

-- A person's past roles and schooling, in display order.
create table if not exists zrm_work_history (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references zrm_people (id) on delete cascade,
  position integer not null default 0,
  company text,
  title text,
  start_date date,
  end_date date
);

create index if not exists zrm_work_history_person_idx on zrm_work_history (person_id, position);

create table if not exists zrm_education (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references zrm_people (id) on delete cascade,
  position integer not null default 0,
  school text,
  degree text,
  field text,
  start_date date,
  end_date date
);

create index if not exists zrm_education_person_idx on zrm_education (person_id, position);

-- The opportunity pipeline, left to right.
create table if not exists zrm_stages (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  position integer not null default 0
);

insert into zrm_stages (name, position)
select s.name, s.position
from (values ('Contacted', 0), ('Meeting Scheduled', 1), ('Proposal Sent', 2), ('Negotiating', 3), ('Signed Contract', 4))
  as s (name, position)
where not exists (select 1 from zrm_stages);

create table if not exists zrm_opportunities (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  title text not null,
  person_id uuid references zrm_people (id) on delete set null,
  company_id uuid references zrm_companies (id) on delete set null,
  stage_id uuid not null references zrm_stages (id),
  value numeric(14, 2),
  owner_notes text,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists zrm_opportunities_person_idx on zrm_opportunities (person_id);
create index if not exists zrm_opportunities_company_idx on zrm_opportunities (company_id);
create index if not exists zrm_opportunities_stage_idx on zrm_opportunities (stage_id);

-- A log of touches on an opportunity: calls, emails, meetings.
create table if not exists zrm_activities (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  opportunity_id uuid not null references zrm_opportunities (id) on delete cascade,
  kind text not null,
  note text not null default '',
  at timestamptz not null default now()
);

create index if not exists zrm_activities_opportunity_idx on zrm_activities (opportunity_id, at);

-- Free-form key/value pairs on a person or company, in display order.
create table if not exists zrm_custom_fields (
  id uuid primary key default gen_random_uuid(),
  person_id uuid references zrm_people (id) on delete cascade,
  company_id uuid references zrm_companies (id) on delete cascade,
  position integer not null default 0,
  key text not null,
  value text not null default '',
  check (num_nonnulls(person_id, company_id) = 1)
);

create index if not exists zrm_custom_fields_person_idx on zrm_custom_fields (person_id) where person_id is not null;
create index if not exists zrm_custom_fields_company_idx on zrm_custom_fields (company_id) where company_id is not null;

-- Notes on exactly one person, company or opportunity.
create table if not exists zrm_notes (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  person_id uuid references zrm_people (id) on delete cascade,
  company_id uuid references zrm_companies (id) on delete cascade,
  opportunity_id uuid references zrm_opportunities (id) on delete cascade,
  body text not null,
  author_user_id text,
  author_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(person_id, company_id, opportunity_id) = 1)
);

create index if not exists zrm_notes_person_idx on zrm_notes (person_id) where person_id is not null;
create index if not exists zrm_notes_company_idx on zrm_notes (company_id) where company_id is not null;
create index if not exists zrm_notes_opportunity_idx on zrm_notes (opportunity_id) where opportunity_id is not null;

-- Capacity: the team's data center sites, beside ZRM in the portal and
-- linked into it, their provider, customer and broker's firm being ZRM
-- companies and their broker a ZRM person. A site's group is the part of the
-- pipeline sheet it sits in (Critical Path, LOI, a portfolio like Atlas); its
-- status is where the deal stands. `seed_key` lets `npm run capacity:import`
-- re-run without duplicating. `active` pins a site to the top of its list.
create table if not exists capacity_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  position integer not null default 0
);

insert into capacity_groups (name, position)
select g.name, g.position
from (values ('Critical Path', 0), ('LOI', 1), ('Atlas', 2), ('Metroplex', 3), ('Misc', 4)) as g (name, position)
where not exists (select 1 from capacity_groups);

create table if not exists capacity_statuses (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  position integer not null default 0,
  color text not null default '#94A3B8'
);

insert into capacity_statuses (name, position, color)
select s.name, s.position, s.color
from (
  values ('Prospect', 0, '#94A3B8'), ('LOI', 1, '#60A5FA'), ('Diligence', 2, '#F59E0B'),
    ('Contracted', 3, '#8B5CF6'), ('Live', 4, '#22C55E'), ('Passed', 5, '#EF4444')
) as s (name, position, color)
where not exists (select 1 from capacity_statuses);

create table if not exists capacity_sites (
  id uuid primary key default gen_random_uuid(),
  seed_key text unique,
  name text not null,
  address text,
  group_id uuid references capacity_groups (id) on delete set null,
  status_id uuid not null references capacity_statuses (id),
  provider_company_id uuid references zrm_companies (id) on delete set null,
  term_years integer,
  deal_type text check (deal_type in ('Lease', 'JV', 'Buy')),
  -- MW. Secondary can be negative where the second phase revises the first down.
  initial_it_mw numeric(10, 2),
  secondary_it_mw numeric(10, 2),
  total_it_mw numeric(10, 2) generated always as (coalesce(initial_it_mw, 0) + coalesce(secondary_it_mw, 0)) stored,
  -- $ per kW, and $ per kWh of power.
  kw_rate numeric(12, 2),
  power_rate numeric(10, 4),
  upfront numeric(14, 2),
  conversion numeric(14, 2),
  rfs_date date,
  cooling text,
  vdr_url text,
  link_url text,
  customer_company_id uuid references zrm_companies (id) on delete set null,
  broker_person_id uuid references zrm_people (id) on delete set null,
  firm_company_id uuid references zrm_companies (id) on delete set null,
  contract_value numeric(14, 2),
  annual_revenue numeric(14, 2),
  notes text,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists capacity_sites_group_idx on capacity_sites (group_id);
create index if not exists capacity_sites_status_idx on capacity_sites (status_id);
create index if not exists capacity_sites_provider_idx on capacity_sites (provider_company_id);
create index if not exists capacity_sites_customer_idx on capacity_sites (customer_company_id);
create index if not exists capacity_sites_firm_idx on capacity_sites (firm_company_id);
create index if not exists capacity_sites_broker_idx on capacity_sites (broker_person_id);

-- Sites take notes too, so a note hangs off exactly one person, company,
-- opportunity or site. The check is dropped and re-added under one name so
-- this re-runs, replacing the unnamed one zrm_notes was created with.
alter table zrm_notes add column if not exists site_id uuid references capacity_sites (id) on delete cascade;

alter table zrm_notes drop constraint if exists zrm_notes_check;

alter table zrm_notes drop constraint if exists zrm_notes_one_parent;

alter table zrm_notes add constraint zrm_notes_one_parent check (num_nonnulls(person_id, company_id, opportunity_id, site_id) = 1);

create index if not exists zrm_notes_site_idx on zrm_notes (site_id) where site_id is not null;

-- Executed compute contracts, the second kind of contract beside MNDAs. The
-- team records them from a PDF signed elsewhere, so unlike an MNDA there is no
-- template: the row holds the deal's figures and the PDF lives in the private
-- Blob store under contracts/compute/. The company is the opportunity's, or
-- else the site's customer, kept so it survives either link being cleared.
create table if not exists compute_contracts (
  id uuid primary key default gen_random_uuid(),
  signed_at date not null,
  counterparty text not null,
  mode text not null check (mode in ('buy', 'rent')),
  company_id uuid references zrm_companies (id) on delete set null,
  opportunity_id uuid references zrm_opportunities (id) on delete set null,
  site_id uuid references capacity_sites (id) on delete set null,
  it_mw numeric(10, 2),
  -- The total contract value, and the monthly payment or bill.
  value_usd numeric(16, 2),
  monthly_usd numeric(14, 2),
  term_months integer,
  notes text,
  blob_pathname text not null unique,
  recorded_by bigint references users (id),
  created_at timestamptz not null default now()
);

create index if not exists compute_contracts_signed_at_idx on compute_contracts (signed_at desc);

-- The team dashboard's figures, one row per metric per UTC day, written by the
-- daily cron and on each dashboard view (the day's latest wins). The metric
-- names are defined in src/features/team-dashboard/metrics.ts.
create table if not exists team_metric_snapshots (
  day date not null,
  metric text not null,
  value numeric not null,
  taken_at timestamptz not null default now(),
  primary key (day, metric)
);

-- Fills the past year from the timestamps that allow it, never over a real
-- snapshot. Opportunities count by when they were created at their current
-- stage, since stage changes aren't recorded. Capacity can't be rebuilt, as
-- site statuses keep no history, so its line starts at the first snapshot.
insert into team_metric_snapshots (day, metric, value, taken_at)
select d.day, m.metric, m.value, d.day + 1
from (select current_date - n as day from generate_series(1, 365) as n) as d
cross join lateral (
  values
    ('contracts_total',
      (select count(*) from mndas where signed_at < d.day + 1)
      + (select count(*) from compute_contracts where signed_at <= d.day)),
    ('contracts_compute', (select count(*) from compute_contracts where signed_at <= d.day)),
    ('contracts_compute_mw', (select coalesce(sum(it_mw), 0) from compute_contracts where signed_at <= d.day)),
    ('subscribers_confirmed',
      (select count(distinct email) from mailing_list_subscribers
       where confirmed_at < d.day + 1 and (status = 'subscribed' or unsubscribed_at >= d.day + 1))),
    ('subscribers_news',
      (select count(*) from mailing_list_subscribers
       where list = 'news' and confirmed_at < d.day + 1 and (status = 'subscribed' or unsubscribed_at >= d.day + 1))),
    ('subscribers_changelog',
      (select count(*) from mailing_list_subscribers
       where list = 'changelog' and confirmed_at < d.day + 1 and (status = 'subscribed' or unsubscribed_at >= d.day + 1))),
    ('opportunities_open',
      (select count(*) from zrm_opportunities o join zrm_stages g on g.id = o.stage_id
       where o.created_at < d.day + 1 and g.position < (select max(position) from zrm_stages))),
    ('opportunities_pipeline_usd',
      (select coalesce(sum(o.value), 0) from zrm_opportunities o join zrm_stages g on g.id = o.stage_id
       where o.created_at < d.day + 1 and g.position < (select max(position) from zrm_stages)))
) as m (metric, value)
on conflict (day, metric) do nothing;

-- GPU deployments, written by the ZODE team and shown to every signed-in
-- account in the portal's Deployments app. Totals (GPUs, storage, revenue) are
-- derived from the node count and rates in src/features/deployments/types.ts,
-- never stored. Node counts and TB per node are the cluster builder's
-- standard sizes, checked by the save action rather than here, so the
-- builder's catalog can change without a migration.
create table if not exists deployments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'active' check (status in ('planned', 'active', 'completed')),
  nodes integer not null check (nodes > 0),
  platform text not null default 'b300' check (platform in ('b300', 'b200', 'vera_rubin')),
  cooling text not null check (cooling in ('liquid_dtc', 'air')),
  networking text not null check (networking in ('infiniband', 'roce')),
  storage_tb_per_node integer not null default 0 check (storage_tb_per_node >= 0),
  address text,
  -- Taken from the Google place the address was picked from, with its id.
  city text,
  place_id text,
  facility text check (facility in ('colo', 'conversion', 'greenfield')),
  term_months integer check (term_months > 0),
  price_gpu_hr numeric(10, 4) check (price_gpu_hr >= 0),
  deposit_usd numeric(16, 2) check (deposit_usd >= 0),
  credit_rating text check (credit_rating in ('ig', 'high', 'not_required')),
  loc_required boolean not null default false,
  -- The letter of credit, in years of lease, only kept while one is required.
  loc_years numeric(5, 2) check (loc_years > 0),
  credit_guarantee boolean not null default false,
  lease_guarantee boolean not null default false,
  notes text,
  created_by bigint references users (id),
  updated_by bigint references users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists deployments_status_idx on deployments (status);

-- The LOC was first sized in dollars; it's sized in years of lease.
alter table deployments add column if not exists loc_years numeric(5, 2) check (loc_years > 0);
alter table deployments drop column if exists loc_amount_usd;

alter table deployments add column if not exists city text;
alter table deployments add column if not exists place_id text;

alter table deployments drop constraint if exists deployments_platform_check;
alter table deployments add constraint deployments_platform_check check (platform in ('b300', 'b200', 'vera_rubin'));

-- A deployment's rollout: each phase comes ready for service (RFS) on its
-- date with its nodes and MW. `start_on` is optional and only draws the
-- phase's bar on the schedule. Saving replaces every phase.
create table if not exists deployment_phases (
  id uuid primary key default gen_random_uuid(),
  deployment_id uuid not null references deployments (id) on delete cascade,
  position integer not null default 0,
  name text,
  start_on date,
  rfs_on date not null,
  nodes integer not null check (nodes >= 0),
  mw numeric(10, 2) check (mw >= 0)
);

create index if not exists deployment_phases_deployment_idx on deployment_phases (deployment_id, position);
