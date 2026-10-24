-- JSSHOW watch-page social counters (current contract: share_count).
-- Prerequisites: public.videos, video_likes, and video_comments exist.
-- Run after sql/jsvidey-social-database.sql. Safe to rerun.
create table if not exists public.video_shares (
  id bigint generated always as identity primary key,
  video_id uuid not null references public.videos(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists video_shares_video_created_idx
  on public.video_shares(video_id, created_at desc);
alter table public.video_shares enable row level security;
revoke all on public.video_shares from public, anon, authenticated;

create or replace function public.jsvidey_record_video_share(p_video_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public, auth
as $$
declare total bigint;
begin
  if p_video_id is null or not exists (
    select 1 from public.videos v where v.id = p_video_id and v.status = 'published'
  ) then
    raise exception 'Video tidak ditemukan';
  end if;
  insert into public.video_shares(video_id) values (p_video_id);
  select count(*)::bigint into total from public.video_shares where video_id = p_video_id;
  return total;
end;
$$;
revoke all on function public.jsvidey_record_video_share(uuid) from public;
grant execute on function public.jsvidey_record_video_share(uuid) to anon, authenticated;

-- DROP is required because older deployments returned favorite_count instead of share_count.
drop function if exists public.jsvidey_get_video_social_counts(uuid[]);
create function public.jsvidey_get_video_social_counts(p_video_ids uuid[])
returns table(video_id uuid, like_count bigint, comment_count bigint, share_count bigint)
language sql
stable
security definer
set search_path = public, auth
as $$
  select v.id,
    (select count(*)::bigint from public.video_likes l where l.video_id = v.id),
    (select count(*)::bigint from public.video_comments c where c.video_id = v.id),
    (select count(*)::bigint from public.video_shares s where s.video_id = v.id)
  from public.videos v
  where v.id = any(coalesce(p_video_ids, array[]::uuid[]))
    and v.status = 'published';
$$;
revoke all on function public.jsvidey_get_video_social_counts(uuid[]) from public;
grant execute on function public.jsvidey_get_video_social_counts(uuid[]) to anon, authenticated;
