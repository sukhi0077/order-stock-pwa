-- =============================================================================
-- TIMESHEET — hours worked and future availability
--
-- HOW TO APPLY
--   Supabase Dashboard -> SQL Editor -> paste this whole file -> Run.
--   Idempotent (safe to re-run). Run AFTER schema.sql and dsr_schema.sql,
--   because it extends public.employees, which dsr_schema.sql creates.
--
-- IDENTITY, AND WHAT THE PIN IS AND IS NOT
--   Staff share one Supabase login on a shared device; identity is chosen from
--   a dropdown. The PIN added here stops one employee casually clocking hours
--   against another's name. It is NOT a security boundary: RLS cannot tell two
--   employees apart when they authenticate as the same database user, so any
--   signed-in staff device can still write timesheet rows. Treat the PIN as a
--   deterrent and the admin's review as the control. Individual logins are the
--   only way to make this enforceable, and that is a deliberate trade the owner
--   made against the cost of running an account per employee.
-- =============================================================================

-- crypt() / gen_salt() for the PIN hash.
--
-- WHERE pgcrypto LIVES MATTERS. Supabase ships it in the `extensions` schema,
-- not `public`. `create extension if not exists` then does nothing — it is
-- already installed — so it stays there, and a function declared
-- `set search_path = public` cannot see it:
--
--     ERROR: function gen_salt(unknown) does not exist
--
-- Hence `public, extensions` on every function below that hashes or checks a
-- PIN. Both are listed because a database where pgcrypto was installed into
-- public (an older project, or a plain Postgres) has to keep working too.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- A. EMPLOYEES gain a PIN
--    Stored as a bcrypt hash, never in the clear — a 4-digit PIN is guessable
--    enough without also being readable by anyone who can see the table.
-- -----------------------------------------------------------------------------
alter table public.employees add column if not exists pin_hash text;

