-- Jsvidey platform expansion (non-destructive migration)
-- Keep existing tables and rows. Back up database before running.

alter table public.videos add column if not exists audience text not null default 'public';
update public.videos set audience='public' where audience is null or audience not in ('public','members');
alter table public.videos drop constraint if exists videos_audience_check;
alter table public.videos add constraint videos_audience_check check (audience in ('public','members'));
create index if not exists videos_audience_status_created_idx on public.videos(audience,status,created_at desc);

-- Anonymous visitors see only public published videos. Authenticated members can see all published videos.
drop policy if exists "Public can read published videos" on public.videos;
drop policy if exists "Anon can read public published videos" on public.videos;
drop policy if exists "Members can read all published videos" on public.videos;
create policy "Anon can read public published videos" on public.videos for select to anon
  using (status='published' and audience='public');
create policy "Members can read all published videos" on public.videos for select to authenticated
  using (status='published');
-- Keep the public surface column-limited even when this migration is re-run.
revoke all on public.videos from public, anon, authenticated;
revoke select (user_id, updated_at, storage_key, file_size_bytes) on public.videos from public, anon, authenticated;
grant select (id, title, video_url, status, created_at, category, thumbnail_url, slug, audience)
  on public.videos to anon;
grant select (id, title, video_url, status, created_at, category, thumbnail_url, slug, audience)
  on public.videos to authenticated;
-- Publishing is restricted to the admin-only INSERT policy; updates/deletes use admin RPCs.
revoke update, delete on public.videos from public, anon, authenticated;
grant insert on public.videos to authenticated;

-- RPC used by watch page: public videos are readable by everyone; member videos require auth.
-- Older deployments may have the 5-column version. Drop only that legacy signature shape;
-- new installs already use the 6-column return shape and keep dependencies intact.
DO $$
BEGIN
  IF to_regprocedure('public.get_public_embed_video_by_slug(text)') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_proc p WHERE p.oid = to_regprocedure('public.get_public_embed_video_by_slug(text)')
         AND 'audience' = ANY(COALESCE(p.proargnames, ARRAY[]::text[]))
     ) THEN
    EXECUTE 'DROP FUNCTION public.get_public_embed_video_by_slug(text)';
  END IF;
END $$;
create or replace function public.get_public_embed_video_by_slug(p_slug text)
returns table (id uuid,title text,video_url text,status text,slug text,audience text)
language sql stable security definer set search_path = '' as $$
  select v.id,v.title,v.video_url,v.status,v.slug,v.audience
  from public.videos v
  where v.slug=p_slug and v.status='published' and v.video_url is not null
    and (v.audience='public' or auth.uid() is not null)
  limit 1;
$$;
revoke all on function public.get_public_embed_video_by_slug(text) from public;
grant execute on function public.get_public_embed_video_by_slug(text) to anon, authenticated;

DO $$
BEGIN
  IF to_regprocedure('public.get_public_embed_video(uuid)') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_proc p WHERE p.oid = to_regprocedure('public.get_public_embed_video(uuid)')
         AND 'audience' = ANY(COALESCE(p.proargnames, ARRAY[]::text[]))
     ) THEN
    EXECUTE 'DROP FUNCTION public.get_public_embed_video(uuid)';
  END IF;
END $$;
create or replace function public.get_public_embed_video(p_video_id uuid)
returns table (id uuid,title text,video_url text,status text,created_at timestamptz,audience text)
language sql stable security definer set search_path = '' as $$
  select v.id,v.title,v.video_url,v.status,v.created_at,v.audience
  from public.videos v
  where v.id=p_video_id and v.status='published' and v.video_url is not null
    and (v.audience='public' or auth.uid() is not null)
  limit 1;
$$;
revoke all on function public.get_public_embed_video(uuid) from public;
grant execute on function public.get_public_embed_video(uuid) to anon, authenticated;

-- Likes and comments require a signed-in account; sharing remains a browser-side action.
drop policy if exists "Public can read comments on published videos" on public.video_comments;
create policy "Public can read comments on published videos" on public.video_comments
  for select to anon, authenticated using (
    exists(select 1 from public.videos v where v.id=video_id and v.status='published'
      and (coalesce(v.audience,'public')='public' or auth.uid() is not null))
  );
