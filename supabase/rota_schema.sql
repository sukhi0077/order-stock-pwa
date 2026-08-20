-- =============================================================================
-- ROTA — the schedule the owner plans, on top of availability
--
-- HOW TO APPLY
--   Supabase Dashboard -> SQL Editor -> paste this whole file -> Run.
--   Idempotent (safe to re-run). Run AFTER schema.sql, dsr_schema.sql and
--   timesheet_schema.sql, because it references public.employees and
--   public.is_admin().
--
-- WHAT THIS IS, AND HOW IT DIFFERS FROM AVAILABILITY
--   Availability is what staff SAY they can do. The rota is what the owner
--   DECIDES they will do. They are separate tables on purpose: an availability
--   answer is the employee's, and the owner must never be able to overwrite it;
--   a rota shift is the owner's, and staff only ever read it.
--
--   A rota row existing = "you are scheduled that day". Times are optional — the
--   common case is "assign the day"; a start/end can be added when it matters.
--
--   Unlike availability, WRITES here are admin-only (enforced in RLS via
--   is_admin(), which is a real boundary — the admin logs in as themselves,
--   staff share one device user). Staff can read, so a published rota can be
--   shown on their timesheet; the app hides months that are still a draft.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- A. ROTA_SHIFTS — one row per employee per scheduled day
-- -----------------------------------------------------------------------------
create table if not exists public.rota_shifts (
  employee_id uuid not null references public.employees(id) on delete cascade,
  on_date     date not null,
  -- Optional clock times. Null means "scheduled, times not specified yet".
  -- Clock times, not timestamps, for the same reasons as timesheet_entries.
  start_time  time,
  end_time    time,
  note        text not null default '',
  updated_at  timestamptz not null default now(),
  primary key (employee_id, on_date)
);
create index if not exists rota_shifts_date_idx on public.rota_shifts (on_date);

-- -----------------------------------------------------------------------------
-- B. ROTA_MONTHS — the publish state of a month's rota
--
--    A rota is drafted, then published. Staff see a month only once it is
--    'published'; until then the owner can shuffle shifts without anyone
--    planning their week around a draft. A month with no row is a draft.
-- -----------------------------------------------------------------------------
create table if not exists public.rota_months (
  month_id     text primary key check (month_id ~ '^\d{4}-\d{2}$'),
  status       text not null default 'draft' check (status in ('draft','published')),
  published_at timestamptz,
  updated_at   timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- C. RLS
--
--    Writes are admin-only and that is a genuine control here. Reads are open
--    to any signed-in device so the published rota can appear on the shared
--    staff timesheet; the app is what filters drafts out of the staff view.
-- -----------------------------------------------------------------------------
alter table public.rota_shifts enable row level security;
alter table public.rota_months enable row level security;

drop policy if exists rota_shifts_read on public.rota_shifts;
create policy rota_shifts_read on public.rota_shifts
  for select to authenticated using (true);

drop policy if exists rota_shifts_write on public.rota_shifts;
create policy rota_shifts_write on public.rota_shifts
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists rota_months_read on public.rota_months;
create policy rota_months_read on public.rota_months
  for select to authenticated using (true);

drop policy if exists rota_months_write on public.rota_months;
create policy rota_months_write on public.rota_months
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- =============================================================================
-- RELOAD THE API SCHEMA CACHE
-- =============================================================================
notify pgrst, 'reload schema';
