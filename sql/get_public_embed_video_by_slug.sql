-- Public, read-only lookup for published videos by short slug.
-- Does not grant anon/authenticated broad SELECT access to public.videos.
create or replace function public.get_public_embed_video_by_slug(p_slug text)
returns table (
  id uuid,
  title text,
  video_url text,
  status text,
  slug text
)
language sql
stable
security definer
set search_path = ''
as $$
  select v.id, v.title, v.video_url, v.status, v.slug
  from public.videos as v
  where v.slug = p_slug
    and v.status = 'published'
    and v.video_url is not null
  limit 1;
$$;

revoke all on function public.get_public_embed_video_by_slug(text) from public;
grant execute on function public.get_public_embed_video_by_slug(text) to anon, authenticated;
