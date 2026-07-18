-- =============================================================================
-- Order & Stock PWA — Supabase schema + Row-Level Security
--
-- Restaurant stock management: month-end stock counts, purchase orders, and
-- received-stock (expiry) batches. Two roles: EMPLOYEE (staff) and ADMIN.
--
-- HOW TO APPLY
--   Supabase Dashboard -> SQL Editor -> New query -> paste this whole file ->
--   Run.  It is idempotent (safe to re-run).  Re-run after any change.
--
-- SECURITY MODEL (enforced HERE, at the database — never by hiding UI buttons)
--   - Auth: Supabase email/password. Every request must be signed in.
--   - Role lives in public.profiles.role ('staff' | 'admin'). A trigger creates
--     a 'staff' profile automatically on sign-up. Promote someone to admin with:
--         update public.profiles set role = 'admin' where email = 'you@shop.com';
--   - is_admin() is SECURITY DEFINER so RLS policies can call it without
--     recursing into the profiles table's own policies.
-- =============================================================================

-- Needed for gen_random_uuid()
create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- 0. PROFILES  (one row per auth user; holds the role)
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,
  role       text not null default 'staff' check (role in ('staff', 'admin')),
  created_at timestamptz not null default now()
);

-- Auto-create a profile when a new auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'staff')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Helper functions used by policies
-- -----------------------------------------------------------------------------
-- Admin = current user's profile.role = 'admin'. SECURITY DEFINER bypasses RLS
-- on profiles so calling this inside other policies does not recurse.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Is "YYYY-MM" the current month? A +/-1 month cushion covers the timezone
-- boundary so a staff save around month-end is not wrongly rejected.
create or replace function public.is_current_month(m text)
returns boolean
language sql
stable
as $$
  select m in (
    to_char(now(), 'YYYY-MM'),
    to_char(now() + interval '31 days', 'YYYY-MM'),
    to_char(now() - interval '31 days', 'YYYY-MM')
  );
$$;

-- -----------------------------------------------------------------------------
-- 1. SUPPLIERS  (managed by admins; items reference a supplier by name)
-- -----------------------------------------------------------------------------
create table if not exists public.suppliers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 2. ITEMS  (the master item list)
-- -----------------------------------------------------------------------------
create table if not exists public.items (
  id          uuid primary key default gen_random_uuid(),
  code        text,
  name        text not null check (char_length(name) between 1 and 120),
  name_hi     text default '',
  -- category / sub-category / unit are normalised into master tables
  -- (category_id / sub_category_id / unit_id FKs are added in the MASTER DATA
  -- section below). order_unit stays a per-item text preference.
  order_unit  text,
  supplier    text default '',
  sort_order  int  not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz
);
create index if not exists items_sort_idx on public.items (sort_order);
create index if not exists items_name_lower_idx on public.items (lower(name));

-- -----------------------------------------------------------------------------
-- 3. STOCK_COUNTS  (one row per month, id = "YYYY-MM"; lines is itemId->number)
-- -----------------------------------------------------------------------------
create table if not exists public.stock_counts (
  month_id     text primary key check (char_length(month_id) <= 7),
  reporter     text,
  status       text not null default 'draft'
               check (status in ('draft', 'submitted', 'finalized')),
  lines        jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz,
  submitted_at timestamptz,
  finalized_at timestamptz
);

-- -----------------------------------------------------------------------------
-- 4. ORDERS  (running draft built by staff, then submitted; lines itemId->{qty,note})
-- -----------------------------------------------------------------------------
create table if not exists public.orders (
  id           uuid primary key default gen_random_uuid(),
  reporter     text,
  status       text not null default 'draft'
               check (status in ('draft', 'submitted')),
  lines        jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz,
  submitted_at timestamptz
);
create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_created_idx on public.orders (created_at desc);

-- -----------------------------------------------------------------------------
-- 5. RECEIPTS  (received-stock batches with expiry dates; item fields denormalized)
-- -----------------------------------------------------------------------------
create table if not exists public.receipts (
  id           uuid primary key default gen_random_uuid(),
  item_id      text,
  item_name    text,
  unit         text,
  category     text,
  sub_category text,
  qty          numeric not null default 0 check (qty >= 0 and qty <= 1000000),
  expiry       text,     -- 'YYYY-MM-DD'
  reporter     text,
  received_at  timestamptz not null default now()
);
create index if not exists receipts_expiry_idx on public.receipts (expiry);

-- -----------------------------------------------------------------------------
-- 6. APP_META  (one-time seed flag, admin-maintained)
-- -----------------------------------------------------------------------------
create table if not exists public.app_meta (
  key       text primary key,
  done      boolean not null default false,
  seeded_at timestamptz
);

