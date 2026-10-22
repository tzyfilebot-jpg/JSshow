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
drop policy if exists "Public can read likes" on public.video_likes;
create policy "Public can read likes" on public.video_likes for select to anon, authenticated using (true);
drop policy if exists "Public can add own like" on public.video_likes;
create policy "Public can add own like" on public.video_likes for insert to anon, authenticated with check (true);
drop policy if exists "Public can remove own like" on public.video_likes;
create policy "Public can remove own like" on public.video_likes for delete to anon, authenticated using (true);
drop policy if exists "Public can read comments on published videos" on public.video_comments;
create policy "Public can read comments on published videos" on public.video_comments for select to anon, authenticated using (exists(select 1 from public.videos v where v.id=video_id and v.status='published'));
drop policy if exists "Public can comment on published videos" on public.video_comments;
drop policy if exists "Members can comment on published videos" on public.video_comments;
create policy "Members can comment on published videos" on public.video_comments for insert to authenticated with check (
  visitor_id = auth.uid() and
  char_length(body) between 1 and 1000 and
  char_length(display_name) between 1 and 40 and
  exists(select 1 from public.videos v where v.id=video_id and v.status='published')
);
grant select, insert, delete on public.video_likes to anon, authenticated;
grant select on public.video_comments to anon, authenticated;
revoke insert on public.video_comments from anon;
grant insert on public.video_comments to authenticated;
grant usage, select on sequence public.video_likes_id_seq to anon, authenticated;


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
grant select, insert, delete on public.video_favorites to authenticated;
