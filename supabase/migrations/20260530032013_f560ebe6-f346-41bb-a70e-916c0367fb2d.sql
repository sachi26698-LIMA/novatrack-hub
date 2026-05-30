
-- ENUMS
create type public.worker_status as enum ('Active','OnLeave','Inactive');
create type public.attendance_status as enum ('CheckedIn','CheckedOut');
create type public.project_status as enum ('Planning','Active','OnHold','Completed','Cancelled');
create type public.payroll_status as enum ('Draft','Approved','Paid');

-- WORKERS
create table public.workers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  full_name text not null,
  email text,
  phone text,
  role text,
  department text,
  hourly_rate numeric(10,2) not null default 0,
  monthly_salary numeric(12,2) not null default 0,
  avatar_url text,
  status public.worker_status not null default 'Active',
  joined_at date not null default current_date,
  qr_code text unique not null default encode(gen_random_bytes(12), 'hex'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.workers to authenticated;
grant all on public.workers to service_role;
alter table public.workers enable row level security;
create policy "Workers: owner select" on public.workers for select to authenticated using (owner_id = auth.uid() or public.has_role(auth.uid(),'Admin'));
create policy "Workers: owner insert" on public.workers for insert to authenticated with check (owner_id = auth.uid());
create policy "Workers: owner update" on public.workers for update to authenticated using (owner_id = auth.uid() or public.has_role(auth.uid(),'Admin'));
create policy "Workers: owner delete" on public.workers for delete to authenticated using (owner_id = auth.uid() or public.has_role(auth.uid(),'Admin'));
create trigger trg_workers_updated before update on public.workers for each row execute function public.touch_updated_at();
create index idx_workers_owner on public.workers(owner_id);

-- PROJECTS
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  name text not null,
  client text,
  description text,
  status public.project_status not null default 'Planning',
  budget numeric(14,2) not null default 0,
  spent numeric(14,2) not null default 0,
  progress int not null default 0 check (progress between 0 and 100),
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.projects to authenticated;
grant all on public.projects to service_role;
alter table public.projects enable row level security;
create policy "Projects: owner select" on public.projects for select to authenticated using (owner_id = auth.uid() or public.has_role(auth.uid(),'Admin'));
create policy "Projects: owner insert" on public.projects for insert to authenticated with check (owner_id = auth.uid());
create policy "Projects: owner update" on public.projects for update to authenticated using (owner_id = auth.uid() or public.has_role(auth.uid(),'Admin'));
create policy "Projects: owner delete" on public.projects for delete to authenticated using (owner_id = auth.uid() or public.has_role(auth.uid(),'Admin'));
create trigger trg_projects_updated before update on public.projects for each row execute function public.touch_updated_at();
create index idx_projects_owner on public.projects(owner_id);

-- PROJECT ASSIGNMENTS
create table public.project_assignments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  worker_id uuid not null references public.workers(id) on delete cascade,
  owner_id uuid not null,
  created_at timestamptz not null default now(),
  unique(project_id, worker_id)
);
grant select, insert, update, delete on public.project_assignments to authenticated;
grant all on public.project_assignments to service_role;
alter table public.project_assignments enable row level security;
create policy "PA: owner all" on public.project_assignments for all to authenticated using (owner_id = auth.uid() or public.has_role(auth.uid(),'Admin')) with check (owner_id = auth.uid());

-- ATTENDANCE
create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  worker_id uuid not null references public.workers(id) on delete cascade,
  check_in timestamptz not null default now(),
  check_out timestamptz,
  status public.attendance_status not null default 'CheckedIn',
  hours numeric(6,2),
  notes text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.attendance_records to authenticated;
grant all on public.attendance_records to service_role;
alter table public.attendance_records enable row level security;
create policy "Att: owner all" on public.attendance_records for all to authenticated using (owner_id = auth.uid() or public.has_role(auth.uid(),'Admin')) with check (owner_id = auth.uid());
create index idx_att_owner_worker on public.attendance_records(owner_id, worker_id, check_in desc);

-- PAYROLL
create table public.payroll_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  worker_id uuid not null references public.workers(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  base_amount numeric(12,2) not null default 0,
  bonus numeric(12,2) not null default 0,
  deductions numeric(12,2) not null default 0,
  net_amount numeric(12,2) not null default 0,
  hours_worked numeric(8,2) not null default 0,
  status public.payroll_status not null default 'Draft',
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.payroll_records to authenticated;
grant all on public.payroll_records to service_role;
alter table public.payroll_records enable row level security;
create policy "Pay: owner all" on public.payroll_records for all to authenticated using (owner_id = auth.uid() or public.has_role(auth.uid(),'Admin')) with check (owner_id = auth.uid());
create trigger trg_payroll_updated before update on public.payroll_records for each row execute function public.touch_updated_at();
create index idx_payroll_owner_worker on public.payroll_records(owner_id, worker_id);