-- =============================================================================
-- ROW-LEVEL SECURITY
-- =============================================================================
alter table public.profiles     enable row level security;
alter table public.suppliers    enable row level security;
alter table public.items        enable row level security;
alter table public.stock_counts enable row level security;
alter table public.orders       enable row level security;
alter table public.receipts     enable row level security;
alter table public.app_meta     enable row level security;

-- ---- PROFILES ---------------------------------------------------------------
-- A user may read their own row; admins may read all. Only admins change roles.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---- SUPPLIERS --------------------------------------------------------------
drop policy if exists suppliers_read on public.suppliers;
create policy suppliers_read on public.suppliers
  for select to authenticated using (true);

drop policy if exists suppliers_admin_write on public.suppliers;
create policy suppliers_admin_write on public.suppliers
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---- ITEMS ------------------------------------------------------------------
-- Any signed-in user may READ; only admins may INSERT/UPDATE. No deletes.
drop policy if exists items_read on public.items;
create policy items_read on public.items
  for select to authenticated using (true);

drop policy if exists items_admin_insert on public.items;
create policy items_admin_insert on public.items
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists items_admin_update on public.items;
create policy items_admin_update on public.items
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---- STOCK_COUNTS -----------------------------------------------------------
-- READ: any signed-in user (staff need previous month's closing to carry over).
-- WRITE: admins any month (incl. finalize/reopen); staff only the CURRENT month
--        and only while NOT finalized, and may never set 'finalized'. No deletes,
--        no future months (is_current_month only admits current/prev/next).
drop policy if exists counts_read on public.stock_counts;
create policy counts_read on public.stock_counts
  for select to authenticated using (true);

drop policy if exists counts_insert on public.stock_counts;
create policy counts_insert on public.stock_counts
  for insert to authenticated
  with check (
    public.is_admin()
    or (public.is_current_month(month_id) and status <> 'finalized')
  );

drop policy if exists counts_update on public.stock_counts;
create policy counts_update on public.stock_counts
  for update to authenticated
  using (
    public.is_admin()
    or (public.is_current_month(month_id) and status <> 'finalized')
  )
  with check (
    public.is_admin()
    or (public.is_current_month(month_id) and status <> 'finalized')
  );

-- ---- ORDERS -----------------------------------------------------------------
-- READ: any signed-in user. CREATE: any signed-in user (draft or submitted).
-- UPDATE: admins anything; staff only while the EXISTING order is still a draft
--         (keep editing, or move draft -> submitted). No deletes.
drop policy if exists orders_read on public.orders;
create policy orders_read on public.orders
  for select to authenticated using (true);

drop policy if exists orders_insert on public.orders;
create policy orders_insert on public.orders
  for insert to authenticated
  with check (status in ('draft', 'submitted'));

drop policy if exists orders_update on public.orders;
create policy orders_update on public.orders
  for update to authenticated
  using (public.is_admin() or status = 'draft')
  with check (status in ('draft', 'submitted'));

-- ---- RECEIPTS ---------------------------------------------------------------
-- Operational log: any signed-in user may add / edit / remove a batch.
drop policy if exists receipts_read on public.receipts;
create policy receipts_read on public.receipts
  for select to authenticated using (true);

drop policy if exists receipts_write on public.receipts;
create policy receipts_write on public.receipts
  for all to authenticated
  using (true)
  with check (true);

-- ---- APP_META ---------------------------------------------------------------
drop policy if exists app_meta_read on public.app_meta;
create policy app_meta_read on public.app_meta
  for select to authenticated using (true);

drop policy if exists app_meta_admin_write on public.app_meta;
create policy app_meta_admin_write on public.app_meta
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- =============================================================================
-- MASTER DATA TABLES (categories, sub_categories, units)
--
-- The three reference dimensions are real tables (mirroring SupplyTracker's
-- Category / SubCategory / UnitOfMeasure), with foreign keys on `items`.
--
-- Category / sub-category are the SOURCE OF TRUTH here: the app reads them by
-- joining these tables and writes items.category_id / sub_category_id — the old
-- text columns on `items` are migrated into these tables and then DROPPED below.
-- `unit` remains a text column and is linked to units.unit_id by a trigger.
--
-- Idempotent — safe to run and re-run on the live DB. The migrate-and-drop step
-- only acts while the old text columns still exist, so re-runs are no-ops.
-- =============================================================================

create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  sort_order int  not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.sub_categories (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete restrict,
  name        text not null,
  sort_order  int  not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (category_id, name)
);

create table if not exists public.units (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,           -- the app's unit string; maps to SupplyTracker UnitOfMeasure.code
  name       text not null default '',
  dimension  text not null default 'count'
             check (dimension in ('mass', 'volume', 'count', 'length', 'time')),
  created_at timestamptz not null default now()
);

-- FK columns on items. Category / sub-category / unit all live ONLY here now —
-- the corresponding text columns are migrated into the master tables + dropped below.
alter table public.items add column if not exists category_id     uuid references public.categories(id);
alter table public.items add column if not exists sub_category_id uuid references public.sub_categories(id);
alter table public.items add column if not exists unit_id         uuid references public.units(id);
create index if not exists items_category_id_idx     on public.items (category_id);
create index if not exists items_sub_category_id_idx on public.items (sub_category_id);
create index if not exists items_unit_id_idx         on public.items (unit_id);

-- The app now sets category_id / sub_category_id / unit_id directly, so the old
-- text-deriving trigger is no longer needed.
drop trigger if exists items_link_masters_trg on public.items;
drop function if exists public.items_link_masters();

-- Migrate category / sub_category / unit TEXT -> master tables + FKs, then DROP
-- the text columns. Each guard runs only while its column still exists;
-- idempotent + self-healing (fills the master tables from the text, sets the
-- FKs, then removes the text so these dimensions live only in the master tables).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'items' and column_name = 'category'
  ) then
    execute $mig$
      insert into public.categories(name)
        select distinct btrim(category) from public.items
        where category is not null and btrim(category) <> ''
        on conflict (name) do nothing
    $mig$;
    execute $mig$
      insert into public.sub_categories(category_id, name)
        select distinct c.id, btrim(i.sub_category)
        from public.items i
        join public.categories c on c.name = btrim(i.category)
        where i.sub_category is not null and btrim(i.sub_category) <> ''
        on conflict (category_id, name) do nothing
    $mig$;
    execute $mig$
      update public.items i set category_id = c.id
        from public.categories c
        where c.name = btrim(i.category) and i.category_id is distinct from c.id
    $mig$;
    execute $mig$
      update public.items i set sub_category_id = s.id
        from public.sub_categories s
        join public.categories c on c.id = s.category_id
        where c.name = btrim(i.category) and s.name = btrim(i.sub_category)
          and i.sub_category_id is distinct from s.id
    $mig$;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'items' and column_name = 'unit'
  ) then
    execute $mig$
      insert into public.units(code)
        select distinct btrim(unit) from public.items
        where unit is not null and btrim(unit) <> ''
        on conflict (code) do nothing
    $mig$;
    execute $mig$
      update public.items i set unit_id = u.id
        from public.units u
        where u.code = btrim(i.unit) and i.unit_id is distinct from u.id
    $mig$;
  end if;
