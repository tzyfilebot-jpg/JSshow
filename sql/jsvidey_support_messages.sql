-- Jsvidey support inbox. Run in Supabase SQL Editor.
create table if not exists public.jsvidey_support_messages (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 message text not null check (char_length(trim(message)) between 1 and 1500),
 status text not null default 'open' check (status in ('open','answered','closed')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists jsvidey_support_messages_created_idx on public.jsvidey_support_messages(created_at desc);
create index if not exists jsvidey_support_messages_user_idx on public.jsvidey_support_messages(user_id,created_at desc);
alter table public.jsvidey_support_messages enable row level security;
grant select,insert,update,delete on public.jsvidey_support_messages to authenticated;
drop policy if exists "support member insert own" on public.jsvidey_support_messages;
create policy "support member insert own" on public.jsvidey_support_messages for insert to authenticated with check (auth.uid()=user_id and char_length(trim(message)) between 1 and 1500);
drop policy if exists "support member read own" on public.jsvidey_support_messages;
create policy "support member read own" on public.jsvidey_support_messages for select to authenticated using (auth.uid()=user_id or public.jsvidey_is_admin());
drop policy if exists "support admin update" on public.jsvidey_support_messages;
create policy "support admin update" on public.jsvidey_support_messages for update to authenticated using (public.jsvidey_is_admin()) with check (public.jsvidey_is_admin());
drop policy if exists "support admin delete" on public.jsvidey_support_messages;
create policy "support admin delete" on public.jsvidey_support_messages for delete to authenticated using (public.jsvidey_is_admin());
