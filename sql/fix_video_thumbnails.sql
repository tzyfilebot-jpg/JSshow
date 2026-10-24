-- JSSHOW thumbnail repair: backfill common provider thumbnails and expose them to public video pages.
-- Run this whole file once in Supabase SQL Editor.

alter table public.videos add column if not exists thumbnail_url text;

-- Backfill existing YouTube and Google Drive embed rows where no thumbnail was saved.
update public.videos v
set thumbnail_url = case
  when v.video_url ~* '(^|//)(www\.)?(youtube\.com|youtube-nocookie\.com|youtu\.be)/' then
    'https://i.ytimg.com/vi/' ||
    (regexp_match(v.video_url, '(?:youtube-nocookie\.com/embed/|youtube\.com/embed/|youtube\.com/shorts/|youtube\.com/live/|youtu\.be/)([A-Za-z0-9_-]+)'))[1] || '/hqdefault.jpg'
  when v.video_url ~* 'drive\.google\.com/file/d/' then
    'https://drive.google.com/thumbnail?id=' ||
    (regexp_match(v.video_url, 'drive\.google\.com/file/d/([^/?#]+)'))[1] || '&sz=w1000'
  else v.thumbnail_url
end
where (v.thumbnail_url is null or btrim(v.thumbnail_url) = '')
  and (v.video_url ~* '(youtube\.com|youtube-nocookie\.com|youtu\.be)' or v.video_url ~* 'drive\.google\.com/file/d/');

-- Drop/recreate because PostgreSQL cannot change a table-returning function's result columns with CREATE OR REPLACE.
drop function if exists public.get_public_embed_video(uuid);
create function public.get_public_embed_video(p_video_id uuid)
returns table (id uuid, title text, video_url text, status text, created_at timestamptz, audience text, thumbnail_url text, slug text)
language sql stable security definer set search_path = '' as $$
  select v.id, v.title, v.video_url, v.status, v.created_at, v.audience, v.thumbnail_url, v.slug
  from public.videos v
  where v.id = p_video_id and v.status = 'published' and v.video_url is not null
    and (coalesce(v.audience, 'public') = 'public' or auth.uid() is not null)
  limit 1;
$$;
revoke all on function public.get_public_embed_video(uuid) from public;
grant execute on function public.get_public_embed_video(uuid) to anon, authenticated;

drop function if exists public.get_public_embed_video_by_slug(text);
create function public.get_public_embed_video_by_slug(p_slug text)
returns table (id uuid, title text, video_url text, status text, slug text, audience text, thumbnail_url text)
language sql stable security definer set search_path = '' as $$
  select v.id, v.title, v.video_url, v.status, v.slug, v.audience, v.thumbnail_url
  from public.videos v
  where v.slug = p_slug and v.status = 'published' and v.video_url is not null
    and (coalesce(v.audience, 'public') = 'public' or auth.uid() is not null)
  limit 1;
$$;
revoke all on function public.get_public_embed_video_by_slug(text) from public;
grant execute on function public.get_public_embed_video_by_slug(text) to anon, authenticated;

-- Catalogue RPC must keep returning thumbnail_url. This is safe public metadata only; no video_url is exposed.
create or replace function public.jsvidey_catalog_videos()
returns table(id uuid, slug text, title text, created_at timestamptz, status text, category text, audience text, thumbnail_url text)
language sql stable security definer set search_path = public, auth as $$
  select v.id, v.slug, v.title, v.created_at, v.status, v.category, v.audience, v.thumbnail_url
  from public.videos v
  where v.status = 'published'
    and (coalesce(v.audience, 'public') in ('public','members','vip','premium') or coalesce(v.category, '') ilike 'server%')
  order by v.created_at desc limit 300;
$$;
revoke all on function public.jsvidey_catalog_videos() from public;
grant execute on function public.jsvidey_catalog_videos() to anon, authenticated;
