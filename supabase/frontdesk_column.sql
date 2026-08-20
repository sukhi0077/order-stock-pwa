-- =============================================================================
-- FRONT DESK — a flag on the employee, not a table
--
-- HOW TO APPLY
--   Supabase Dashboard -> SQL Editor -> paste this whole file -> Run.
--   Idempotent (safe to re-run). Run AFTER dsr_schema.sql (which creates
--   public.employees).
--
-- The front desk is a subset of staff who must cover the desk. It is one bit
-- per person, so it lives as a column on employees rather than its own table.
-- Writes go through the same admin-only RLS that already guards employees.
-- =============================================================================

alter table public.employees
  add column if not exists is_frontdesk boolean not null default false;

notify pgrst, 'reload schema';
