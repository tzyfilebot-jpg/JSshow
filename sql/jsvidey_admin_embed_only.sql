-- Jsvidey admin-only embed publishing. Run after jsvidey_dashboard.sql and jsvidey_admin_control_center.sql.
-- Video files are never uploaded by this workflow; only HTTPS embed URLs are stored.
-- Remove creator/member INSERT policy and grant INSERT only when the authenticated user is an admin.
DROP POLICY IF EXISTS "Creators can add their own videos" ON public.videos;
DROP POLICY IF EXISTS "Creators can update their own videos" ON public.videos;
DROP POLICY IF EXISTS "Creators can delete their own videos" ON public.videos;
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
REVOKE INSERT, UPDATE, DELETE ON public.videos FROM PUBLIC, anon, authenticated;
GRANT INSERT ON public.videos TO authenticated;
