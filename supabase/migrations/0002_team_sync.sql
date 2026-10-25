-- Team sync for the browser app: one row per shared workspace, readable and writable only by its members.
-- Sign-in is Supabase email one-time codes. Saves carry a version so concurrent saves cannot overwrite each other.

create table if not exists workspace_snapshots (
  workspace_key text primary key check (length(workspace_key) between 3 and 80),
  data jsonb not null,
  version integer not null default 1 check (version > 0),
  created_by uuid not null default auth.uid() references auth.users (id),
  updated_email text,
  updated_at timestamptz not null default now()
);

create table if not exists workspace_snapshot_members (
  workspace_key text not null references workspace_snapshots (workspace_key) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'ANALYST' check (role in ('ANALYST', 'REVIEWER', 'CFO')),
  added_at timestamptz not null default now(),
  primary key (workspace_key, user_id)
);

alter table workspace_snapshots enable row level security;
alter table workspace_snapshot_members enable row level security;

create or replace function is_snapshot_member(k text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from workspace_snapshot_members where workspace_key = k and user_id = auth.uid());
$$;

create or replace function snapshot_role(k text) returns text
language sql stable security definer set search_path = public as $$
  select role from workspace_snapshot_members where workspace_key = k and user_id = auth.uid();
$$;

-- The creator becomes the workspace's CFO.
create or replace function add_snapshot_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into workspace_snapshot_members (workspace_key, user_id, role) values (new.workspace_key, auth.uid(), 'CFO');
  return new;
end $$;

drop trigger if exists snapshot_owner on workspace_snapshots;
create trigger snapshot_owner after insert on workspace_snapshots for each row execute function add_snapshot_owner();

-- A save must move the version forward by exactly one.
create or replace function check_snapshot_version() returns trigger
language plpgsql as $$
begin
  if new.version <> old.version + 1 then
    raise exception 'stale version: expected %, got %', old.version + 1, new.version;
  end if;
  new.created_by := old.created_by;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists snapshot_version on workspace_snapshots;
create trigger snapshot_version before update on workspace_snapshots for each row execute function check_snapshot_version();

create policy snapshots_read on workspace_snapshots for select using (is_snapshot_member(workspace_key));
create policy snapshots_create on workspace_snapshots for insert with check (auth.uid() is not null and created_by = auth.uid());
create policy snapshots_write on workspace_snapshots for update using (is_snapshot_member(workspace_key)) with check (is_snapshot_member(workspace_key));
create policy snapshot_members_read on workspace_snapshot_members for select using (is_snapshot_member(workspace_key));

-- Only the workspace's CFO can add members, by email of an existing Supabase user.
create or replace function add_workspace_member(p_workspace_key text, p_email text, p_role text default 'ANALYST') returns void
language plpgsql security definer set search_path = public, auth as $$
declare
  uid uuid;
begin
  if snapshot_role(p_workspace_key) is distinct from 'CFO' then
    raise exception 'only the CFO of this workspace can add members';
  end if;
  select id into uid from auth.users where lower(email) = lower(p_email);
  if uid is null then
    raise exception 'no user with that email: ask them to sign in to the app once first';
  end if;
  insert into workspace_snapshot_members (workspace_key, user_id, role) values (p_workspace_key, uid, p_role)
  on conflict (workspace_key, user_id) do update set role = excluded.role;
end $$;

create or replace function list_workspace_members(p_workspace_key text) returns table (email text, role text)
language sql stable security definer set search_path = public, auth as $$
  select u.email::text, m.role from workspace_snapshot_members m join auth.users u on u.id = m.user_id
  where m.workspace_key = p_workspace_key and is_snapshot_member(p_workspace_key)
  order by m.added_at;
$$;

grant execute on function add_workspace_member(text, text, text) to authenticated;
grant execute on function list_workspace_members(text) to authenticated;
