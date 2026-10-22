-- Jsvidey admin-only embed publishing. Run after js videy dashboard and admin control center migrations.
-- Video files are never uploaded by this workflow; only HTTPS embed URLs are stored.
-- Remove creator/member INSERT policy and grant INSERT only when the authenticated user is an admin.
DROP POLICY IF EXISTS "Creators can add their own videos" ON public.videos;
DROP POLICY IF EXISTS "Admins can publish embed videos" ON public.videos;
CREATE POLICY "Admins can publish embed videos"
ON public.videos FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND public.jsvidey_is_admin()
  AND video_url IS NOT NULL
  AND video_url ~ '^https://'
  AND status = 'published'
);
REVOKE INSERT ON public.videos FROM anon;
GRANT INSERT ON public.videos TO authenticated;