drop policy if exists "Public can comment on published videos" on public.video_comments;
drop policy if exists "Members can comment on published videos" on public.video_comments;
create policy "Members can comment on published videos" on public.video_comments for insert to authenticated
with check (visitor_id=auth.uid() and char_length(body) between 1 and 1000 and char_length(display_name) between 1 and 40
  and exists(select 1 from public.videos v where v.id=video_id and v.status='published' and (coalesce(v.audience,'public')='public' or auth.uid() is not null)));
revoke all on public.video_comments from public, anon, authenticated;
revoke select (id, video_id, visitor_id, display_name, body, created_at) on public.video_comments from public, anon, authenticated;
revoke insert (id, video_id, visitor_id, display_name, body, created_at) on public.video_comments from public, anon, authenticated;
grant select (id, video_id, display_name, body, created_at) on public.video_comments to anon, authenticated;
grant insert (video_id, visitor_id, display_name, body) on public.video_comments to authenticated;

-- Add a public-safe view of display configuration. Only admin RPC may change config.
create or replace function public.jsvidey_public_platform_status()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'maintenance_enabled', coalesce((settings->>'maintenance_enabled')::boolean,false),
    'maintenance_message', coalesce(settings->>'maintenance_message','Kami sedang melakukan pemeliharaan.'),
    'registration_enabled', coalesce((settings->>'registration_enabled')::boolean,true),
    'max_upload_mb', coalesce((settings->>'max_upload_mb')::integer,20),
    'ads_enabled', coalesce((settings->>'ads_enabled')::boolean,false),
    'pre_roll', coalesce(settings->>'pre_roll','off'),
    'mid_roll_seconds', coalesce((settings->>'mid_roll_seconds')::integer,300),
    'ad_guest_enabled', coalesce((settings->>'ad_guest_enabled')::boolean,true),
    'ad_member_enabled', coalesce((settings->>'ad_member_enabled')::boolean,true),
    'ad_frequency_seconds', coalesce((settings->>'ad_frequency_seconds')::integer,90),
    'ad_top_code', coalesce(settings->>'ad_top_code',''),
    'ad_bottom_code', coalesce(settings->>'ad_bottom_code',''),
    'ad_overlay_code', coalesce(settings->>'ad_overlay_code',''),
    'ad_slide_code', coalesce(settings->>'ad_slide_code',''),
    'ad_popunder_code', coalesce(settings->>'ad_popunder_code',''),
    'ad_social_code', coalesce(settings->>'ad_social_code',''),
    'promo_enabled', coalesce((settings->>'promo_enabled')::boolean,false),
    'promo_type', coalesce(settings->>'promo_type','ticker'),
    'promo_text', coalesce(settings->>'promo_text',''),
    'promo_url', coalesce(settings->>'promo_url',''),
    'promo_delay_seconds', coalesce((settings->>'promo_delay_seconds')::integer,8),
    'promo_frequency_minutes', coalesce((settings->>'promo_frequency_minutes')::integer,20),
    'promo_guest_enabled', coalesce((settings->>'promo_guest_enabled')::boolean,true),
    'promo_member_enabled', coalesce((settings->>'promo_member_enabled')::boolean,true),
    'promo_closeable', coalesce((settings->>'promo_closeable')::boolean,true)
  ) from public.jsvidey_platform_config where singleton=true;
$$;
revoke all on function public.jsvidey_public_platform_status() from public;
grant execute on function public.jsvidey_public_platform_status() to anon, authenticated;

