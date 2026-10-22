-- Jsvidey: safe public metadata lookup for embed-only video pages.
-- Run this in the SQL Editor of the Jsvidey Supabase project.
-- It exposes only published embed-link metadata, never storage keys or private fields.
create or replace function public.get_public_embed_video(p_video_id uuid)
returns table (
  id uuid,
  title text,
  video_url text,
  status text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select v.id, v.title, v.video_url, v.status, v.created_at
  from public.videos as v
  where v.id = p_video_id
    and v.status = 'published'
    and v.video_url is not null
  limit 1;
$$;

revoke all on function public.get_public_embed_video(uuid) from public;
grant execute on function public.get_public_embed_video(uuid) to anon, authenticated;
