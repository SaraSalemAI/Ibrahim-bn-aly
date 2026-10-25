-- Email intake: attachments mailed to tb+<workspace_key>@<inbound domain> are stored here by the
-- /api/intake webhook (service role) and imported from the app by members of that workspace.

create table if not exists intake_files (
  id uuid primary key default gen_random_uuid(),
  workspace_key text not null references workspace_snapshots (workspace_key) on delete cascade,
  sender text,
  subject text,
  file_name text not null,
  content_type text,
  size integer not null check (size >= 0 and size <= 15728640),
  content_base64 text not null,
  received_at timestamptz not null default now(),
  imported_at timestamptz,
  imported_by uuid references auth.users (id)
);

create index if not exists intake_files_pending on intake_files (workspace_key, received_at) where imported_at is null;

alter table intake_files enable row level security;

-- Members read their workspace's inbox and mark files as imported. Inserts come only from the
-- webhook with the service role, which bypasses row-level security.
drop policy if exists intake_select on intake_files;
create policy intake_select on intake_files for select using (is_snapshot_member(workspace_key));

drop policy if exists intake_mark_imported on intake_files;
create policy intake_mark_imported on intake_files for update using (is_snapshot_member(workspace_key)) with check (is_snapshot_member(workspace_key));

-- Imported files are kept 30 days for the audit trail, then removed (run from pg_cron if available).
create or replace function purge_imported_intake() returns void language sql security definer set search_path = public as $$
  delete from intake_files where imported_at < now() - interval '30 days';
$$;
