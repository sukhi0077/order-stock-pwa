-- =============================================================================
-- myRestro — Daily Sale Report (DSR) schema   *** PROPOSAL v2 — NOT APPLIED ***
--
-- Ports dsr-pwa (Firestore) into the order-stock-pwa Supabase database, in the
-- same 3NF style as the existing schema. Reuses: profiles, is_admin().
--
-- v2 changes (per review):
--   * ONE report per day — report_date is now the primary key
--   * reporter is an EMPLOYEE (FK), chosen from a dropdown — no more free text
--   * tables renamed daily_report* -> dsr*
--   * coupons given + received merged into a single dsr_coupons table
--   * daily_report_delivery renamed to dsr_platform_delivery
--
-- Firestore -> Postgres mapping
--   daily_reports/{id}                 -> dsr_reports (+ 3 child tables)
--   app_settings/coupon_staff.names[]  -> employees
--   coupon_counts/{reportId}           -> DROPPED, replaced by v_coupon_counts
--   daily_counters/{date}.count        -> DROPPED, one-per-day makes it moot
-- =============================================================================

-- -----------------------------------------------------------------------------
-- A. EMPLOYEES  (shared master table — people, not login accounts)
--
-- Replaces the app_settings/coupon_staff names array. Now serves double duty:
-- it is both the coupon-tracking roster AND the reporter dropdown source.
-- Not every employee has an auth login, hence user_id is nullable.
-- -----------------------------------------------------------------------------
create table if not exists public.employees (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(btrim(name)) > 0),
  user_id    uuid references auth.users (id) on delete set null,
  active     boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create unique index if not exists employees_name_lower_uq on public.employees (lower(name));
create index if not exists employees_active_idx on public.employees (active, sort_order);

