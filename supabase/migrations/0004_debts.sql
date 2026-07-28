-- Debts feature — tracks money owed by/to the user. Personal workspaces
-- only (never company workspaces), enforced at the RLS level below, not
-- just hidden in the UI.
--
-- Run this once in the Supabase SQL Editor.

create table public.debts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  direction text not null check (direction in ('owed_by_me', 'owed_to_me')),
  person_name text not null,
  currency text not null check (currency in ('USD', 'AED', 'EGP')),
  amount numeric(14, 2) not null check (amount > 0),
  rate_to_base numeric(14, 6) not null,
  amount_base numeric(14, 2) generated always as (amount * rate_to_base) stored,
  due_date date,
  status text not null default 'unpaid' check (status in ('unpaid', 'paid')),
  created_at timestamptz not null default now()
);

create index debts_workspace_id_idx on public.debts (workspace_id);

alter table public.debts enable row level security;

-- Reuses the is_workspace_owner() SECURITY DEFINER helper from migration
-- 0001/0002. This second helper adds the "personal workspace only" rule;
-- SECURITY DEFINER for the same reason as is_workspace_owner — so it can
-- read `workspaces` without re-triggering RLS on it.
create function public.is_personal_workspace(ws_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.workspaces w
    where w.id = ws_id and w.type = 'personal'
  );
$$;

create policy "debts_select_owner" on public.debts
  for select using (
    public.is_workspace_owner(debts.workspace_id)
    and public.is_personal_workspace(debts.workspace_id)
  );

create policy "debts_insert_owner" on public.debts
  for insert with check (
    created_by = auth.uid()
    and public.is_workspace_owner(debts.workspace_id)
    and public.is_personal_workspace(debts.workspace_id)
  );

create policy "debts_update_owner" on public.debts
  for update using (
    public.is_workspace_owner(debts.workspace_id)
    and public.is_personal_workspace(debts.workspace_id)
  ) with check (
    public.is_workspace_owner(debts.workspace_id)
    and public.is_personal_workspace(debts.workspace_id)
  );

create policy "debts_delete_owner" on public.debts
  for delete using (
    public.is_workspace_owner(debts.workspace_id)
    and public.is_personal_workspace(debts.workspace_id)
  );
