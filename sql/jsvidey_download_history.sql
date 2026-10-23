-- Riwayat permintaan unduhan JSSHOW. Jalankan sekali di Supabase SQL Editor.
create table if not exists public.jsvidey_download_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  video_id uuid references public.videos(id) on delete set null,
  title text not null default 'Video tanpa judul',
  source_url text not null,
  download_url text not null,
  downloaded_at timestamptz not null default now()
);
create index if not exists jsvidey_download_history_user_date_idx
  on public.jsvidey_download_history(user_id, downloaded_at desc);
alter table public.jsvidey_download_history enable row level security;
drop policy if exists "Users read own download history" on public.jsvidey_download_history;
create policy "Users read own download history" on public.jsvidey_download_history
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users add own download history" on public.jsvidey_download_history;
create policy "Users add own download history" on public.jsvidey_download_history
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users delete own download history" on public.jsvidey_download_history;
create policy "Users delete own download history" on public.jsvidey_download_history
  for delete to authenticated using (auth.uid() = user_id);
revoke all on public.jsvidey_download_history from public, anon, authenticated;
grant select, insert, delete on public.jsvidey_download_history to authenticated;
