-- Jsvidey: safe, idempotent repair for video interactions and public video column access.
-- Run once in Supabase SQL Editor AFTER jsvidey_dashboard.sql has created public.videos.
-- This migration does not delete video/user rows and is safe to re-run.

DO $$
BEGIN
  IF to_regclass('public.videos') IS NULL THEN
    RAISE EXCEPTION 'Tabel public.videos belum ada. Jalankan sql/jsvidey_dashboard.sql terlebih dahulu.';
  END IF;
END $$;

-- Make the display columns expected by the current UI available without replacing existing data.
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'Trending';
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS thumbnail_url text;
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'public';
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS storage_key text;
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS file_size_bytes bigint;
-- Keep all supported access tiers. Do not downgrade VIP/Premium rows to public.
UPDATE public.videos SET audience = 'public'
WHERE audience IS NULL OR audience NOT IN ('public','members','vip','premium');
ALTER TABLE public.videos DROP CONSTRAINT IF EXISTS videos_audience_check;
ALTER TABLE public.videos ADD CONSTRAINT videos_audience_check
  CHECK (audience IN ('public','members','vip','premium'));

-- Remove table-wide SELECT grants that can expose internal columns. RLS remains responsible for rows.
REVOKE ALL ON public.videos FROM PUBLIC, anon, authenticated;
-- REVOKE ALL on a table does not clear earlier column-level grants.
REVOKE SELECT (user_id, updated_at, storage_key, file_size_bytes) ON public.videos FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, title, video_url, status, created_at, category, thumbnail_url, slug, audience)
  ON public.videos TO anon;
GRANT SELECT (id, title, video_url, status, created_at, category, thumbnail_url, slug, audience)
  ON public.videos TO authenticated;
GRANT INSERT ON public.videos TO authenticated;
REVOKE UPDATE, DELETE ON public.videos FROM PUBLIC, anon, authenticated;

-- Remove legacy member write policies. If the admin guard is installed, recreate the admin-only
-- insert policy; otherwise leave publishing disabled until the admin migrations are installed.
DROP POLICY IF EXISTS "Creators can add their own videos" ON public.videos;
DROP POLICY IF EXISTS "Creators can update their own videos" ON public.videos;
DROP POLICY IF EXISTS "Creators can delete their own videos" ON public.videos;
DO $$
BEGIN
  IF to_regprocedure('public.jsvidey_is_admin()') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can publish embed videos" ON public.videos';
    EXECUTE $policy$CREATE POLICY "Admins can publish embed videos" ON public.videos FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id AND public.jsvidey_is_admin()
        AND video_url IS NOT NULL AND video_url ~ '^https://' AND status = 'published')$policy$;
  ELSE
    RAISE NOTICE 'Admin guard belum tersedia; publishing tetap tertutup sampai migrasi admin diterapkan.';
  END IF;
END $$;


-- Update lookup RPCs while preserving the exact existing OUT-column shape.
-- This prevents PostgreSQL 42P13 and keeps thumbnail_url available on installations
-- that already use the 8-column / 7-column RPC signatures.
DO $$
DECLARE
  has_audience boolean;
  has_thumbnail boolean;
