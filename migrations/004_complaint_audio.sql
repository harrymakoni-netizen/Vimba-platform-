-- Optional voice recording of a complaint, made in the browser. Same tenant
-- isolation as complaints: only the newsroom that owns the complaint can read it.
create table complaint_audio (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id),
  complaint_id uuid not null,
  mime text not null check (mime in ('audio/webm', 'audio/ogg', 'audio/mp4', 'audio/wav', 'audio/mpeg')),
  bytes bytea not null,
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 3145728),
  sha256 text not null,
  created_at timestamptz not null default now(),
  foreign key (org_id, complaint_id) references complaints(org_id, id) on delete cascade
);
create index complaint_audio_complaint on complaint_audio (complaint_id);
alter table complaint_audio enable row level security;
alter table complaint_audio force row level security;
create policy tenant_isolation on complaint_audio
  using (app_is_system() or org_id = any(app_org_ids()))
  with check (app_is_system() or org_id = any(app_org_ids()));
grant select, insert, update, delete on complaint_audio to vimba_app;
