-- JSVidey targeted recovery after the social-interactions migration.
-- Run in Supabase SQL Editor. Review/back up your database first.
-- This preserves existing rows and allows Basic/public, members, VIP, and Premium values.

ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS thumbnail_url text;
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'public';

ALTER TABLE public.videos DROP CONSTRAINT IF EXISTS videos_audience_check;
UPDATE public.videos SET audience = 'public'
WHERE audience IS NULL OR audience NOT IN ('public','members','vip','premium');
ALTER TABLE public.videos ADD CONSTRAINT videos_audience_check
  CHECK (audience IN ('public','members','vip','premium'));

-- Restore common provider thumbnails only where thumbnail_url is currently empty.
UPDATE public.videos v
SET thumbnail_url = CASE
  WHEN v.video_url ~* '(^|//)(www\\.)?(youtube\\.com|youtube-nocookie\\.com|youtu\\.be)/' THEN
    'https://i.ytimg.com/vi/' ||
    (regexp_match(v.video_url, '(?:youtube-nocookie\\.com/embed/|youtube\\.com/embed/|youtube\\.com/shorts/|youtube\\.com/live/|youtu\\.be/)([A-Za-z0-9_-]+)'))[1] || '/hqdefault.jpg'
  WHEN v.video_url ~* 'drive\\.google\\.com/file/d/' THEN
    'https://drive.google.com/thumbnail?id=' ||
    (regexp_match(v.video_url, 'drive\\.google\\.com/file/d/([^/?#]+)'))[1] || '&sz=w1000'
  ELSE v.thumbnail_url
END
WHERE (v.thumbnail_url IS NULL OR btrim(v.thumbnail_url) = '')
  AND (v.video_url ~* '(youtube\\.com|youtube-nocookie\\.com|youtu\\.be)' OR v.video_url ~* 'drive\\.google\\.com/file/d/');

-- Ensure the public-safe catalogue returns thumbnail_url. This is metadata only.
CREATE OR REPLACE FUNCTION public.jsvidey_catalog_videos()
RETURNS TABLE(id uuid, slug text, title text, created_at timestamptz, status text,
              category text, audience text, thumbnail_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT v.id, v.slug, v.title, v.created_at, v.status,
         COALESCE(v.category, 'Trending'), COALESCE(v.audience, 'public'), v.thumbnail_url
  FROM public.videos v
  WHERE v.status = 'published'
  ORDER BY v.created_at DESC
  LIMIT 300;
$$;
REVOKE ALL ON FUNCTION public.jsvidey_catalog_videos() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.jsvidey_catalog_videos() TO anon, authenticated;

-- If your categories explicitly encode tiers, you may restore those labels manually after
-- checking rows. Do not run blindly: audience='public' may be legitimate.
-- SELECT id, title, category, audience FROM public.videos
-- WHERE lower(coalesce(category,'')) LIKE 'server%';