-- Extend config JSON with safe defaults without overwriting existing settings.
update public.jsvidey_platform_config set settings = settings || jsonb_build_object(
  'ad_guest_enabled', coalesce((settings->>'ad_guest_enabled')::boolean,true),
  'ad_member_enabled', coalesce((settings->>'ad_member_enabled')::boolean,true),
  'ad_frequency_seconds', coalesce((settings->>'ad_frequency_seconds')::integer,90),
  'ad_top_code', coalesce(settings->>'ad_top_code',''),
  'ad_bottom_code', coalesce(settings->>'ad_bottom_code',''),
  'ad_overlay_code', coalesce(settings->>'ad_overlay_code',''),
  'ad_slide_code', coalesce(settings->>'ad_slide_code',''),
  'ad_popunder_code', coalesce(settings->>'ad_popunder_code',''),
  'ad_social_code', coalesce(settings->>'ad_social_code',''),
  'promo_enabled', coalesce((settings->>'promo_enabled')::boolean,false),
  'promo_type', coalesce(settings->>'promo_type','ticker'),
  'promo_text', coalesce(settings->>'promo_text',''),
  'promo_url', coalesce(settings->>'promo_url',''),
  'promo_delay_seconds', coalesce((settings->>'promo_delay_seconds')::integer,8),
  'promo_frequency_minutes', coalesce((settings->>'promo_frequency_minutes')::integer,20),
  'promo_guest_enabled', coalesce((settings->>'promo_guest_enabled')::boolean,true),
  'promo_member_enabled', coalesce((settings->>'promo_member_enabled')::boolean,true),
  'promo_closeable', coalesce((settings->>'promo_closeable')::boolean,true)
) where singleton=true;

-- Add audience to admin dashboard payload, preserving all other dashboard fields.
create or replace function public.jsvidey_admin_dashboard()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if not public.jsvidey_is_admin() then raise exception 'Admin access required'; end if;
  select jsonb_build_object(
    'users', (select coalesce(jsonb_agg(jsonb_build_object('id',u.id,'email',u.email,'username',p.username,'display_name',p.display_name,'created_at',u.created_at,'banned_until',u.banned_until,'is_admin',exists(select 1 from public.jsvidey_admins a where a.user_id=u.id)) order by u.created_at desc),'[]'::jsonb) from auth.users u left join public.profiles p on p.id=u.id),
    'videos', (select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'title',v.title,'video_url',v.video_url,'storage_key',v.storage_key,'file_size_bytes',v.file_size_bytes,'status',v.status,'audience',v.audience,'created_at',v.created_at,'user_id',v.user_id,'username',p.username,'email',u.email) order by v.created_at desc),'[]'::jsonb) from public.videos v left join public.profiles p on p.id=v.user_id left join auth.users u on u.id=v.user_id),
    'withdrawals', (select coalesce(jsonb_agg(jsonb_build_object('id',w.id,'user_id',w.user_id,'username',p.username,'email',u.email,'amount_idr',w.amount_idr,'payout_method',w.payout_method,'payout_details',w.payout_details,'status',w.status,'admin_note',w.admin_note,'created_at',w.created_at) order by w.created_at desc),'[]'::jsonb) from public.withdraw_requests w left join public.profiles p on p.id=w.user_id left join auth.users u on u.id=w.user_id),
    'earnings', (select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'user_id',e.user_id,'amount_idr',e.amount_idr,'views',e.views,'cpm_idr',e.cpm_idr,'created_at',e.created_at) order by e.created_at desc),'[]'::jsonb) from public.creator_earnings e),
    'notifications', (select coalesce(jsonb_agg(jsonb_build_object('id',n.id,'title',n.title,'body',n.body,'target_user_id',n.target_user_id,'created_at',n.created_at) order by n.created_at desc),'[]'::jsonb) from (select * from public.jsvidey_notifications order by created_at desc limit 30) n),
    'config', (select settings from public.jsvidey_platform_config where singleton=true),
    'counts', jsonb_build_object('users',(select count(*) from auth.users),'videos',(select count(*) from public.videos),'pending_withdrawals',(select count(*) from public.withdraw_requests where status='pending'),'revenue',(select coalesce(sum(amount_idr),0) from public.creator_earnings),'views',(select coalesce(sum(views),0) from public.creator_earnings),'avg_cpm',(select coalesce(avg(cpm_idr),0) from public.creator_earnings))
  ) into result;
  return result;
end;
$$;
revoke all on function public.jsvidey_admin_dashboard() from public, anon;
grant execute on function public.jsvidey_admin_dashboard() to authenticated;
