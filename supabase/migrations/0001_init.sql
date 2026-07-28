-- Mizan — initial schema, per Finance_App_SPEC.md §7-8.
-- Run this once in the Supabase SQL Editor (Project > SQL Editor > New query).

-- ============================================================================
-- Tables
-- ============================================================================

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text not null,
  created_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('personal', 'company')),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  base_currency text not null default 'USD',
  created_at timestamptz not null default now()
);

create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  view_scope text not null default 'all' check (view_scope in ('all', 'own_only')),
  can_add boolean not null default true,
  can_edit_own boolean not null default true,
  can_edit_others boolean not null default false,
  can_view_dashboard boolean not null default true,
  can_edit_settings boolean not null default false,
  status text not null default 'active' check (status in ('active', 'pending', 'rejected')),
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email text,
  code text unique,
  created_by uuid not null references public.profiles (id) on delete cascade,
  expires_at timestamptz,
  used boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.exchange_rates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  currency text not null check (currency in ('USD', 'AED', 'EGP')),
  rate_to_base numeric(14, 6) not null,
  updated_at timestamptz not null default now(),
  unique (workspace_id, currency)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  type text not null check (type in ('income', 'expense')),
  category text not null,
  description text not null default '',
  currency text not null check (currency in ('USD', 'AED', 'EGP')),
  amount numeric(14, 2) not null check (amount > 0),
  rate_to_base numeric(14, 6) not null,
  amount_base numeric(14, 2) generated always as (amount * rate_to_base) stored,
  created_at timestamptz not null default now()
);

create index workspaces_owner_id_idx on public.workspaces (owner_id);
create index workspace_members_workspace_id_idx on public.workspace_members (workspace_id);
create index workspace_members_user_id_idx on public.workspace_members (user_id);
create index transactions_workspace_id_idx on public.transactions (workspace_id);
create index transactions_created_by_idx on public.transactions (created_by);
create index invites_workspace_id_idx on public.invites (workspace_id);

-- ============================================================================
-- New-user provisioning: profile + personal workspace + default rates (§9.1)
-- ============================================================================

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_workspace_id uuid;
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), new.email);

  insert into public.workspaces (name, type, owner_id, base_currency)
  values ('Personal', 'personal', new.id, 'USD')
  returning id into new_workspace_id;

  insert into public.exchange_rates (workspace_id, currency, rate_to_base)
  values
    (new_workspace_id, 'USD', 1),
    (new_workspace_id, 'AED', 0.2723),
    (new_workspace_id, 'EGP', 0.0203);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.touch_exchange_rate_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger exchange_rates_touch_updated_at
  before update on public.exchange_rates
  for each row execute function public.touch_exchange_rate_updated_at();

-- ============================================================================
-- Row Level Security (§8) — the database must reject unauthorized access,
-- not just the UI.
--
-- workspaces and workspace_members each need to check the other table, which
-- would make their policies reference each other directly and trigger
-- Postgres error 42P17 ("infinite recursion detected in policy"). These two
-- SECURITY DEFINER helpers break that cycle: they run with the function
-- owner's privileges and bypass RLS internally, so calling them doesn't
-- re-trigger the other table's policy evaluation.
-- ============================================================================

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

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.invites enable row level security;
alter table public.exchange_rates enable row level security;
alter table public.transactions enable row level security;

-- profiles: read/update only your own row. Rows are created by the trigger
-- above (security definer), never directly by users.
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- workspaces: see your own personal workspace, any company workspace you
-- own, or any company workspace you're an active member of.
create policy "workspaces_select" on public.workspaces
  for select using (
    public.is_workspace_owner(workspaces.id)
    or (public.active_membership(workspaces.id)).status = 'active'
  );

-- Only company workspaces can be created directly via the API; the single
-- personal workspace per user comes only from the signup trigger.
create policy "workspaces_insert_company" on public.workspaces
  for insert with check (owner_id = auth.uid() and type = 'company');

create policy "workspaces_update_owner" on public.workspaces
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- workspace_members: the owner manages membership; a user can also see
-- their own membership rows and self-request to join via invite code/link.
create policy "workspace_members_select" on public.workspace_members
  for select using (
    user_id = auth.uid()
    or public.is_workspace_owner(workspace_members.workspace_id)
  );

create policy "workspace_members_insert" on public.workspace_members
  for insert with check (
    (user_id = auth.uid() and status = 'pending' and role = 'member')
    or public.is_workspace_owner(workspace_members.workspace_id)
  );

create policy "workspace_members_update_owner" on public.workspace_members
  for update using (
    public.is_workspace_owner(workspace_members.workspace_id)
  ) with check (
    public.is_workspace_owner(workspace_members.workspace_id)
  );

create policy "workspace_members_delete_owner" on public.workspace_members
  for delete using (
    public.is_workspace_owner(workspace_members.workspace_id)
  );

-- invites: only the workspace owner manages invites in v1. (Redeeming a
-- code/link to self-request joining is implemented as a security-definer
-- RPC in the Stage 4 migration, not a direct table read, to avoid exposing
-- every invite row to every logged-in user.)
create policy "invites_select_owner" on public.invites
  for select using (public.is_workspace_owner(invites.workspace_id));

create policy "invites_insert_owner" on public.invites
  for insert with check (
    created_by = auth.uid() and public.is_workspace_owner(invites.workspace_id)
  );

create policy "invites_update_owner" on public.invites
  for update using (public.is_workspace_owner(invites.workspace_id));

create policy "invites_delete_owner" on public.invites
  for delete using (public.is_workspace_owner(invites.workspace_id));

-- exchange_rates: any owner or active member can read; only the owner or a
-- member with can_edit_settings may write.
create policy "exchange_rates_select" on public.exchange_rates
  for select using (
    public.is_workspace_owner(exchange_rates.workspace_id)
    or (public.active_membership(exchange_rates.workspace_id)).status = 'active'
  );

create policy "exchange_rates_insert" on public.exchange_rates
  for insert with check (
    public.is_workspace_owner(exchange_rates.workspace_id)
    or (public.active_membership(exchange_rates.workspace_id)).can_edit_settings = true
  );

create policy "exchange_rates_update" on public.exchange_rates
  for update using (
    public.is_workspace_owner(exchange_rates.workspace_id)
    or (public.active_membership(exchange_rates.workspace_id)).can_edit_settings = true
  );

-- transactions: visibility follows view_scope; write access follows
-- can_add / can_edit_own / can_edit_others. The workspace owner always has
-- full access.
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

create policy "transactions_insert" on public.transactions
  for insert with check (
    created_by = auth.uid()
    and (
      public.is_workspace_owner(transactions.workspace_id)
      or (public.active_membership(transactions.workspace_id)).can_add = true
    )
  );

create policy "transactions_update" on public.transactions
  for update using (
    public.is_workspace_owner(transactions.workspace_id)
    or (
      (transactions.created_by = auth.uid() and (public.active_membership(transactions.workspace_id)).can_edit_own = true)
      or (transactions.created_by <> auth.uid() and (public.active_membership(transactions.workspace_id)).can_edit_others = true)
    )
  );

create policy "transactions_delete" on public.transactions
  for delete using (
    public.is_workspace_owner(transactions.workspace_id)
    or (
      (transactions.created_by = auth.uid() and (public.active_membership(transactions.workspace_id)).can_edit_own = true)
      or (transactions.created_by <> auth.uid() and (public.active_membership(transactions.workspace_id)).can_edit_others = true)
    )
  );
