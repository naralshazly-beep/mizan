-- Daily trends room (غرفة الأخبار) — every morning a scheduled job asks
-- Claude (with web search) for today's trends, analysis and content ideas,
-- and stores them here. Reports are shared by every signed-in user of the
-- app; rows are only INSERTED by the server using the service-role key
-- (cron job / "generate now" button), so there is no insert policy.
--
-- Run this once in the Supabase SQL Editor.

create table public.trend_reports (
  id uuid primary key default gen_random_uuid(),
  report_date date not null unique,
  overview text not null,
  model text,
  created_at timestamptz not null default now()
);

create table public.trend_items (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.trend_reports (id) on delete cascade,
  position int not null default 0,
  category text not null,
  title text not null,
  summary text not null,
  why_trending text not null,
  analysis text not null,
  audience_interest int not null check (audience_interest between 1 and 10),
  sentiment text not null check (sentiment in ('positive', 'negative', 'mixed', 'neutral')),
  content_angle text not null,
  hook text not null,
  slides jsonb not null default '[]'::jsonb,
  hashtags text[] not null default '{}',
  sources jsonb not null default '[]'::jsonb,
  status text not null default 'review'
    check (status in ('review', 'approved', 'scheduled', 'published', 'rejected')),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index trend_items_report_id_idx on public.trend_items (report_id);

alter table public.trend_reports enable row level security;
alter table public.trend_items enable row level security;

create policy "trend_reports_select_authenticated" on public.trend_reports
  for select to authenticated using (true);

create policy "trend_items_select_authenticated" on public.trend_items
  for select to authenticated using (true);

-- Signed-in users can move an item through the review workflow.
create policy "trend_items_update_authenticated" on public.trend_items
  for update to authenticated using (true) with check (true);
