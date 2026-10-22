-- Jsvidey video catalog categories
-- Run in Supabase SQL Editor. Existing videos default to Trending.
alter table public.videos add column if not exists category text not null default 'Trending';
alter table public.videos add column if not exists thumbnail_url text;
create index if not exists videos_status_created_at_idx on public.videos (status, created_at desc);
create index if not exists videos_category_idx on public.videos (category);
-- Keep the existing RLS policies; do not expose service-role credentials in frontend code.

-- Catalog reads only published rows; needed by index/categories/watch pages.
alter table public.videos enable row level security;
drop policy if exists "Public can read published videos" on public.videos;
create policy "Public can read published videos" on public.videos
  for select to anon, authenticated using (status = 'published');
grant select on public.videos to anon, authenticated;
