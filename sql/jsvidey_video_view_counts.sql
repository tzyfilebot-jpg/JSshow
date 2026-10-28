-- JSSHOW: total views on every video card.
-- Run after js videy_dashboard_vip.sql (which creates video_views and record_video_view).
-- Read-only aggregate; it never returns viewer IDs or individual view records.
create or replace function public.jsvidey_get_video_view_counts(p_video_ids uuid[])
returns table(video_id uuid, view_count bigint)
language sql
stable
security definer
set search_path = public, auth
as $$
  select v.id,
         coalesce(sum(vv.views), 0)::bigint as view_count
  from public.videos v
  left join public.video_views vv on vv.video_id = v.id
  where v.status = 'published'
    and v.id = any(coalesce(p_video_ids, array[]::uuid[]))
  group by v.id;
$$;

revoke all on function public.jsvidey_get_video_view_counts(uuid[]) from public;
grant execute on function public.jsvidey_get_video_view_counts(uuid[]) to anon, authenticated;
