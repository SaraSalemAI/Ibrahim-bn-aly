-- AI CFO platform schema (build specification Part III) with tenant isolation by workspace.
-- The app currently persists to the browser (IndexedDB). This migration is the backend adapter for a
-- multi-user deployment; apply it with `supabase db push` and wire the store to it before relying on RLS.

create extension if not exists pgcrypto;

create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

create table workspace_members (
  workspace_id uuid references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('ANALYST', 'REVIEWER', 'CFO')),
  primary key (workspace_id, user_id)
);

create or replace function is_member(ws uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from workspace_members m where m.workspace_id = ws and m.user_id = auth.uid());
$$;

create or replace function member_role(ws uuid) returns text
language sql stable security definer set search_path = public as $$
  select role from workspace_members m where m.workspace_id = ws and m.user_id = auth.uid();
$$;

create table companies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  trade_name_en varchar(255) not null,
  trade_name_ar varchar(255),
  legal_entity_type varchar(100) not null,
  tax_registration_number varchar(50) check (tax_registration_number is null or tax_registration_number ~ '^\d{9}$'),
  commercial_registry_number varchar(50),
  industry_sector varchar(100) not null default '',
  functional_currency varchar(3) default 'EGP',
  presentation_currency varchar(3) default 'EGP',
  reporting_framework varchar(20) default 'EAS' check (reporting_framework in ('EAS', 'IFRS')),
  fiscal_year_end varchar(5) default '12-31',
  cash_flow_method_default varchar(20) default 'INDIRECT',
  -- module inputs (model drivers, scenarios, tax, valuation, stress, budgets, disclosures) as versioned JSON
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table canonical_chart_of_accounts (
  id uuid primary key default gen_random_uuid(),
  account_code varchar(50) not null unique,
  name_en varchar(255) not null,
  name_ar varchar(255) not null,
  financial_statement varchar(50) not null,
  category varchar(100) not null,
  subcategory varchar(100) not null,
  normal_balance varchar(6) not null check (normal_balance in ('DEBIT', 'CREDIT')),
  eas_standard_ref varchar(50),
  ifrs_standard_ref varchar(50),
  display_order int not null
);

create table financial_periods (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  period_label varchar(50) not null,
  start_date date not null,
  end_date date not null,
  status varchar(30) default 'DRAFT' check (status in ('DRAFT', 'MAPPED', 'RECONCILED', 'LOCKED')),
  locked_at timestamptz,
  locked_by uuid,
  created_at timestamptz default now()
);

create table source_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  period_id uuid references financial_periods(id),
  file_name varchar(255) not null,
  file_hash_sha256 varchar(64) not null,
  document_category varchar(50) not null,
  row_count int default 0,
  parsed_metadata jsonb default '{}'::jsonb,
  uploaded_at timestamptz default now()
);

create table trial_balance_records (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  period_id uuid references financial_periods(id) on delete cascade,
  source_doc_id uuid references source_documents(id) on delete cascade,
  source_account_code varchar(100) not null,
  source_account_name varchar(255) not null,
  canonical_category varchar(50),
  currency varchar(3),
  opening_debit numeric(18, 4) default 0,
  opening_credit numeric(18, 4) default 0,
  period_debit numeric(18, 4) default 0,
  period_credit numeric(18, 4) default 0,
  closing_debit numeric(18, 4) default 0,
  closing_credit numeric(18, 4) default 0,
  net_ending_balance numeric(18, 4) generated always as (closing_debit - closing_credit) stored,
  mapping_confidence numeric(5, 2),
  is_manual_override boolean default false,
  mapping_status varchar(30) default 'AUTO_SUGGESTED',
  mapping_rule varchar(128),
  raw_row_index int,
  created_at timestamptz default now()
);

create table adjusting_journal_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  period_id uuid references financial_periods(id) on delete cascade,
  kind varchar(10) not null check (kind in ('AJE', 'BRIDGE')),
  reason text not null check (length(reason) > 0),
  standard_reference varchar(100),
  lines jsonb not null,
  created_by uuid not null,
  created_at timestamptz default now()
);

