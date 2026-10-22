-- Jalankan sekali di Supabase SQL Editor.
create table if not exists public.video_likes (
  id bigint generated always as identity primary key,
  video_id uuid not null references public.videos(id) on delete cascade,
  visitor_id uuid not null,
  created_at timestamptz not null default now(),
  unique(video_id, visitor_id)
);
create table if not exists public.video_comments (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  visitor_id uuid not null,
  display_name text not null default 'Pengunjung',
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists video_comments_video_created_idx on public.video_comments(video_id, created_at desc);
alter table public.video_likes enable row level security;
alter table public.video_comments enable row level security;
-- These columns are needed by catalog filters and comment RLS before the later platform expansion.
grant select (id, title, video_url, status, created_at, category, thumbnail_url, slug, audience)
  on public.videos to anon, authenticated;

drop policy if exists "Public can read comments on published videos" on public.video_comments;
create policy "Public can read comments on published videos" on public.video_comments
  for select to anon, authenticated using (
    exists (select 1 from public.videos v where v.id = video_id and v.status = 'published'
      and (coalesce(v.audience, 'public') = 'public' or auth.uid() is not null))
  );
drop policy if exists "Public can comment on published videos" on public.video_comments;
drop policy if exists "Members can comment on published videos" on public.video_comments;
create policy "Members can comment on published videos" on public.video_comments
  for insert to authenticated with check (
    visitor_id = auth.uid()
    and char_length(body) between 1 and 1000
    and char_length(display_name) between 1 and 40
    and exists (select 1 from public.videos v where v.id = video_id and v.status = 'published'
      and (coalesce(v.audience, 'public') = 'public' or auth.uid() is not null))
  );

drop policy if exists "Public can read likes" on public.video_likes;
-- Do not expose visitor identifiers by allowing clients to SELECT raw like rows.
revoke all on public.video_likes from public, anon, authenticated;
revoke select (id, video_id, visitor_id, created_at) on public.video_likes from public, anon, authenticated;
DO $$
DECLARE seq_name text;
BEGIN
  seq_name := pg_get_serial_sequence('public.video_likes', 'id');
  IF seq_name IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM PUBLIC, anon, authenticated', seq_name::regclass);
  END IF;
END $$;
drop policy if exists "Public can add own like" on public.video_likes;
drop policy if exists "Members can add own like" on public.video_likes;
drop policy if exists "Public can remove own like" on public.video_likes;
drop policy if exists "Members can remove own like" on public.video_likes;
-- All client writes go through the SECURITY DEFINER RPC below; no raw Like policies or grants remain.
revoke all on public.video_comments from public, anon, authenticated;
revoke select (id, video_id, visitor_id, display_name, body, created_at) on public.video_comments from public, anon, authenticated;
revoke insert (id, video_id, visitor_id, display_name, body, created_at) on public.video_comments from public, anon, authenticated;
-- Never expose visitor_id through PostgREST; video_id remains selectable for filters.
grant select (id, video_id, display_name, body, created_at) on public.video_comments to anon, authenticated;
grant insert (video_id, visitor_id, display_name, body) on public.video_comments to authenticated;
-- Return only the aggregate count and whether the signed-in user has liked.
-- SECURITY DEFINER is constrained to this single, read-only query and a fixed search_path.
create or replace function public.get_video_like_state(p_video_id uuid)
returns table (like_count bigint, liked boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*) from public.video_likes l where l.video_id = p_video_id),
    (auth.uid() is not null and exists(
      select 1 from public.video_likes l where l.video_id = p_video_id and l.visitor_id = auth.uid()
    ))
  where exists (
    select 1 from public.videos v
    where v.id = p_video_id and v.status = 'published'
      and (coalesce(v.audience, 'public') = 'public' or auth.uid() is not null)
  );
$$;
revoke all on function public.get_video_like_state(uuid) from public, anon, authenticated;
grant execute on function public.get_video_like_state(uuid) to anon, authenticated;

-- Idempotent Like mutation: callers can change only their own Like, without raw table grants.
create or replace function public.set_video_like(p_video_id uuid, p_liked boolean)
returns table (like_count bigint, liked boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare uid uuid;
begin
  uid := auth.uid();
  if uid is null then raise exception 'Login diperlukan untuk memberi Like'; end if;
  if p_video_id is null or not exists (
    select 1 from public.videos v
    where v.id = p_video_id and v.status = 'published'
      and (coalesce(v.audience, 'public') = 'public' or uid is not null)
  ) then raise exception 'Video tidak tersedia untuk Like'; end if;

  if coalesce(p_liked, false) then
    insert into public.video_likes(video_id, visitor_id)
    values (p_video_id, uid)
    on conflict (video_id, visitor_id) do nothing;
  else
    delete from public.video_likes l where l.video_id = p_video_id and l.visitor_id = uid;
  end if;

  return query select
    (select count(*)::bigint from public.video_likes l where l.video_id = p_video_id),
    exists(select 1 from public.video_likes l where l.video_id = p_video_id and l.visitor_id = uid);
end;
$$;
revoke all on function public.set_video_like(uuid, boolean) from public, anon, authenticated;
grant execute on function public.set_video_like(uuid, boolean) to authenticated;


-- Favorites are private to the signed-in user.
create table if not exists public.video_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  video_id uuid not null references public.videos(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, video_id)
);
create index if not exists video_favorites_user_created_idx
  on public.video_favorites(user_id, created_at desc);
alter table public.video_favorites enable row level security;
drop policy if exists "Users read own favorites" on public.video_favorites;
create policy "Users read own favorites" on public.video_favorites
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users add own favorites" on public.video_favorites;
create policy "Users add own favorites" on public.video_favorites
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users remove own favorites" on public.video_favorites;
create policy "Users remove own favorites" on public.video_favorites
  for delete to authenticated using (auth.uid() = user_id);
revoke all on public.video_favorites from public, anon, authenticated;
grant select, insert, delete on public.video_favorites to authenticated;
