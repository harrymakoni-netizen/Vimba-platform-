-- Optional photo of the disputed article, attached to a complaint on the web or
-- WhatsApp. Visible only to the newsroom that owns the complaint (same tenant
-- isolation as complaints). A WhatsApp photo arrives before the complaint is
-- confirmed, so it is stored first with no owner (system-only) and linked on
-- submit. Unlinked photos older than a day are deleted by the worker.
create table complaint_photos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organisations(id),
  complaint_id uuid,
  sender_key text,
  mime text not null check (mime in ('image/jpeg', 'image/png', 'image/webp')),
  bytes bytea not null,
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 5242880),
  sha256 text not null,
  created_at timestamptz not null default now(),
  check ((org_id is null) = (complaint_id is null)),
  foreign key (org_id, complaint_id) references complaints(org_id, id) on delete cascade
);
create index complaint_photos_complaint on complaint_photos (complaint_id);

alter table complaint_photos enable row level security;
alter table complaint_photos force row level security;
create policy tenant_isolation on complaint_photos
  using (app_is_system() or (org_id is not null and org_id = any(app_org_ids())))
  with check (app_is_system() or (org_id is not null and org_id = any(app_org_ids())));
grant select, insert, update, delete on complaint_photos to vimba_app;