BEGIN
  IF to_regprocedure('public.get_public_embed_video(uuid)') IS NULL THEN
    EXECUTE $ddl$CREATE FUNCTION public.get_public_embed_video(p_video_id uuid)
      RETURNS TABLE (id uuid, title text, video_url text, status text, created_at timestamptz,
                     audience text, thumbnail_url text, slug text)
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $body$
        SELECT v.id, v.title, v.video_url, v.status, v.created_at, v.audience, v.thumbnail_url, v.slug
        FROM public.videos v WHERE v.id = p_video_id AND v.status = 'published'
          AND v.video_url IS NOT NULL
          AND (COALESCE(v.audience, 'public') = 'public' OR auth.uid() IS NOT NULL)
        LIMIT 1;
      $body$ $ddl$;
  ELSE
    SELECT ('audience' = ANY(COALESCE(p.proargnames, ARRAY[]::text[]))),
           ('thumbnail_url' = ANY(COALESCE(p.proargnames, ARRAY[]::text[])))
      INTO has_audience, has_thumbnail
    FROM pg_proc p WHERE p.oid = to_regprocedure('public.get_public_embed_video(uuid)');

    IF has_thumbnail THEN
      EXECUTE $ddl$CREATE OR REPLACE FUNCTION public.get_public_embed_video(p_video_id uuid)
        RETURNS TABLE (id uuid, title text, video_url text, status text, created_at timestamptz,
                       audience text, thumbnail_url text, slug text)
        LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $body$
          SELECT v.id, v.title, v.video_url, v.status, v.created_at, v.audience, v.thumbnail_url, v.slug
          FROM public.videos v WHERE v.id = p_video_id AND v.status = 'published'
            AND v.video_url IS NOT NULL
            AND (COALESCE(v.audience, 'public') = 'public' OR auth.uid() IS NOT NULL) LIMIT 1;
        $body$ $ddl$;
    ELSIF has_audience THEN
      EXECUTE $ddl$CREATE OR REPLACE FUNCTION public.get_public_embed_video(p_video_id uuid)
        RETURNS TABLE (id uuid, title text, video_url text, status text, created_at timestamptz, audience text)
        LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $body$
          SELECT v.id, v.title, v.video_url, v.status, v.created_at, v.audience
          FROM public.videos v WHERE v.id = p_video_id AND v.status = 'published'
            AND v.video_url IS NOT NULL
            AND (COALESCE(v.audience, 'public') = 'public' OR auth.uid() IS NOT NULL) LIMIT 1;
        $body$ $ddl$;
    ELSE
      EXECUTE $ddl$CREATE OR REPLACE FUNCTION public.get_public_embed_video(p_video_id uuid)
        RETURNS TABLE (id uuid, title text, video_url text, status text, created_at timestamptz)
        LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $body$
          SELECT v.id, v.title, v.video_url, v.status, v.created_at
          FROM public.videos v WHERE v.id = p_video_id AND v.status = 'published'
            AND v.video_url IS NOT NULL
            AND (COALESCE(v.audience, 'public') = 'public' OR auth.uid() IS NOT NULL) LIMIT 1;
        $body$ $ddl$;
    END IF;
  END IF;

  IF to_regprocedure('public.get_public_embed_video_by_slug(text)') IS NULL THEN
    EXECUTE $ddl$CREATE FUNCTION public.get_public_embed_video_by_slug(p_slug text)
      RETURNS TABLE (id uuid, title text, video_url text, status text, slug text,
                     audience text, thumbnail_url text)
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $body$
        SELECT v.id, v.title, v.video_url, v.status, v.slug, v.audience, v.thumbnail_url
        FROM public.videos v WHERE v.slug = p_slug AND v.status = 'published'
          AND v.video_url IS NOT NULL
            AND (COALESCE(v.audience, 'public') = 'public' OR auth.uid() IS NOT NULL) LIMIT 1;
      $body$ $ddl$;
  ELSE
    SELECT ('audience' = ANY(COALESCE(p.proargnames, ARRAY[]::text[]))),
           ('thumbnail_url' = ANY(COALESCE(p.proargnames, ARRAY[]::text[])))
      INTO has_audience, has_thumbnail
    FROM pg_proc p WHERE p.oid = to_regprocedure('public.get_public_embed_video_by_slug(text)');

    IF has_thumbnail THEN
      EXECUTE $ddl$CREATE OR REPLACE FUNCTION public.get_public_embed_video_by_slug(p_slug text)
        RETURNS TABLE (id uuid, title text, video_url text, status text, slug text,
                       audience text, thumbnail_url text)
        LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $body$
          SELECT v.id, v.title, v.video_url, v.status, v.slug, v.audience, v.thumbnail_url
          FROM public.videos v WHERE v.slug = p_slug AND v.status = 'published'
            AND v.video_url IS NOT NULL
            AND (COALESCE(v.audience, 'public') = 'public' OR auth.uid() IS NOT NULL) LIMIT 1;
        $body$ $ddl$;
    ELSIF has_audience THEN
      EXECUTE $ddl$CREATE OR REPLACE FUNCTION public.get_public_embed_video_by_slug(p_slug text)
        RETURNS TABLE (id uuid, title text, video_url text, status text, slug text, audience text)
        LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $body$
          SELECT v.id, v.title, v.video_url, v.status, v.slug, v.audience
          FROM public.videos v WHERE v.slug = p_slug AND v.status = 'published'
            AND v.video_url IS NOT NULL
            AND (COALESCE(v.audience, 'public') = 'public' OR auth.uid() IS NOT NULL) LIMIT 1;
        $body$ $ddl$;
    ELSE
      EXECUTE $ddl$CREATE OR REPLACE FUNCTION public.get_public_embed_video_by_slug(p_slug text)
        RETURNS TABLE (id uuid, title text, video_url text, status text, slug text)
        LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $body$
          SELECT v.id, v.title, v.video_url, v.status, v.slug
          FROM public.videos v WHERE v.slug = p_slug AND v.status = 'published'
            AND v.video_url IS NOT NULL
            AND (COALESCE(v.audience, 'public') = 'public' OR auth.uid() IS NOT NULL) LIMIT 1;
        $body$ $ddl$;
    END IF;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.get_public_embed_video(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_embed_video(uuid) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.get_public_embed_video_by_slug(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_embed_video_by_slug(text) TO anon, authenticated;

-- Add social tables only when absent; existing rows are preserved.
CREATE TABLE IF NOT EXISTS public.video_likes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  visitor_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (video_id, visitor_id)
);
CREATE TABLE IF NOT EXISTS public.video_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  visitor_id uuid NOT NULL,
  display_name text NOT NULL DEFAULT 'Pengunjung',
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.video_favorites (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, video_id)
);
CREATE INDEX IF NOT EXISTS video_comments_video_created_idx ON public.video_comments(video_id, created_at DESC);
CREATE INDEX IF NOT EXISTS video_favorites_user_created_idx ON public.video_favorites(user_id, created_at DESC);

