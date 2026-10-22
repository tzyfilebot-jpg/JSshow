-- READ-ONLY DIAGNOSTIC. This file only runs SELECT statements; it does not modify schema or data.
-- Run in Supabase SQL Editor before fix_social_interactions_safe.sql if you want a snapshot of current state.

-- 1) Relevant columns and types.
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('videos', 'video_likes', 'video_comments', 'video_favorites')
ORDER BY table_name, ordinal_position;

-- 2) Existing RLS policies that may overlap.
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('videos', 'video_likes', 'video_comments', 'video_favorites')
ORDER BY tablename, policyname;

-- 3) Lookup/social function signatures and return shapes.
SELECT n.nspname AS schema_name,
       p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS arguments,
       pg_get_function_result(p.oid) AS result_type,
       p.prosecdef AS security_definer,
       p.proconfig AS function_settings
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('get_public_embed_video', 'get_public_embed_video_by_slug', 'get_video_like_state')
ORDER BY p.proname, arguments;

-- 4) Explicit table grants for relevant roles.
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('videos', 'video_likes', 'video_comments', 'video_favorites')
  AND grantee IN ('PUBLIC', 'anon', 'authenticated')
ORDER BY table_name, grantee, privilege_type;