end $$;

-- The merge views (rebuilt in the MERGE-READINESS section below) reference item
-- columns, so drop them first — otherwise Postgres blocks the column drops with
-- a dependency error. They are recreated against the master tables afterwards.
drop view if exists public.merge_stock_movements;
drop view if exists public.merge_order_lines;
drop view if exists public.merge_receipts;

alter table public.items drop column if exists category;
alter table public.items drop column if exists sub_category;
alter table public.items drop column if exists unit;

-- Give master rows a display order derived from the seed's item ordering.
update public.categories c set sort_order = t.mn
  from (select category_id, min(sort_order) mn from public.items
        where category_id is not null group by category_id) t
  where t.category_id = c.id;
update public.sub_categories s set sort_order = t.mn
  from (select sub_category_id, min(sort_order) mn from public.items
        where sub_category_id is not null group by sub_category_id) t
  where t.sub_category_id = s.id;

-- RLS: any signed-in user reads; only admins manage master data directly.
alter table public.categories     enable row level security;
alter table public.sub_categories enable row level security;
alter table public.units          enable row level security;

drop policy if exists categories_read on public.categories;
create policy categories_read on public.categories
  for select to authenticated using (true);
drop policy if exists categories_admin_write on public.categories;
create policy categories_admin_write on public.categories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists sub_categories_read on public.sub_categories;
create policy sub_categories_read on public.sub_categories
  for select to authenticated using (true);
drop policy if exists sub_categories_admin_write on public.sub_categories;
create policy sub_categories_admin_write on public.sub_categories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists units_read on public.units;
create policy units_read on public.units
  for select to authenticated using (true);
