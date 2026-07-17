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
  category    text,
  sub_category text,
  unit        text,
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
-- DONE. Next: create staff/admin users under Authentication -> Users, then
-- promote your admin:  update public.profiles set role='admin' where email='...';
-- Sign in as admin in the app and click "Load items" to seed the master list.
-- =============================================================================
