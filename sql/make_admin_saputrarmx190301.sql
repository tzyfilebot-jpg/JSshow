-- Jsvidey: grant admin access to the requested email.
-- Run in Supabase SQL Editor as database owner AFTER this email has registered
-- and signed in at least once, and AFTER js videy_admin_control_center.sql.
-- This grants access only to the exact existing auth.users account matching this email.

do $$
declare
  target_user_id uuid;
begin
  select id into target_user_id
  from auth.users
  where lower(email) = lower('saputrarmx190301@gmail.com')
  limit 1;

  if target_user_id is null then
    raise exception 'Akun saputrarmx190301@gmail.com belum ditemukan. Daftar/login dulu, lalu jalankan SQL ini lagi.';
  end if;

  insert into public.jsvidey_admins (user_id)
  values (target_user_id)
  on conflict (user_id) do nothing;
end $$;
