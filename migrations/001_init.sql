-- Vimba MVP schema.
-- Private operational records are tenant-scoped by org_id and protected by
-- row level security (RLS). The application switches to the non-owner role
-- `vimba_app` inside every transaction and declares which organisations the
-- authenticated actor belongs to (app.org_ids) or that it is running a
-- system/public service path (app.system = 'on').
-- RLS is a logical separation, not physically isolated infrastructure.

create extension if not exists pgcrypto;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'vimba_app') then
    create role vimba_app nologin;
  end if;
end $$;

-- Membership context helpers ------------------------------------------------
create or replace function app_org_ids() returns uuid[]
language sql stable as $$
  select coalesce(nullif(current_setting('app.org_ids', true), '')::uuid[], '{}'::uuid[])
$$;

create or replace function app_is_system() returns boolean
language sql stable as $$
  select coalesce(current_setting('app.system', true), '') = 'on'
$$;

-- Supported languages. Ndebele (nd) is a first-class output and UI language
-- alongside English (en) and Shona (sn).
create domain lang_code as text check (value in ('en', 'sn', 'nd'));

-- Organisations and people ---------------------------------------------------
create table organisations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  domain text,
  domain_check_status text not null default 'unchecked'
    check (domain_check_status in ('unchecked', 'verified', 'failed')),
  response_target_hours int not null default 72 check (response_target_hours > 0),
  default_language lang_code not null default 'en',
  created_at timestamptz not null default now()
);

create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  display_name text not null,
  password_hash text not null,
  locale lang_code not null default 'en',
  created_at timestamptz not null default now()
);

create table memberships (
  org_id uuid not null references organisations(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null check (role in ('reporter', 'editor', 'partner_editor')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create table sessions (
  token_sha256 text primary key,
  user_id uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- Stories, outputs and immutable versions -----------------------------------
create table stories (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id),
  title text not null,
  owner_id uuid not null references users(id),
  created_at timestamptz not null default now(),
  unique (org_id, id)
);

create table outputs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  story_id uuid not null,
  kind text not null check (kind in ('article', 'bulletin', 'graphic', 'partner_copy')),
  language lang_code not null,
  title text not null,
  draft_body text not null default '',
  draft_revision int not null default 1,
  -- Provenance: a partner copy points at the origin output it republishes.
  source_output_id uuid references outputs(id),
  withdrawn_at timestamptz,
  withdrawn_reason text,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  unique (org_id, id),
  foreign key (org_id, story_id) references stories(org_id, id)
);

create table signing_keys (
  key_id text primary key,
  algorithm text not null default 'Ed25519' check (algorithm = 'Ed25519'),
  public_key_pem text not null,
  issuer_id text not null,
  status text not null default 'active' check (status in ('active', 'retired')),
  created_at timestamptz not null default now(),
  retired_at timestamptz
);

create table output_versions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  output_id uuid not null,
  seq int not null check (seq > 0),
  public_ref text not null unique,
  title text not null,
  body text not null,
  language lang_code not null,
  content_sha256 text not null,
  receipt jsonb not null,
  signature text not null,
  key_id text not null references signing_keys(key_id),
  approved_by uuid not null references users(id),
  approved_at timestamptz not null default now(),
  predecessor_version_id uuid references output_versions(id),
  change_note text,
  correction_id uuid,
  unique (output_id, seq),
  unique (org_id, id),
  foreign key (org_id, output_id) references outputs(org_id, id),
  check ((seq = 1) = (predecessor_version_id is null))
);

-- Published versions are immutable.
create or replace function forbid_mutation() returns trigger
language plpgsql as $$
begin
  raise exception '% rows are immutable', tg_table_name using errcode = 'P0001';
end $$;

create trigger output_versions_immutable
  before update or delete on output_versions
  for each row execute function forbid_mutation();

-- Sources, claims and confirmed links ----------------------------------------
create table source_records (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  story_id uuid not null,
  label text not null,
  description text not null,
  evidence_pointer text,
  access_rule text not null default 'newsroom_only'
    check (access_rule in ('newsroom_only', 'editors_only')),
  revision int not null default 1,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  unique (org_id, id),
  foreign key (org_id, story_id) references stories(org_id, id)
);

create table claims (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  story_id uuid not null,
  label text not null,
  text text not null,
  revision int not null default 1,
  created_at timestamptz not null default now(),
  unique (org_id, id),
  unique (story_id, label),
  foreign key (org_id, story_id) references stories(org_id, id)
);

create table claim_links (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  claim_id uuid not null,
  source_record_id uuid,
  source_revision int,
  output_id uuid not null,
  output_version_id uuid,
  passage text not null,
  status text not null default 'confirmed' check (status in ('suggested', 'confirmed', 'rejected')),
  confirmed_by uuid references users(id),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (org_id, claim_id) references claims(org_id, id),
  foreign key (org_id, output_id) references outputs(org_id, id),
  foreign key (org_id, source_record_id) references source_records(org_id, id),
  foreign key (org_id, output_version_id) references output_versions(org_id, id),
  unique (claim_id, output_id, passage)
);

-- Corrections (Amend) ---------------------------------------------------------
create table corrections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id),
  story_id uuid not null,
  claim_id uuid,
  complaint_id uuid,
  reason text not null,
  status text not null default 'draft'
    check (status in ('draft', 'in_review', 'approved', 'applied')),
  created_by uuid not null references users(id),
  approved_by uuid references users(id),
  approved_at timestamptz,
  approval_key text unique,
  created_at timestamptz not null default now(),
  unique (org_id, id),
  foreign key (org_id, story_id) references stories(org_id, id),
  foreign key (org_id, claim_id) references claims(org_id, id)
);