ALTER TABLE public.video_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_favorites ENABLE ROW LEVEL SECURITY;

-- Likes: visitor identifiers are private, and only signed-in users may add/remove their own like.
DROP POLICY IF EXISTS "Public can read likes" ON public.video_likes;
DROP POLICY IF EXISTS "Public can add own like" ON public.video_likes;
DROP POLICY IF EXISTS "Members can add own like" ON public.video_likes;
DROP POLICY IF EXISTS "Public can remove own like" ON public.video_likes;
DROP POLICY IF EXISTS "Members can remove own like" ON public.video_likes;
-- All client writes go through the SECURITY DEFINER RPC below; no raw Like policies or grants remain.
REVOKE ALL ON public.video_likes FROM PUBLIC, anon, authenticated;
REVOKE SELECT (id, video_id, visitor_id, created_at) ON public.video_likes FROM PUBLIC, anon, authenticated;
DO $$
DECLARE seq_name text;
BEGIN
  seq_name := pg_get_serial_sequence('public.video_likes', 'id');
  IF seq_name IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM PUBLIC, anon, authenticated', seq_name::regclass);
  END IF;
END $$;

-- Comments are readable only on published video rows. Posting requires an authenticated owner ID.
DROP POLICY IF EXISTS "Public can read comments on published videos" ON public.video_comments;
CREATE POLICY "Public can read comments on published videos" ON public.video_comments
  FOR SELECT TO anon, authenticated USING (
    EXISTS (SELECT 1 FROM public.videos v WHERE v.id = video_id AND v.status = 'published'
      AND (v.audience = 'public' OR auth.uid() IS NOT NULL))
  );
DROP POLICY IF EXISTS "Public can comment on published videos" ON public.video_comments;
DROP POLICY IF EXISTS "Members can comment on published videos" ON public.video_comments;
CREATE POLICY "Members can comment on published videos" ON public.video_comments
  FOR INSERT TO authenticated WITH CHECK (
    visitor_id = auth.uid()
    AND char_length(body) BETWEEN 1 AND 1000
    AND char_length(display_name) BETWEEN 1 AND 40
    AND EXISTS (SELECT 1 FROM public.videos v WHERE v.id = video_id AND v.status = 'published'
      AND (v.audience = 'public' OR auth.uid() IS NOT NULL))
  );
