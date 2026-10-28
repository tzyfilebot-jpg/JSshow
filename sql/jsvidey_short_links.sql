-- Jsvidey short video links: https://videeyyjs.pages.dev/<slug>
-- Run this once in the Supabase SQL Editor before deploying the updated site.

alter table public.videos add column if not exists slug text;

-- Give existing videos stable, unique slugs while preserving access through their UUID links.
update public.videos
set slug = coalesce(
  nullif(trim(both '-' from regexp_replace(lower(coalesce(title, 'video')), '[^a-z0-9]+', '-', 'g')), ''),
  'video'
) || '-' || substr(id::text, 1, 6)
where slug is null or btrim(slug) = '';

create unique index if not exists videos_slug_unique_idx on public.videos(slug);
create index if not exists videos_published_slug_idx on public.videos(slug) where status = 'published';

-- Column-level grants are maintained by js videy_video_catalog.sql. This file only
-- ensures the slug column is included for projects that run this migration later.
revoke select (user_id, updated_at, storage_key, file_size_bytes) on public.videos from public, anon, authenticated;
grant select (id, title, video_url, status, slug, created_at, category) on public.videos to anon, authenticated;