-- Set or clear an employee's PIN. Admin only, and the plaintext never lands in
-- a column: it is hashed inside the function.
create or replace function public.set_employee_pin(p_employee_id uuid, p_pin text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.is_admin() then
    raise exception 'only an admin may set a PIN';
  end if;
  if p_pin is null or btrim(p_pin) = '' then
    update public.employees set pin_hash = null, updated_at = now()
      where id = p_employee_id;
    return;
  end if;
  if p_pin !~ '^[0-9]{4,8}$' then
    raise exception 'PIN must be 4 to 8 digits';
  end if;
  update public.employees
    set pin_hash = crypt(p_pin, gen_salt('bf')), updated_at = now()
    where id = p_employee_id;
end;
$$;
grant execute on function public.set_employee_pin(uuid, text) to authenticated;

-- Check a PIN. Returns true/false rather than the hash, so the hash never
-- reaches the client. An employee with no PIN set returns true — otherwise
-- adding the feature would lock out everyone until every PIN was issued.
create or replace function public.verify_employee_pin(p_employee_id uuid, p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
begin
  select pin_hash into v_hash from public.employees where id = p_employee_id;
  if v_hash is null then
    return true;
  end if;
  return v_hash = crypt(coalesce(p_pin, ''), v_hash);
end;
$$;
grant execute on function public.verify_employee_pin(uuid, text) to authenticated;

-- Has this person set a PIN yet? A boolean only — never the hash, and never
-- anything about what the PIN is. The timesheet asks this to decide whether to
-- show "enter your PIN" or "choose one".
--
-- Null for an id that does not exist, so a caller cannot use this to probe for
-- valid employee ids by watching for true/false.
create or replace function public.employee_has_pin(p_employee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select pin_hash is not null from public.employees where id = p_employee_id;
$$;
grant execute on function public.employee_has_pin(uuid) to authenticated;

-- First-time claim: a person sets their OWN PIN, without needing an admin.
--
-- Deliberately NOT an update. It writes only where pin_hash is null, so it can
-- create a PIN but never change or overwrite one. Without that condition any
-- staff device could reset a colleague's PIN and then clock hours as them —
-- which is the one thing the PIN exists to stop.
--
-- Returns true if the claim took, false if a PIN was already there. The caller
-- shows "that name already has a PIN" and asks for it instead.
create or replace function public.claim_employee_pin(p_employee_id uuid, p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_rows int;
begin
  if p_pin is null or p_pin !~ '^[0-9]{4,8}$' then
    raise exception 'PIN must be 4 to 8 digits';
  end if;

  update public.employees
     set pin_hash = crypt(p_pin, gen_salt('bf')), updated_at = now()
   where id = p_employee_id
     and pin_hash is null
     and active;                      -- a removed name cannot be claimed

  get diagnostics v_rows = row_count;
  return v_rows = 1;
end;
$$;
grant execute on function public.claim_employee_pin(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- B. TIMESHEET_ENTRIES  (one row per worked stretch)
--
--    NOT one row per day: split shifts are normal in a restaurant — on at
--    11:00, off at 15:00, back at 18:00. Forcing one row per day would make
--    those unrecordable, so the day's total is the sum of its rows.
-- -----------------------------------------------------------------------------
create table if not exists public.timesheet_entries (
  id            uuid primary key default gen_random_uuid(),
  employee_id   uuid not null references public.employees(id) on delete restrict,
  work_date     date not null,
  -- Clock times, not timestamps. The shift is "17:00 to 01:00 on the 14th",
  -- and storing it that way keeps it readable and immune to the timezone and
  -- DST problems a timestamptz pair would introduce for a Warsaw kitchen.
  start_time    time not null,
  end_time      time not null,
  -- Unpaid break, subtracted from the total.
  break_minutes int not null default 0 check (break_minutes >= 0 and break_minutes < 1440),
  note          text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz,
  -- Which device/account wrote it. Not who worked it — employee_id is that.
  created_by    uuid references auth.users(id) on delete set null
);
create index if not exists ts_entries_emp_date_idx
  on public.timesheet_entries (employee_id, work_date desc);
create index if not exists ts_entries_date_idx on public.timesheet_entries (work_date desc);

-- No future-dated work, with a one-day cushion for the Warsaw/UTC boundary and
-- for a night shift being written up after midnight.
alter table public.timesheet_entries drop constraint if exists ts_entries_not_future;
alter table public.timesheet_entries add constraint ts_entries_not_future
  check (work_date <= (now() at time zone 'Europe/Warsaw')::date + 1);

-- -----------------------------------------------------------------------------
-- C. AVAILABILITY — a weekly pattern plus per-date exceptions
--
--    The pattern is what someone can normally do; the exceptions are the real
--    life on top of it. Reading availability for a date means: take the
--    exception if there is one, otherwise fall back to the weekday pattern.
-- -----------------------------------------------------------------------------
create table if not exists public.employee_availability_weekly (
  employee_id uuid not null references public.employees(id) on delete cascade,
  -- 0 = Monday ... 6 = Sunday. ISO order, because the rota is read Mon-first.
  weekday     int  not null check (weekday between 0 and 6),
  available   boolean not null default true,
  from_time   time,
  to_time     time,
  updated_at  timestamptz not null default now(),
  primary key (employee_id, weekday)
);

create table if not exists public.employee_availability_dates (
  employee_id uuid not null references public.employees(id) on delete cascade,
  on_date     date not null,
  available   boolean not null default true,
  from_time   time,
  to_time     time,
  note        text not null default '',
  updated_at  timestamptz not null default now(),
  primary key (employee_id, on_date)
);
create index if not exists emp_avail_dates_date_idx
  on public.employee_availability_dates (on_date);

-- -----------------------------------------------------------------------------
-- D. RLS
--
--    Every signed-in device can read and write these, because every staff
--    device authenticates as the same user — see the note at the top. Deletes
--    and edits of anything older than the recent past are admin-only, so a
--    finished month cannot be quietly rewritten from the floor.
-- -----------------------------------------------------------------------------
alter table public.timesheet_entries            enable row level security;
alter table public.employee_availability_weekly enable row level security;
alter table public.employee_availability_dates  enable row level security;

-- How far back staff may still correct their own hours. Beyond this an admin
-- has to do it, which is the point at which payroll has probably been run.
create or replace function public.ts_is_recent(d date)
returns boolean
language sql
stable
as $$
  select d >= (now() at time zone 'Europe/Warsaw')::date - 7;
$$;

drop policy if exists ts_entries_read on public.timesheet_entries;
create policy ts_entries_read on public.timesheet_entries
  for select to authenticated using (true);

drop policy if exists ts_entries_write on public.timesheet_entries;
create policy ts_entries_write on public.timesheet_entries
  for insert to authenticated with check (public.is_admin() or public.ts_is_recent(work_date));

drop policy if exists ts_entries_update on public.timesheet_entries;
create policy ts_entries_update on public.timesheet_entries
  for update to authenticated
  using (public.is_admin() or public.ts_is_recent(work_date))
  with check (public.is_admin() or public.ts_is_recent(work_date));

drop policy if exists ts_entries_delete on public.timesheet_entries;
create policy ts_entries_delete on public.timesheet_entries
  for delete to authenticated using (public.is_admin() or public.ts_is_recent(work_date));

-- Availability is about the future and is harmless to edit; no date window.
drop policy if exists emp_avail_weekly_all on public.employee_availability_weekly;
create policy emp_avail_weekly_all on public.employee_availability_weekly
  for all to authenticated using (true) with check (true);

drop policy if exists emp_avail_dates_all on public.employee_availability_dates;
create policy emp_avail_dates_all on public.employee_availability_dates
  for all to authenticated using (true) with check (true);

-- -----------------------------------------------------------------------------
-- E. MONTHLY SUMMARY VIEW
--
--    The minutes maths lives here as well as in the client so a report can be
--    pulled straight from SQL. An end before a start means the shift crossed
--    midnight, so a day is added before subtracting.
-- -----------------------------------------------------------------------------
create or replace view public.v_timesheet_minutes as
select
  e.id            as employee_id,
  e.name          as employee_name,
  t.id            as entry_id,
  t.work_date,
  to_char(t.work_date, 'YYYY-MM') as month_key,
  t.start_time,
  t.end_time,
  t.break_minutes,
  t.note,
  greatest(
    0,
    (extract(epoch from (
       case when t.end_time <= t.start_time
            then (t.end_time + interval '1 day') - t.start_time
            else t.end_time - t.start_time
       end
     )) / 60)::int - t.break_minutes
  ) as worked_minutes
from public.timesheet_entries t
join public.employees e on e.id = t.employee_id;

-- =============================================================================
-- RELOAD THE API SCHEMA CACHE
-- PostgREST caches the schema; without this the new tables stay invisible for
-- up to a minute and the app reports "Could not find the table ... in the
-- schema cache" for something that plainly exists.
-- =============================================================================
notify pgrst, 'reload schema';