REVOKE ALL ON public.video_comments FROM PUBLIC, anon, authenticated;
REVOKE SELECT (id, video_id, visitor_id, display_name, body, created_at) ON public.video_comments FROM PUBLIC, anon, authenticated;
REVOKE INSERT (id, video_id, visitor_id, display_name, body, created_at) ON public.video_comments FROM PUBLIC, anon, authenticated;
-- Never expose visitor_id through PostgREST; video_id remains selectable for filters.
GRANT SELECT (id, video_id, display_name, body, created_at) ON public.video_comments TO anon, authenticated;
GRANT INSERT (video_id, visitor_id, display_name, body) ON public.video_comments TO authenticated;

-- Favorites remain private to the signed-in owner.
DROP POLICY IF EXISTS "Users read own favorites" ON public.video_favorites;
CREATE POLICY "Users read own favorites" ON public.video_favorites FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users add own favorites" ON public.video_favorites;
CREATE POLICY "Users add own favorites" ON public.video_favorites FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users remove own favorites" ON public.video_favorites;
CREATE POLICY "Users remove own favorites" ON public.video_favorites FOR DELETE TO authenticated USING (auth.uid() = user_id);
REVOKE ALL ON public.video_favorites FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.video_favorites TO authenticated;

-- Aggregate RPC exposes only count + the signed-in user's like state, not visitor IDs.
CREATE OR REPLACE FUNCTION public.get_video_like_state(p_video_id uuid)
RETURNS TABLE (like_count bigint, liked boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT
    (SELECT count(*) FROM public.video_likes l WHERE l.video_id = p_video_id),
    (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.video_likes l
      WHERE l.video_id = p_video_id AND l.visitor_id = auth.uid()))
  WHERE EXISTS (
    SELECT 1 FROM public.videos v WHERE v.id = p_video_id AND v.status = 'published'
      AND (v.audience = 'public' OR auth.uid() IS NOT NULL)
  );
$$;
REVOKE ALL ON FUNCTION public.get_video_like_state(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_video_like_state(uuid) TO anon, authenticated;

-- Idempotent Like mutation: callers can change only their own Like, without raw table grants.
CREATE OR REPLACE FUNCTION public.set_video_like(p_video_id uuid, p_liked boolean)
RETURNS TABLE (like_count bigint, liked boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE uid uuid;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN RAISE EXCEPTION 'Login diperlukan untuk memberi Like'; END IF;
  IF p_video_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.videos v
    WHERE v.id = p_video_id AND v.status = 'published'
      AND (coalesce(v.audience, 'public') = 'public' OR uid IS NOT NULL)
  ) THEN RAISE EXCEPTION 'Video tidak tersedia untuk Like'; END IF;

  IF coalesce(p_liked, false) THEN
    INSERT INTO public.video_likes(video_id, visitor_id)
    VALUES (p_video_id, uid)
    ON CONFLICT (video_id, visitor_id) DO NOTHING;
  ELSE
    DELETE FROM public.video_likes l WHERE l.video_id = p_video_id AND l.visitor_id = uid;
  END IF;

  RETURN QUERY SELECT
    (SELECT count(*)::bigint FROM public.video_likes l WHERE l.video_id = p_video_id),
    EXISTS(SELECT 1 FROM public.video_likes l WHERE l.video_id = p_video_id AND l.visitor_id = uid);
END;
$$;
REVOKE ALL ON FUNCTION public.set_video_like(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_video_like(uuid, boolean) TO authenticated;

-- Preserve the existing row-visibility model while preventing broad anon table reads.
DROP POLICY IF EXISTS "Public can read published videos" ON public.videos;
DROP POLICY IF EXISTS "Anon can read public published videos" ON public.videos;
DROP POLICY IF EXISTS "Members can read all published videos" ON public.videos;
CREATE POLICY "Anon can read public published videos" ON public.videos FOR SELECT TO anon
  USING (status = 'published' AND audience = 'public');
CREATE POLICY "Members can read all published videos" ON public.videos FOR SELECT TO authenticated
  USING (status = 'published');

CREATE INDEX IF NOT EXISTS videos_audience_status_created_idx ON public.videos(audience, status, created_at DESC);
