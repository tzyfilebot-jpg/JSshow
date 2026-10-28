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
drop policy if exists "Anon can read public published videos" on public.videos;
drop policy if exists "Members can read all published videos" on public.videos;
create policy "Anon can read public published videos" on public.videos
  for select to anon using (status = 'published' and audience = 'public');
create policy "Members can read all published videos" on public.videos
  for select to authenticated using (status = 'published');
-- Remove any previous table-wide SELECT grant, then grant only fields used by the UI.
-- RLS still limits which rows are visible; column grants also prevent exposing internal fields.
revoke all on public.videos from public, anon, authenticated;
revoke select (user_id, updated_at, storage_key, file_size_bytes) on public.videos from public, anon, authenticated;
grant select (id, title, video_url, status, created_at, category, thumbnail_url)
  on public.videos to anon;
grant select (id, title, video_url, status, created_at, category, thumbnail_url)
  on public.videos to authenticated;
-- Publishing is restricted to the admin-only INSERT policy; updates/deletes use admin RPCs.
revoke update, delete on public.videos from public, anon, authenticated;