-- -----------------------------------------------------------------------------
-- B. DELIVERY_PLATFORMS  (Uber / Bolt / Wolt / Glovo / Pyszne / RePOS)
--
-- Was a hardcoded JS array (DELIVERY_PLATFORMS). As a table, adding a portal is
-- a row insert, not a redeploy — and old reports keep their FK either way.
-- -----------------------------------------------------------------------------
create table if not exists public.delivery_platforms (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  active     boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

insert into public.delivery_platforms (name, sort_order) values
  ('Uber', 1), ('Bolt', 2), ('Wolt', 3),
  ('Glovo', 4), ('Pyszne', 5), ('RePOS', 6)
on conflict (name) do nothing;

-- -----------------------------------------------------------------------------
-- C. DSR_REPORTS  (header — the POS figures + sign-off)
--
-- ONE REPORT PER DAY: report_date IS the primary key. No surrogate uuid — the
-- business day is the natural key, and it makes every child FK self-documenting.
--
-- DERIVED VALUES ARE NOT STORED (3NF). deliveryBreakdownTotal,
-- deliveryOnlineTotal, autoCalculatedCash, cashMismatch, mismatchDiff and
-- onlineSaleMismatch all come back from v_dsr_report_totals below.
-- -----------------------------------------------------------------------------
create table if not exists public.dsr_reports (
  report_date         date primary key,

  -- Card 1: POS figures.  total = online + card + cash (enforced below).
  total_sale_pos      numeric(12,2) not null default 0 check (total_sale_pos  >= 0),
  online_sale_pos     numeric(12,2) not null default 0 check (online_sale_pos >= 0),
  card_sale_pos       numeric(12,2) not null default 0 check (card_sale_pos   >= 0),
  cash_sale_pos       numeric(12,2) not null default 0 check (cash_sale_pos   >= 0),

  -- Yes/No cross-checks. boolean, not the 'Yes'/'No' strings Firestore held.
  is_matching_fiskalne boolean,
  is_matching_ing      boolean,

  -- Card 3: cash box.
  cash_from_yesterday numeric(12,2) not null default 0,
  total_cash_in_box   numeric(12,2) not null default 0 check (total_cash_in_box >= 0),

  -- Card 4: did any customer redeem a discount coupon today?
  received_coupons    boolean,

  comments            text not null default '',

  -- WHO filed it: an employee picked from the dropdown (was free text).
  -- on delete restrict => an employee with reports can never be hard-deleted;
  -- deactivate them instead (employees.active = false) so history survives.
  reporter_id         uuid not null references public.employees(id) on delete restrict,
  -- WHICH LOGIN filed it (audit trail; the staff login is often shared).
  submitted_by        uuid references auth.users (id) on delete set null,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz,

  -- Financial integrity, enforced at the DB (the JS check is UX only).
  constraint dsr_reports_total_matches_parts check (
    abs(total_sale_pos - (online_sale_pos + card_sale_pos + cash_sale_pos)) <= 0.01
  ),
  -- No future-dated reports (+1 day cushion for the Warsaw/UTC boundary).
  constraint dsr_reports_not_future check (report_date <= (current_date + 1))
);
create index if not exists dsr_reports_reporter_idx on public.dsr_reports (reporter_id);
create index if not exists dsr_reports_created_idx  on public.dsr_reports (created_at desc);

-- -----------------------------------------------------------------------------
-- D. DSR_PLATFORM_DELIVERY  (per-portal breakdown; one row per platform)
--     was: report.delivery = { Uber: {online, cash, card}, ... }
-- -----------------------------------------------------------------------------
create table if not exists public.dsr_platform_delivery (
  report_date date not null references public.dsr_reports(report_date)   on delete cascade,
  platform_id uuid not null references public.delivery_platforms(id)     on delete restrict,
  online      numeric(12,2) not null default 0 check (online >= 0),
  cash        numeric(12,2) not null default 0 check (cash   >= 0),
  card        numeric(12,2) not null default 0 check (card   >= 0),
  primary key (report_date, platform_id)
);
create index if not exists dsr_pd_platform_idx on public.dsr_platform_delivery (platform_id);

-- -----------------------------------------------------------------------------
-- E. DSR_CASH_MOVEMENTS  (money out of / into the box)
--     was: report.cashTakenList[] + report.cashAddedList[]
--     One table with a direction flag — same shape, half the code.
-- -----------------------------------------------------------------------------
create table if not exists public.dsr_cash_movements (
  id          uuid primary key default gen_random_uuid(),
  report_date date not null references public.dsr_reports(report_date) on delete cascade,
  direction   text not null check (direction in ('taken', 'added')),
  amount      numeric(12,2) not null check (amount > 0),
  reason      text not null check (char_length(btrim(reason)) > 0),
  -- ORDER KEY, not a time. The form numbers adjustments 1, 2, 3... as they are
  -- added so the merged taken/added list can be shown in entry order without an
  -- impure Date.now() call. It was declared timestamptz, and casting "1" to a
  -- timestamp is what made every save fail with
  --   invalid input syntax for type timestamp with time zone: "1"
  -- `ts` is kept nullable and unused so rows written before the fix still load.
  seq         int,
  ts          timestamptz,
  created_at  timestamptz not null default now()
);
alter table public.dsr_cash_movements add column if not exists seq int;
create index if not exists dsr_cm_report_idx on public.dsr_cash_movements (report_date);

-- -----------------------------------------------------------------------------
-- F. DSR_COUPONS  (ONE table for both directions, split by `kind`)
--
--   kind = 'received' : a customer redeemed a discount coupon.
--                       was report.couponsDetails[] = [{percentage, posOrderNumber}]
--                       -> uses percentage + pos_order_number
--
--   kind = 'given'    : Google-review coupons handed out by a staff member.
--                       was report.couponsGivenCount = "Anna - 4, Marek - 5"
--                       -> uses employee_id + qty
--
-- The two kinds use different columns, so a CHECK constraint enforces that each
-- row fills exactly the right ones and leaves the others null. This keeps the
-- "one coupons table" you asked for without letting nonsense rows in.
-- -----------------------------------------------------------------------------
create table if not exists public.dsr_coupons (
  id               uuid primary key default gen_random_uuid(),
  report_date      date not null references public.dsr_reports(report_date) on delete cascade,
  kind             text not null check (kind in ('received', 'given')),

  -- 'received' columns
  percentage       numeric(5,2) check (percentage > 0 and percentage <= 100),
  pos_order_number text,

  -- 'given' columns
  employee_id      uuid references public.employees(id) on delete restrict,
  qty              integer check (qty > 0),

  created_at       timestamptz not null default now(),

  constraint dsr_coupons_shape check (
    (kind = 'received'
       and percentage  is not null
       and pos_order_number is not null and char_length(btrim(pos_order_number)) > 0
       and employee_id is null and qty is null)
    or
    (kind = 'given'
       and employee_id is not null and qty is not null
       and percentage  is null and pos_order_number is null)
  )
);
create index if not exists dsr_coupons_report_idx   on public.dsr_coupons (report_date, kind);
create index if not exists dsr_coupons_employee_idx on public.dsr_coupons (employee_id) where kind = 'given';
-- One 'given' row per employee per day (the RPC upserts onto this).
create unique index if not exists dsr_coupons_given_uq
  on public.dsr_coupons (report_date, employee_id) where kind = 'given';

-- =============================================================================
-- VIEWS
-- =============================================================================

-- F1. v_coupon_counts — replaces the coupon_counts mirror collection.
-- SECURITY DEFINER (security_invoker = off) ON PURPOSE: it runs with the owner's
-- rights so staff can see a whole month of coupon totals WITHOUT being able to
-- read the financial rows in dsr_reports. It exposes only date + name + qty.
create or replace view public.v_coupon_counts as
select
  c.report_date,
  to_char(c.report_date, 'YYYY-MM') as month_key,
  e.id   as employee_id,
  e.name as employee_name,
  c.qty
from public.dsr_coupons c
join public.employees e on e.id = c.employee_id
where c.kind = 'given';

alter view public.v_coupon_counts set (security_invoker = off);
grant select on public.v_coupon_counts to authenticated;

-- F2. v_dsr_report_totals — the derived figures, computed instead of stored.
create or replace view public.v_dsr_report_totals as
select
  r.report_date,
  coalesce(d.breakdown_total, 0)               as delivery_breakdown_total,
  coalesce(d.online_total, 0)                  as delivery_online_total,
  -- Expected cash = yesterday + cash sale + added - taken.
  -- Delivery cash is already inside cash_sale_pos, so it is NOT added again.
  round(r.cash_from_yesterday + r.cash_sale_pos
        + coalesce(c.added, 0) - coalesce(c.taken, 0), 2) as auto_calculated_cash,
  round(r.total_cash_in_box - (r.cash_from_yesterday + r.cash_sale_pos
        + coalesce(c.added, 0) - coalesce(c.taken, 0)), 2) as mismatch_diff,
  abs(r.total_cash_in_box - (r.cash_from_yesterday + r.cash_sale_pos
        + coalesce(c.added, 0) - coalesce(c.taken, 0))) > 0.01 as cash_mismatch,
  abs(r.online_sale_pos - coalesce(d.online_total, 0)) > 0.01 as online_sale_mismatch
from public.dsr_reports r
left join lateral (
  select sum(online + cash + card) as breakdown_total, sum(online) as online_total
  from public.dsr_platform_delivery where report_date = r.report_date
) d on true
left join lateral (
  select
    sum(amount) filter (where direction = 'added') as added,
    sum(amount) filter (where direction = 'taken') as taken
  from public.dsr_cash_movements where report_date = r.report_date
) c on true;

alter view public.v_dsr_report_totals set (security_invoker = on);
grant select on public.v_dsr_report_totals to authenticated;

-- =============================================================================
-- ROW-LEVEL SECURITY
--
--   employees / delivery_platforms : all read, admin write
--   dsr_reports + children         : STAFF read last 3 days, ADMIN read all
--                                    writes go through save_dsr_report()
--   dsr_coupons kind='given'       : readable by ALL (no financial data) — this
--                                    is what powers the staff monthly total
-- =============================================================================
alter table public.employees             enable row level security;
alter table public.delivery_platforms    enable row level security;
alter table public.dsr_reports           enable row level security;
alter table public.dsr_platform_delivery enable row level security;
alter table public.dsr_cash_movements    enable row level security;
alter table public.dsr_coupons           enable row level security;

-- ---- employees --------------------------------------------------------------
drop policy if exists employees_read on public.employees;
create policy employees_read on public.employees
  for select to authenticated using (true);
drop policy if exists employees_admin_write on public.employees;
create policy employees_admin_write on public.employees
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---- delivery_platforms -----------------------------------------------------
drop policy if exists delivery_platforms_read on public.delivery_platforms;
create policy delivery_platforms_read on public.delivery_platforms
  for select to authenticated using (true);
drop policy if exists delivery_platforms_admin_write on public.delivery_platforms;
create policy delivery_platforms_admin_write on public.delivery_platforms
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---- dsr_reports ------------------------------------------------------------
-- Staff see today + the previous 3 days (they need yesterday's closing cash).
-- Admins see everything. Nobody writes directly — use save_dsr_report().
drop policy if exists dsr_reports_read on public.dsr_reports;
create policy dsr_reports_read on public.dsr_reports
  for select to authenticated
  using (public.is_admin() or report_date >= (current_date - 3));

drop policy if exists dsr_reports_admin_write on public.dsr_reports;
create policy dsr_reports_admin_write on public.dsr_reports
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---- children: inherit the parent's visibility ------------------------------
drop policy if exists dsr_pd_read on public.dsr_platform_delivery;
create policy dsr_pd_read on public.dsr_platform_delivery
  for select to authenticated using (exists (
    select 1 from public.dsr_reports r where r.report_date = report_date));
drop policy if exists dsr_pd_admin_write on public.dsr_platform_delivery;
create policy dsr_pd_admin_write on public.dsr_platform_delivery
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists dsr_cm_read on public.dsr_cash_movements;
create policy dsr_cm_read on public.dsr_cash_movements
  for select to authenticated using (exists (
    select 1 from public.dsr_reports r where r.report_date = report_date));
drop policy if exists dsr_cm_admin_write on public.dsr_cash_movements;
create policy dsr_cm_admin_write on public.dsr_cash_movements
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- dsr_coupons: 'given' rows carry no financial data, so ALL signed-in users may
-- read the whole history (staff monthly running total). 'received' rows are
-- transaction data and follow the parent report's 3-day staff window.
drop policy if exists dsr_coupons_read on public.dsr_coupons;
create policy dsr_coupons_read on public.dsr_coupons
  for select to authenticated
  using (
    kind = 'given'
    or exists (select 1 from public.dsr_reports r where r.report_date = report_date)
  );
drop policy if exists dsr_coupons_admin_write on public.dsr_coupons;
create policy dsr_coupons_admin_write on public.dsr_coupons
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- =============================================================================
-- RPCs
-- =============================================================================

-- G1. save_dsr_report — header + all three child tables in ONE transaction.
-- SECURITY DEFINER, so it enforces the rules the Firestore rules used to:
--   * one report per day (upsert on report_date)
--   * staff may only create/edit TODAY's report; admins any date
--   * nobody may edit a report older than 62 days
--   * no future dates (also a table constraint)
--   * coupons GIVEN may only be edited on the report's own day (canEditCoupons)
create or replace function public.save_dsr_report(
  p_report_date   date,     -- admins may backdate; for staff this is forced to today
  p_header        jsonb,    -- the dsr_reports scalar columns + reporter_id
  p_delivery      jsonb,    -- [{ platform: "Uber", online, cash, card }, ...]
  p_cash          jsonb,    -- [{ direction: "taken"|"added", amount, reason, ts }, ...]
  p_coupons       jsonb     -- [{ kind: "received", percentage, pos_order_number },
                            --  { kind: "given",    employee_id,  qty }, ...]
) returns date
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin boolean := public.is_admin();
  v_today date := (now() at time zone 'Europe/Warsaw')::date;
  v_date  date;
begin
  -- Staff are pinned to today; admins may name any (non-future) date.
  v_date := case when v_admin then coalesce(p_report_date, v_today) else v_today end;

  if v_date > v_today + 1 then
    raise exception 'no future-dated reports';
  end if;
  if v_date < v_today - 62 then
    raise exception 'report % is too old to edit', v_date;
  end if;

  -- One row per day: insert, or update the existing day in place.
  insert into public.dsr_reports as r (
    report_date, total_sale_pos, online_sale_pos, card_sale_pos, cash_sale_pos,
    is_matching_fiskalne, is_matching_ing, cash_from_yesterday, total_cash_in_box,
    received_coupons, comments, reporter_id, submitted_by)
  values (
    v_date,
    (p_header->>'total_sale_pos')::numeric,  (p_header->>'online_sale_pos')::numeric,
    (p_header->>'card_sale_pos')::numeric,   (p_header->>'cash_sale_pos')::numeric,
    (p_header->>'is_matching_fiskalne')::boolean,
    (p_header->>'is_matching_ing')::boolean,
    (p_header->>'cash_from_yesterday')::numeric,
    (p_header->>'total_cash_in_box')::numeric,
    (p_header->>'received_coupons')::boolean,
    coalesce(p_header->>'comments', ''),
    (p_header->>'reporter_id')::uuid,
    auth.uid())
  on conflict (report_date) do update set
    total_sale_pos       = excluded.total_sale_pos,
    online_sale_pos      = excluded.online_sale_pos,
    card_sale_pos        = excluded.card_sale_pos,
    cash_sale_pos        = excluded.cash_sale_pos,
    is_matching_fiskalne = excluded.is_matching_fiskalne,
    is_matching_ing      = excluded.is_matching_ing,
    cash_from_yesterday  = excluded.cash_from_yesterday,
    total_cash_in_box    = excluded.total_cash_in_box,
    received_coupons     = excluded.received_coupons,
    comments             = excluded.comments,
    reporter_id          = excluded.reporter_id,
    submitted_by         = excluded.submitted_by,
    updated_at           = now();

  -- Children are REPLACED wholesale, so a re-save never doubles up.
  delete from public.dsr_platform_delivery where report_date = v_date;
  insert into public.dsr_platform_delivery (report_date, platform_id, online, cash, card)
    select v_date, dp.id,
           coalesce((e->>'online')::numeric, 0),
           coalesce((e->>'cash')::numeric, 0),
           coalesce((e->>'card')::numeric, 0)
    from jsonb_array_elements(coalesce(p_delivery, '[]'::jsonb)) e
    join public.delivery_platforms dp on dp.name = e->>'platform';

  delete from public.dsr_cash_movements where report_date = v_date;
  insert into public.dsr_cash_movements (report_date, direction, amount, reason, seq)
    select v_date, e->>'direction', (e->>'amount')::numeric,
           btrim(e->>'reason'), nullif(e->>'seq', '')::int
    from jsonb_array_elements(coalesce(p_cash, '[]'::jsonb)) e
    where (e->>'amount')::numeric > 0;

  -- Coupons RECEIVED: always replaced along with the report.
  delete from public.dsr_coupons where report_date = v_date and kind = 'received';
  insert into public.dsr_coupons (report_date, kind, percentage, pos_order_number)
    select v_date, 'received', (e->>'percentage')::numeric, btrim(e->>'pos_order_number')
    from jsonb_array_elements(coalesce(p_coupons, '[]'::jsonb)) e
    where e->>'kind' = 'received';

  -- Coupons GIVEN: only editable on the report's own day (canEditCoupons), so
  -- a backdated admin edit can never rewrite who earned which review coupons.
  if v_date = v_today then
    delete from public.dsr_coupons where report_date = v_date and kind = 'given';
    insert into public.dsr_coupons (report_date, kind, employee_id, qty)
      select v_date, 'given', (e->>'employee_id')::uuid, (e->>'qty')::integer
      from jsonb_array_elements(coalesce(p_coupons, '[]'::jsonb)) e
      where e->>'kind' = 'given' and (e->>'qty')::integer > 0;
  end if;

  return v_date;
end;
$$;
grant execute on function public.save_dsr_report(date, jsonb, jsonb, jsonb, jsonb) to authenticated;

-- G2. get_last_closing_cash — yesterday's carry-over without exposing a report.
create or replace function public.get_last_closing_cash()
returns table (report_date date, total_cash_in_box numeric)
language sql
stable
security definer
set search_path = public
as $$
  select r.report_date, r.total_cash_in_box
  from public.dsr_reports r
  order by r.report_date desc
  limit 1;
$$;
grant execute on function public.get_last_closing_cash() to authenticated;

-- =============================================================================
-- NOT INCLUDED (deliberately)
--   * daily_counters       — one-report-per-day makes the 50/day cap moot
--   * coupon_counts mirror — replaced by v_coupon_counts
--   * derived columns      — replaced by v_dsr_report_totals
--   * the `discountCoupons` field — never persisted, only a validation key
--
-- BEFORE THE DATA MIGRATION
--   Seed public.employees with the exact name spellings currently in
--   app_settings/coupon_staff, plus every distinct `reporter` string in the
--   Firestore reports — both have to resolve to an employee row.
-- =============================================================================

-- =============================================================================
-- RELOAD THE API SCHEMA CACHE
-- PostgREST caches the schema, so a table or column added above stays invisible
-- to the app for up to a minute — surfacing as
--   "Could not find the table 'public.x' in the schema cache"
-- even though the object exists. This forces an immediate reload; keep it as
-- the last statement in the file.
-- =============================================================================
notify pgrst, 'reload schema';