drop policy if exists units_admin_write on public.units;
create policy units_admin_write on public.units
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- =============================================================================
-- MERGE-READINESS (for a future merge with SupplyTracker)
--
-- SupplyTracker (Django/Postgres) is the system of record for the CATALOGUE and
-- INVENTORY. This capture app feeds it three things: month-end closing counts,
-- purchase orders, and received-stock batches. Both apps were seeded from the
-- same items sheet, so the natural join key across them is  items.code
-- (ITM-#### in both). See supabase/MERGE.md for the full plan.
--
-- Everything below is ADDITIVE and IDEMPOTENT — safe to run on the live DB and
-- safe to re-run. It changes nothing about how the app reads or writes; it only
-- (a) guarantees a stable, unique item code, (b) adds a few reconciliation
-- columns, and (c) adds read-only VIEWS that project the JSONB capture into the
-- relational shape SupplyTracker expects.
-- =============================================================================

-- ---- Items: stable cross-app identity + reconciliation fields ---------------
-- Canonical unit code (SupplyTracker UnitOfMeasure.code, e.g. kg/ml/btl); the
-- existing `unit` column stays a human display label.
alter table public.items add column if not exists uom_code       text;
alter table public.items add column if not exists vat_rate       numeric(5,2) default 23.00;
alter table public.items add column if not exists match_keywords text not null default '';

-- Every item needs a stable, unique code so it maps 1:1 to a SupplyTracker item.
-- Seeded items already carry ITM-#### codes; app-added items get an OSP-#####
-- code automatically (distinct prefix marks app-origin and avoids collisions).
create sequence if not exists public.items_code_seq;

create or replace function public.items_set_code()
returns trigger
language plpgsql
as $$
begin
  if new.code is null or btrim(new.code) = '' then
    new.code := 'OSP-' || lpad(nextval('public.items_code_seq')::text, 5, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists items_set_code_trg on public.items;
create trigger items_set_code_trg
  before insert on public.items
  for each row execute function public.items_set_code();

-- Backfill any existing rows that have no code (added before this section).
update public.items
  set code = 'OSP-' || lpad(nextval('public.items_code_seq')::text, 5, '0')
  where code is null or btrim(code) = '';

-- code is THE merge key -> unique.
create unique index if not exists items_code_uq on public.items (code);

-- SupplyTracker also keys items on a unique name. Add the same constraint, but
-- only if the live data has no duplicate names, so re-running never hard-fails.
do $$
begin
  if exists (
    select 1 from public.items group by lower(name) having count(*) > 1
  ) then
    raise notice 'items: duplicate names present — resolve them, then re-run to add items_name_lower_uq.';
  else
    create unique index if not exists items_name_lower_uq on public.items (lower(name));
  end if;
end $$;

-- ---- Suppliers: reconcile to SupplyTracker.Supplier ------------------------
alter table public.suppliers add column if not exists nip       text; -- tax id (strong supplier key)
alter table public.suppliers add column if not exists ksef_name text; -- full legal name as on invoices

-- ---- Merge views: capture data in SupplyTracker's shape --------------------
-- Month-end closing counts -> one row per item per month, matching a
-- StockMovement(kind='count', happened_at = last day of the month).
create or replace view public.merge_stock_movements as
select
  sc.month_id,
  (to_date(sc.month_id || '-01', 'YYYY-MM-DD') + interval '1 month' - interval '1 day')::date
                                        as happened_at,
  it.code                              as item_code,
  it.name                              as item_name,
  coalesce(it.uom_code, u.code)        as uom,
  (line.value)::numeric                as closing_qty,
  'count'::text                        as kind,
  sc.status,
  sc.reporter
from public.stock_counts sc
cross join lateral jsonb_each_text(sc.lines) as line(item_id, value)
left join public.items it on it.id::text = line.item_id
left join public.units u on u.id = it.unit_id;

-- Order lines -> reorder signal (item, quantity, note).
create or replace view public.merge_order_lines as
select
  o.id                                 as order_id,
  o.status,
  o.created_at,
  o.submitted_at,
  o.reporter,
  it.code                              as item_code,
  it.name                              as item_name,
  (line.value ->> 'qty')::numeric      as qty,
  line.value ->> 'note'                as note
from public.orders o
cross join lateral jsonb_each(o.lines) as line(item_id, value)
left join public.items it on it.id::text = line.item_id;

-- Received batches -> StockMovement(kind='purchase_in') + expiry (batch/expiry
-- tracking, which SupplyTracker does not capture natively).
create or replace view public.merge_receipts as
select
  r.id,
  r.received_at,
  r.expiry,
  it.code                              as item_code,
  coalesce(it.name, r.item_name)       as item_name,
  r.qty,
  coalesce(it.uom_code, r.unit)        as uom,
  'purchase_in'::text                  as kind,
  r.reporter
from public.receipts r
left join public.items it on it.id::text = r.item_id;

-- Views honour the underlying tables' RLS (Postgres 15+) and are readable by
-- any signed-in user.
alter view public.merge_stock_movements set (security_invoker = on);
alter view public.merge_order_lines     set (security_invoker = on);
alter view public.merge_receipts        set (security_invoker = on);
grant select on public.merge_stock_movements to authenticated;
grant select on public.merge_order_lines     to authenticated;
grant select on public.merge_receipts        to authenticated;

-- =============================================================================
-- DONE. Next: create staff/admin users under Authentication -> Users, then
-- promote your admin:  update public.profiles set role='admin' where email='...';
-- Sign in as admin in the app and click "Load items" to seed the master list.
-- =============================================================================