alter table output_versions
  add foreign key (org_id, correction_id) references corrections(org_id, id);

create table affected_outputs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  correction_id uuid not null,
  output_id uuid not null,
  base_version_id uuid not null,
  replacement_title text not null,
  replacement_body text not null,
  change_note text not null,
  result_version_id uuid,
  unique (correction_id, output_id),
  foreign key (org_id, correction_id) references corrections(org_id, id) on delete cascade,
  foreign key (org_id, output_id) references outputs(org_id, id),
  foreign key (org_id, base_version_id) references output_versions(org_id, id),
  foreign key (org_id, result_version_id) references output_versions(org_id, id)
);

-- Complaints and private cases ------------------------------------------------
create table complaints (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id),
  case_ref text not null unique,
  output_version_id uuid not null,
  passage text not null,
  concern text not null,
  evidence_url text,
  intake_channel text not null check (intake_channel in ('web', 'whatsapp')),
  locale lang_code not null default 'en',
  status text not null default 'received'
    check (status in ('received', 'in_review', 'awaiting_information', 'decision_issued', 'closed')),
  assigned_editor_id uuid references users(id),
  correction_id uuid,
  decision text,
  complainant_accepts boolean,
  group_key text,
  created_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  unique (org_id, id),
  foreign key (org_id, output_version_id) references output_versions(org_id, id),
  foreign key (org_id, correction_id) references corrections(org_id, id)
);

alter table corrections
  add foreign key (org_id, complaint_id) references complaints(org_id, id);

create table case_messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  complaint_id uuid not null,
  author_kind text not null check (author_kind in ('complainant', 'editor', 'system')),
  author_id uuid references users(id),
  body text not null,
  visibility text not null default 'shared' check (visibility in ('shared', 'internal')),
  created_at timestamptz not null default now(),
  foreign key (org_id, complaint_id) references complaints(org_id, id) on delete cascade
);

-- Only token digests are stored; the raw token lives in the complainant's link.
create table case_access (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  complaint_id uuid not null,
  token_sha256 text not null unique,
  permissions text[] not null default '{read,reply}',
  expires_at timestamptz not null,
  sender_key text,
  reply_address_enc text,
  created_at timestamptz not null default now(),
  foreign key (org_id, complaint_id) references complaints(org_id, id) on delete cascade
);
create index case_access_sender_idx on case_access (sender_key);

