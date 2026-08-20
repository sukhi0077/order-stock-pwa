-- =============================================================================
-- FRONT DESK — the subset of staff who must cover the desk
--
-- HOW TO APPLY
--   Supabase Dashboard -> SQL Editor -> paste this whole file -> Run.
--   Idempotent (safe to re-run). Run AFTER dsr_schema.sql (which creates
--   public.employees) and schema.sql (which defines is_admin()).
--
-- WHY A TABLE AND NOT A COLUMN ON employees
--   A column would ride along on every employees SELECT — the reporter
--   dropdown, the coupon roster, the timesheet — and a not-yet-migrated
--   database would break all of them at once. A separate table keeps the
--   blast radius to this one feature: if the migration has not run, only the
--   front desk highlight is missing, and everything else is untouched.
-- =============================================================================

create table if not exists public.frontdesk_members (
  employee_id uuid primary key references public.employees(id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- Writes are admin-only and that is a real control (the admin logs in as
-- themselves). Reads are open to any signed-in device so the availability and
-- rota screens can compute the "front desk uncovered" flag.
alter table public.frontdesk_members enable row level security;

drop policy if exists frontdesk_read on public.frontdesk_members;
create policy frontdesk_read on public.frontdesk_members
  for select to authenticated using (true);

drop policy if exists frontdesk_write on public.frontdesk_members;
create policy frontdesk_write on public.frontdesk_members
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

notify pgrst, 'reload schema';
