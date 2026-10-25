-- Jsvidey support inbox. Run in Supabase SQL Editor.
create table if not exists public.jsvidey_support_messages (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 message text not null default '',
 status text not null default 'open' check (status in ('open','answered','closed')),
 sender_role text not null default 'member' check (sender_role in ('member','admin')),
 attachment_url text,
 attachment_name text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.jsvidey_support_messages add column if not exists sender_role text not null default 'member';
alter table public.jsvidey_support_messages add column if not exists attachment_url text;
alter table public.jsvidey_support_messages add column if not exists attachment_name text;

alter table public.jsvidey_support_messages drop constraint if exists jsvidey_support_messages_message_check;
alter table public.jsvidey_support_messages add constraint jsvidey_support_messages_message_check check (char_length(trim(coalesce(message,''))) <= 1500 and (char_length(trim(coalesce(message,''))) > 0 or nullif(trim(coalesce(attachment_url,'')),'') is not null));
create index if not exists jsvidey_support_messages_created_idx on public.jsvidey_support_messages(created_at desc);
create index if not exists jsvidey_support_messages_user_idx on public.jsvidey_support_messages(user_id,created_at desc);
alter table public.jsvidey_support_messages enable row level security;
grant select,insert,update,delete on public.jsvidey_support_messages to authenticated;
drop policy if exists "support member insert own" on public.jsvidey_support_messages;
create policy "support member insert own" on public.jsvidey_support_messages for insert to authenticated with check (auth.uid()=user_id and sender_role='member' and char_length(trim(coalesce(message,''))) <= 1500 and (char_length(trim(coalesce(message,''))) > 0 or nullif(trim(coalesce(attachment_url,'')),'') is not null));
drop policy if exists "support member read own" on public.jsvidey_support_messages;
create policy "support member read own" on public.jsvidey_support_messages for select to authenticated using (auth.uid()=user_id or public.jsvidey_is_admin());
drop policy if exists "support admin insert reply" on public.jsvidey_support_messages;
create policy "support admin insert reply" on public.jsvidey_support_messages for insert to authenticated with check (public.jsvidey_is_admin() and sender_role='admin');
drop policy if exists "support admin update" on public.jsvidey_support_messages;
create policy "support admin update" on public.jsvidey_support_messages for update to authenticated using (public.jsvidey_is_admin()) with check (public.jsvidey_is_admin());
drop policy if exists "support admin delete" on public.jsvidey_support_messages;
create policy "support admin delete" on public.jsvidey_support_messages for delete to authenticated using (public.jsvidey_is_admin());
