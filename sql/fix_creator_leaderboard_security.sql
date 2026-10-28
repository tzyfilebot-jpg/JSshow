-- Jsvidey: fix Supabase Security Definer View lint
-- Run in Supabase SQL Editor.
-- Uses invoker privileges and RLS instead of the view owner's privileges.
alter view public.creator_leaderboard
set (security_invoker = true);

-- Verify the option:
select c.relname, c.reloptions
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'creator_leaderboard'
  and c.relkind = 'v';
