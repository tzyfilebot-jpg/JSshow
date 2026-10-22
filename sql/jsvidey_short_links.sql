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

-- Public clients only need to read the slug alongside the existing public metadata policy.
grant select (id, title, video_url, status, slug, created_at, category) on public.videos to anon, authenticated;