-- Partner relay ----------------------------------------------------------------
create table relay_requests (
  id uuid primary key default gen_random_uuid(),
  origin_org_id uuid not null references organisations(id),
  recipient_org_id uuid not null references organisations(id),
  correction_id uuid not null,
  origin_output_id uuid not null,
  partner_output_id uuid not null references outputs(id),
  public_evidence text not null,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'acknowledged', 'completed', 'declined', 'failed', 'withdrawn')),
  response_note text,
  completed_version_id uuid references output_versions(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (correction_id, recipient_org_id, partner_output_id),
  foreign key (origin_org_id, correction_id) references corrections(org_id, id),
  foreign key (origin_org_id, origin_output_id) references outputs(org_id, id),
  check (origin_org_id <> recipient_org_id),
  check (status <> 'completed' or completed_version_id is not null),
  check (status not in ('declined', 'failed', 'withdrawn') or response_note is not null)
);

-- Outbox and delivery ------------------------------------------------------------
create table outbox (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('relay.notify', 'whatsapp.send')),
  channel text,
  payload jsonb not null,
  idempotency_key text not null unique,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'dead')),
  attempts int not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index outbox_due_idx on outbox (status, next_attempt_at);

create table delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  outbox_id uuid not null references outbox(id) on delete cascade,
  attempted_at timestamptz not null default now(),
  ok boolean not null,
  provider_message_id text,
  provider_status text,
  error_code text
);
create index delivery_attempts_provider_idx on delivery_attempts (provider_message_id);

-- WhatsApp channel ---------------------------------------------------------------
create table channel_events (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  webhook_event text not null,
  provider_message_id text,
  kapso_conversation_id text,
  sender_key text,
  is_test boolean not null default false,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text
);
create index channel_events_sender_idx on channel_events (sender_key, received_at);

create table channel_sessions (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('whatsapp', 'simulator')),
  sender_key text not null,
  reply_address_enc text,
  state text not null default 'menu',
  state_version int not null default 0,
  draft jsonb not null default '{}'::jsonb,
  locale lang_code not null default 'en',
  invalid_count int not null default 0,
  stopped boolean not null default false,
  rate_notified_at timestamptz,
  last_inbound_at timestamptz,
  expires_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (channel, sender_key)
);

create table channel_usage (
  month text primary key,
  inbound_count int not null default 0,
  outbound_count int not null default 0,
  soft_cap_reached_at timestamptz
);

-- Audit ----------------------------------------------------------------------------
-- Never store contact data, tracking tokens or source details here.
create table audit_events (
  id bigserial primary key,
  org_id uuid references organisations(id),
  actor_id uuid references users(id),
  action text not null,
  ref_type text not null,
  ref_id text not null,
  detail jsonb not null default '{}'::jsonb,
  at timestamptz not null default now()
);

-- Row level security ---------------------------------------------------------------
-- Tables with a single owning organisation.
do $$
declare t text;
begin
  foreach t in array array[
    'stories', 'outputs', 'output_versions', 'source_records', 'claims',
    'claim_links', 'corrections', 'affected_outputs', 'complaints',
    'case_messages', 'case_access'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format(
      'create policy tenant_isolation on %I using (app_is_system() or org_id = any(app_org_ids())) '
      'with check (app_is_system() or org_id = any(app_org_ids()))', t);
  end loop;
end $$;

-- Relay requests are visible to both the origin and the recipient newsroom.
alter table relay_requests enable row level security;
alter table relay_requests force row level security;
create policy relay_parties on relay_requests
  using (app_is_system() or origin_org_id = any(app_org_ids()) or recipient_org_id = any(app_org_ids()))
  with check (app_is_system() or origin_org_id = any(app_org_ids()) or recipient_org_id = any(app_org_ids()));

-- Channel, outbox and session tables are only touched by system service paths.
do $$
declare t text;
begin
  foreach t in array array['outbox', 'delivery_attempts', 'channel_events', 'channel_sessions', 'channel_usage', 'sessions'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('create policy system_only on %I using (app_is_system()) with check (app_is_system())', t);
  end loop;
end $$;

alter table audit_events enable row level security;
alter table audit_events force row level security;
create policy audit_scope on audit_events
  using (app_is_system() or org_id = any(app_org_ids()))
  with check (app_is_system() or org_id = any(app_org_ids()) or org_id is null);

grant usage on schema public to vimba_app;
grant select, insert, update, delete on all tables in schema public to vimba_app;
grant usage, select on all sequences in schema public to vimba_app;
grant execute on all functions in schema public to vimba_app;
