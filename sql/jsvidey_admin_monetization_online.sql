-- Jsvidey admin monetization and online-session expansion
-- Run after sql/jsvidey_video_platform_expansion.sql
begin;
create table if not exists public.jsvidey_active_sessions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  page text not null default ''
);
alter table public.jsvidey_active_sessions enable row level security;
revoke all on public.jsvidey_active_sessions from anon, authenticated;
create or replace function public.jsvidey_touch_active_session(p_page text default '')
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return false; end if;
  insert into public.jsvidey_active_sessions(user_id,last_seen_at,page)
  values(auth.uid(),now(),left(coalesce(p_page,''),120))
  on conflict(user_id) do update set last_seen_at=now(),page=excluded.page;
  return true;
end; $$;
revoke all on function public.jsvidey_touch_active_session(text) from public, anon;
grant execute on function public.jsvidey_touch_active_session(text) to authenticated;
create or replace function public.jsvidey_admin_online_summary()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if not public.jsvidey_is_admin() then raise exception 'Admin access required'; end if;
  delete from public.jsvidey_active_sessions where last_seen_at < now() - interval '5 minutes';
  select count(*) into n from public.jsvidey_active_sessions where last_seen_at >= now() - interval '2 minutes';
  return jsonb_build_object('online_users',n,'checked_at',now());
end; $$;
revoke all on function public.jsvidey_admin_online_summary() from public, anon;
grant execute on function public.jsvidey_admin_online_summary() to authenticated;
create or replace function public.jsvidey_public_platform_status()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'max_upload_mb', coalesce((settings->>'max_upload_mb')::integer,20),
    'default_cpm_idr', coalesce((settings->>'default_cpm_idr')::numeric,10000),
    'creator_share_percent', coalesce((settings->>'creator_share_percent')::numeric,60),
    'vip_price_idr', coalesce((settings->>'vip_price_idr')::numeric,50000),
    'vip_qr_url', coalesce(settings->>'vip_qr_url',''),
    'vip_cashi_receiver', coalesce(settings->>'vip_cashi_receiver',''),
    'maintenance_enabled', coalesce((settings->>'maintenance_enabled')::boolean,false),
    'maintenance_message', coalesce(settings->>'maintenance_message','Kami sedang melakukan pemeliharaan.'),
    'registration_enabled', coalesce((settings->>'registration_enabled')::boolean,true),
    'ads_enabled', coalesce((settings->>'ads_enabled')::boolean,false),
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
    'promo_image_url', coalesce(settings->>'promo_image_url',''),
    'promo_delay_seconds', coalesce((settings->>'promo_delay_seconds')::integer,8),
    'promo_frequency_minutes', coalesce((settings->>'promo_frequency_minutes')::integer,20),
    'promo_guest_enabled', coalesce((settings->>'promo_guest_enabled')::boolean,true),
    'promo_member_enabled', coalesce((settings->>'promo_member_enabled')::boolean,true),
    'promo_closeable', coalesce((settings->>'promo_closeable')::boolean,true)
  ) from public.jsvidey_platform_config where singleton=true;
$$;
revoke all on function public.jsvidey_public_platform_status() from public;
grant execute on function public.jsvidey_public_platform_status() to anon, authenticated;
update public.jsvidey_platform_config set settings=settings || jsonb_build_object('promo_image_url',coalesce(settings->>'promo_image_url','')) where singleton=true;
commit;
