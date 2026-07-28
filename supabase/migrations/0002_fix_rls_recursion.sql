-- Fixes: "infinite recursion detected in policy for relation workspaces" (42P17).
--
-- Cause: workspaces_select checked workspace_members, and
-- workspace_members_select checked workspaces right back — Postgres can't
-- resolve that cycle. Fix: move the cross-table checks into SECURITY
-- DEFINER helper functions. Those run with the function owner's privileges
-- and bypass RLS internally, so calling them doesn't re-trigger the other
-- table's policy evaluation.
--
-- Run this once in the Supabase SQL Editor, after 0001_init.sql.

create function public.is_workspace_owner(ws_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.workspaces w
    where w.id = ws_id and w.owner_id = auth.uid()
  );
$$;

create function public.active_membership(ws_id uuid)
returns public.workspace_members
language sql
security definer
set search_path = public
stable
as $$
  select * from public.workspace_members wm
  where wm.workspace_id = ws_id and wm.user_id = auth.uid() and wm.status = 'active'
  limit 1;
$$;

-- workspaces
drop policy "workspaces_select" on public.workspaces;
create policy "workspaces_select" on public.workspaces
  for select using (
    public.is_workspace_owner(workspaces.id)
    or (public.active_membership(workspaces.id)).status = 'active'
  );

-- workspace_members
drop policy "workspace_members_select" on public.workspace_members;
create policy "workspace_members_select" on public.workspace_members
  for select using (
    user_id = auth.uid()
    or public.is_workspace_owner(workspace_members.workspace_id)
  );

drop policy "workspace_members_insert" on public.workspace_members;
create policy "workspace_members_insert" on public.workspace_members
  for insert with check (
    (user_id = auth.uid() and status = 'pending' and role = 'member')
    or public.is_workspace_owner(workspace_members.workspace_id)
  );

drop policy "workspace_members_update_owner" on public.workspace_members;
create policy "workspace_members_update_owner" on public.workspace_members
  for update using (
    public.is_workspace_owner(workspace_members.workspace_id)
  ) with check (
    public.is_workspace_owner(workspace_members.workspace_id)
  );

drop policy "workspace_members_delete_owner" on public.workspace_members;
create policy "workspace_members_delete_owner" on public.workspace_members
  for delete using (
    public.is_workspace_owner(workspace_members.workspace_id)
  );

-- invites
drop policy "invites_select_owner" on public.invites;
create policy "invites_select_owner" on public.invites
  for select using (public.is_workspace_owner(invites.workspace_id));

drop policy "invites_insert_owner" on public.invites;
create policy "invites_insert_owner" on public.invites
  for insert with check (
    created_by = auth.uid() and public.is_workspace_owner(invites.workspace_id)
  );

drop policy "invites_update_owner" on public.invites;
create policy "invites_update_owner" on public.invites
  for update using (public.is_workspace_owner(invites.workspace_id));

drop policy "invites_delete_owner" on public.invites;
create policy "invites_delete_owner" on public.invites
  for delete using (public.is_workspace_owner(invites.workspace_id));

-- exchange_rates
drop policy "exchange_rates_select" on public.exchange_rates;
create policy "exchange_rates_select" on public.exchange_rates
  for select using (
    public.is_workspace_owner(exchange_rates.workspace_id)
    or (public.active_membership(exchange_rates.workspace_id)).status = 'active'
  );

drop policy "exchange_rates_insert" on public.exchange_rates;
create policy "exchange_rates_insert" on public.exchange_rates
  for insert with check (
    public.is_workspace_owner(exchange_rates.workspace_id)
    or (public.active_membership(exchange_rates.workspace_id)).can_edit_settings = true
  );

drop policy "exchange_rates_update" on public.exchange_rates;
create policy "exchange_rates_update" on public.exchange_rates
  for update using (
    public.is_workspace_owner(exchange_rates.workspace_id)
    or (public.active_membership(exchange_rates.workspace_id)).can_edit_settings = true
  );

-- transactions
drop policy "transactions_select" on public.transactions;
create policy "transactions_select" on public.transactions
  for select using (
    public.is_workspace_owner(transactions.workspace_id)
    or (
      (public.active_membership(transactions.workspace_id)).status = 'active'
      and (
        (public.active_membership(transactions.workspace_id)).view_scope = 'all'
        or transactions.created_by = auth.uid()
      )
    )
  );

drop policy "transactions_insert" on public.transactions;
create policy "transactions_insert" on public.transactions
  for insert with check (
    created_by = auth.uid()
    and (
      public.is_workspace_owner(transactions.workspace_id)
      or (public.active_membership(transactions.workspace_id)).can_add = true
    )
  );

drop policy "transactions_update" on public.transactions;
create policy "transactions_update" on public.transactions
  for update using (
    public.is_workspace_owner(transactions.workspace_id)
    or (
      (transactions.created_by = auth.uid() and (public.active_membership(transactions.workspace_id)).can_edit_own = true)
      or (transactions.created_by <> auth.uid() and (public.active_membership(transactions.workspace_id)).can_edit_others = true)
    )
  );

drop policy "transactions_delete" on public.transactions;
create policy "transactions_delete" on public.transactions
  for delete using (
    public.is_workspace_owner(transactions.workspace_id)
    or (
      (transactions.created_by = auth.uid() and (public.active_membership(transactions.workspace_id)).can_edit_own = true)
      or (transactions.created_by <> auth.uid() and (public.active_membership(transactions.workspace_id)).can_edit_others = true)
    )
  );
