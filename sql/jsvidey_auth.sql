-- Jsvidey: Supabase Auth profile schema
-- Run in Supabase Dashboard > SQL Editor.
-- Passwords are managed by Supabase Auth; never store plaintext passwords in public tables.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  display_name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[A-Za-z0-9_]{3,24}$')
);

alter table public.profiles enable row level security;

drop policy if exists "Profiles are viewable by everyone" on public.profiles;
create policy "Profiles are viewable by everyone"
  on public.profiles for select using (true);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create or replace function public.handle_new_jsvidey_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_username text;
begin
  requested_username := coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1));
  requested_username := regexp_replace(requested_username, '[^A-Za-z0-9_]', '_', 'g');
  requested_username := substr(requested_username, 1, 24);
  if length(requested_username) < 3 then requested_username := 'user_' || substr(replace(new.id::text, '-', ''), 1, 8); end if;
  insert into public.profiles (id, username, display_name)
  values (new.id, requested_username, coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), requested_username))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_jsvidey_auth_user_created on auth.users;
create trigger on_jsvidey_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_jsvidey_user();

create or replace function public.set_profile_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists set_jsvidey_profile_updated_at on public.profiles;
create trigger set_jsvidey_profile_updated_at before update on public.profiles
for each row execute procedure public.set_profile_updated_at();
