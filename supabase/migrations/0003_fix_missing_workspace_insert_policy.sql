-- Fixes: "new row violates row-level security policy for table workspaces"
-- on EVERY insert attempt (including deliberately-wrong test values), which
-- is the signature of a table with RLS enabled but no matching INSERT
-- policy present at all — Postgres denies all rows unconditionally in that
-- case. The workspaces_insert_company policy from 0001_init.sql appears to
-- be missing from the live database. This recreates it idempotently.
--
-- Run this once in the Supabase SQL Editor.

drop policy if exists "workspaces_insert_company" on public.workspaces;
create policy "workspaces_insert_company" on public.workspaces
  for insert with check (owner_id = auth.uid() and type = 'company');

-- Optional sanity check — run this after, to confirm the policy exists:
-- select policyname, cmd, with_check from pg_policies where tablename = 'workspaces';