create table subledger_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  period_id uuid references financial_periods(id) on delete cascade,
  source_doc_id uuid references source_documents(id) on delete cascade,
  kind varchar(30) not null check (kind in ('GL', 'AR', 'AP', 'FAR', 'INVENTORY', 'PAYROLL', 'BANK', 'ETA')),
  records jsonb not null,
  created_at timestamptz default now()
);

create table immutable_audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  seq bigint not null,
  user_id uuid not null,
  action_type varchar(100) not null,
  entity_affected varchar(100) not null,
  record_id text,
  reason text,
  before_state jsonb,
  after_state jsonb,
  ip_address inet,
  prev_hash varchar(64) not null,
  hash varchar(64) not null,
  "timestamp" timestamptz default now()
);

-- Audit log is append-only.
create or replace function reject_audit_change() returns trigger language plpgsql as $$
begin
  raise exception 'immutable_audit_logs is append-only';
end $$;
create trigger audit_no_update before update or delete on immutable_audit_logs for each row execute function reject_audit_change();

-- Locked periods reject edits to their trial balance (G-10); AJEs remain insertable.
create or replace function reject_locked_tb() returns trigger language plpgsql as $$
begin
  if exists (select 1 from financial_periods p where p.id = coalesce(new.period_id, old.period_id) and p.status = 'LOCKED') then
    raise exception 'period is locked: post an adjusting journal entry instead';
  end if;
  return coalesce(new, old);
end $$;
create trigger tb_locked before insert or update or delete on trial_balance_records for each row execute function reject_locked_tb();

-- Row-level security: every table is visible only to members of the owning workspace.
alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table companies enable row level security;
alter table financial_periods enable row level security;
alter table source_documents enable row level security;
alter table trial_balance_records enable row level security;
alter table adjusting_journal_entries enable row level security;
alter table subledger_documents enable row level security;
alter table immutable_audit_logs enable row level security;
alter table canonical_chart_of_accounts enable row level security;

create policy ws_read on workspaces for select using (is_member(id));
create policy members_read on workspace_members for select using (is_member(workspace_id));
create policy members_admin on workspace_members for all using (member_role(workspace_id) = 'CFO') with check (member_role(workspace_id) = 'CFO');
create policy coa_read on canonical_chart_of_accounts for select using (auth.role() = 'authenticated');
create policy companies_rw on companies for all using (is_member(workspace_id)) with check (is_member(workspace_id));

create or replace function company_workspace(c uuid) returns uuid language sql stable security definer set search_path = public as $$
  select workspace_id from companies where id = c;
$$;

create policy periods_read on financial_periods for select using (is_member(company_workspace(company_id)));
create policy periods_write on financial_periods for insert with check (is_member(company_workspace(company_id)));
-- Only a CFO can change period status (lock / reopen).
create policy periods_update on financial_periods for update using (member_role(company_workspace(company_id)) = 'CFO');
create policy docs_rw on source_documents for all using (is_member(company_workspace(company_id))) with check (is_member(company_workspace(company_id)));
create policy tb_rw on trial_balance_records for all using (is_member(company_workspace(company_id))) with check (is_member(company_workspace(company_id)));
create policy aje_read on adjusting_journal_entries for select using (is_member(company_workspace(company_id)));
create policy aje_insert on adjusting_journal_entries for insert with check (is_member(company_workspace(company_id)) and created_by = auth.uid());
create policy sl_rw on subledger_documents for all using (is_member(company_workspace(company_id))) with check (is_member(company_workspace(company_id)));
create policy audit_read on immutable_audit_logs for select using (is_member(company_workspace(company_id)));
create policy audit_insert on immutable_audit_logs for insert with check (is_member(company_workspace(company_id)) and user_id = auth.uid());

create index on trial_balance_records (company_id, period_id);
create index on immutable_audit_logs (company_id, seq);
create index on subledger_documents (company_id, kind);
