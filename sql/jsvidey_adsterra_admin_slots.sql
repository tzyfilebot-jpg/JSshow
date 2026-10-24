-- Run this migration in Supabase SQL Editor after the existing JSSHOW admin/full-control migrations.
-- Adds public-safe ad placement settings to the platform status RPC.
create or replace function public.jsvidey_public_platform_status()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'maintenance_enabled',coalesce((settings->>'maintenance_enabled')::boolean,false),
    'maintenance_message',coalesce(settings->>'maintenance_message','Kami sedang melakukan pemeliharaan.'),
    'registration_enabled',coalesce((settings->>'registration_enabled')::boolean,true),
    'max_upload_mb',coalesce((settings->>'max_upload_mb')::integer,20),
    'default_cpm_idr',coalesce((settings->>'default_cpm_idr')::numeric,10000),
    'creator_share_percent',coalesce((settings->>'creator_share_percent')::numeric,60),
    'vip_price_idr',coalesce((settings->>'vip_price_idr')::numeric,50000),
    'vip_qr_url',coalesce(settings->>'vip_qr_url',''),
    'vip_cashi_receiver',coalesce(settings->>'vip_cashi_receiver',''),
    'ads_enabled',coalesce((settings->>'ads_enabled')::boolean,false),
    'ad_guest_enabled',coalesce((settings->>'ad_guest_enabled')::boolean,true),
    'ad_member_enabled',coalesce((settings->>'ad_member_enabled')::boolean,true),
    'ad_frequency_seconds',coalesce((settings->>'ad_frequency_seconds')::integer,90),
    'pre_roll',coalesce(settings->>'pre_roll','off'),
    'mid_roll_seconds',coalesce((settings->>'mid_roll_seconds')::integer,300),
    'ad_tag_url',coalesce(settings->>'ad_tag_url',''),
    'ad_top_code',coalesce(settings->>'ad_top_code',''),
    'ad_mobile_banner_code',coalesce(settings->>'ad_mobile_banner_code',''),
    'ad_banner468_code',coalesce(settings->>'ad_banner468_code',''),
    'ad_bottom_code',coalesce(settings->>'ad_bottom_code',''),
    'ad_overlay_code',coalesce(settings->>'ad_overlay_code',''),
    'ad_slide_code',coalesce(settings->>'ad_slide_code',''),
    'ad_popunder_code',coalesce(settings->>'ad_popunder_code',''),
    'ad_social_code',coalesce(settings->>'ad_social_code',''),
    'ad_side_left_code',coalesce(settings->>'ad_side_left_code',''),
    'ad_side_right_code',coalesce(settings->>'ad_side_right_code',''),
    'ad_mobile_right_code',coalesce(settings->>'ad_mobile_right_code',''),
    'ad_inline_container_code',coalesce(settings->>'ad_inline_container_code',''),
    'ad_inline_rect_code',coalesce(settings->>'ad_inline_rect_code',''),
    'ad_inline_extra_code',coalesce(settings->>'ad_inline_extra_code',''),
    'ad_auto_code',coalesce(settings->>'ad_auto_code',''),
    'ad_direct_url',coalesce(settings->>'ad_direct_url',''),
    'promo_enabled',coalesce((settings->>'promo_enabled')::boolean,false),
    'promo_type',coalesce(settings->>'promo_type','ticker'),
    'promo_text',coalesce(settings->>'promo_text',''),
    'promo_url',coalesce(settings->>'promo_url',''),
    'promo_image_url',coalesce(settings->>'promo_image_url',''),
    'promo_delay_seconds',coalesce((settings->>'promo_delay_seconds')::integer,8),
    'promo_frequency_minutes',coalesce((settings->>'promo_frequency_minutes')::integer,20),
    'promo_guest_enabled',coalesce((settings->>'promo_guest_enabled')::boolean,true),
    'promo_member_enabled',coalesce((settings->>'promo_member_enabled')::boolean,true),
    'promo_closeable',coalesce((settings->>'promo_closeable')::boolean,true),
    'page_controls',coalesce(settings->'page_controls','{}'::jsonb)
  ) from public.jsvidey_platform_config where singleton=true;
$$;
revoke all on function public.jsvidey_public_platform_status() from public;
grant execute on function public.jsvidey_public_platform_status() to anon, authenticated;
