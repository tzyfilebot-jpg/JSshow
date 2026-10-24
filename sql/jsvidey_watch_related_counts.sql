-- JSSHOW: public aggregate counts for related videos on watch.html.
-- Run this once in Supabase SQL Editor. This exposes counts only, never user identities.
create or replace function public.jsvidey_get_video_social_counts(p_video_ids uuid[])
returns table(video_id uuid, like_count bigint, comment_count bigint, favorite_count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select v.id,
    (select count(*)::bigint from public.video_likes l where l.video_id = v.id) as like_count,
    (select count(*)::bigint from public.video_comments c where c.video_id = v.id) as comment_count,
    (select count(*)::bigint from public.video_favorites f where f.video_id = v.id) as favorite_count
  from public.videos v
  where v.id = any(coalesce(p_video_ids, array[]::uuid[]))
    and v.status = 'published'
    and coalesce(v.audience, 'public') = 'public';
$$;
revoke all on function public.jsvidey_get_video_social_counts(uuid[]) from public;
grant execute on function public.jsvidey_get_video_social_counts(uuid[]) to anon, authenticated;
