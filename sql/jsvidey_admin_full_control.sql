-- Jsvidey full admin controls: online visitors, per-page access, and membership review notes.
-- Apply after admin-control, nav-menu, dashboard_vip, payment_orders, Cashi integration, and monetization migrations.
begin;

create table if not exists public.jsvidey_live_visitors (
  session_id uuid primary key,
  user_id uuid references auth.users(id) on delete set null,
  page text not null default '',
  last_seen_at timestamptz not null default now()
);
create index if not exists jsvidey_live_visitors_seen_idx on public.jsvidey_live_visitors(last_seen_at desc);

-- Each editable navbar category/server can be assigned a minimum membership tier.
alter table public.jsvidey_nav_menu add column if not exists required_plan text not null default 'basic';
update public.jsvidey_nav_menu set required_plan='vip' where menu_type='server' and required_plan='basic';
alter table public.jsvidey_nav_menu drop constraint if exists jsvidey_nav_menu_required_plan_check;
alter table public.jsvidey_nav_menu add constraint jsvidey_nav_menu_required_plan_check
  check (required_plan in ('basic','vip','premium'));

alter table public.jsvidey_live_visitors enable row level security;
revoke all on public.jsvidey_live_visitors from public, anon, authenticated;

create or replace function public.jsvidey_touch_visitor(p_session_id uuid, p_page text default '')
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_session_id is null then return false; end if;
  insert into public.jsvidey_live_visitors(session_id,user_id,page,last_seen_at)
  values(p_session_id,auth.uid(),left(coalesce(p_page,''),180),now())
  on conflict(session_id) do update
    set user_id=excluded.user_id,
        page=excluded.page,last_seen_at=now();
  return true;
end;
$$;
revoke all on function public.jsvidey_touch_visitor(uuid,text) from public;
grant execute on function public.jsvidey_touch_visitor(uuid,text) to anon, authenticated;

create or replace function public.jsvidey_admin_online_summary()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare total_n integer; member_n integer; guest_n integer; pages jsonb;
begin
  if not public.jsvidey_is_admin() then raise exception 'Admin access required'; end if;
  delete from public.jsvidey_live_visitors where last_seen_at < now() - interval '10 minutes';
  select count(*), count(*) filter (where user_id is not null), count(*) filter (where user_id is null)
    into total_n,member_n,guest_n
    from public.jsvidey_live_visitors where last_seen_at >= now() - interval '2 minutes';
  select coalesce(jsonb_object_agg(page,total), '{}'::jsonb) into pages from (
    select coalesce(nullif(page,''),'unknown') as page,count(*) as total
    from public.jsvidey_live_visitors where last_seen_at >= now() - interval '2 minutes'
    group by coalesce(nullif(page,''),'unknown')
  ) q;
  return jsonb_build_object('online_users',coalesce(total_n,0),'online_members',coalesce(member_n,0),
    'online_guests',coalesce(guest_n,0),'pages',coalesce(pages,'{}'::jsonb),'checked_at',now());
end;
$$;
revoke all on function public.jsvidey_admin_online_summary() from public, anon;
grant execute on function public.jsvidey_admin_online_summary() to authenticated;

create or replace function public.jsvidey_admin_update_video_access(p_video_id uuid,p_access text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare normalized text;
begin
  if not public.jsvidey_is_admin() then raise exception 'Admin access required'; end if;
  normalized := lower(trim(coalesce(p_access,'')));
  normalized := case normalized when 'basic' then 'members' when 'free' then 'members' when 'all' then 'public' else normalized end;
  if normalized not in ('public','members','vip','premium') then raise exception 'Akses media harus Semua, Basic, VIP, atau Premium'; end if;
  update public.videos set audience=normalized where id=p_video_id;
  if not found then raise exception 'Media tidak ditemukan'; end if;
  return jsonb_build_object('ok',true,'video_id',p_video_id,'audience',normalized);
end;
$$;
revoke all on function public.jsvidey_admin_update_video_access(uuid,text) from public, anon;
grant execute on function public.jsvidey_admin_update_video_access(uuid,text) to authenticated;

-- Public-safe configuration: no private credentials are returned.
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
    'ad_bottom_code',coalesce(settings->>'ad_bottom_code',''),
    'ad_overlay_code',coalesce(settings->>'ad_overlay_code',''),
    'ad_slide_code',coalesce(settings->>'ad_slide_code',''),
    'ad_popunder_code',coalesce(settings->>'ad_popunder_code',''),
    'ad_social_code',coalesce(settings->>'ad_social_code',''),
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

-- Require a reviewer reason; only submitted proofs or Cashi SETTLED orders can be reviewed.
create or replace function public.jsvidey_admin_review_payment(p_order_id uuid,p_approve boolean,p_note text default null)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare o public.jsvidey_payment_orders%rowtype; v_expiry timestamptz; v_base timestamptz; clean_note text;
begin
  if not public.jsvidey_is_admin() then raise exception 'Admin access required'; end if;
  clean_note:=left(trim(coalesce(p_note,'')),500);
  if char_length(clean_note)<3 then raise exception 'Alasan persetujuan atau penolakan wajib diisi'; end if;
  select * into o from public.jsvidey_payment_orders where id=p_order_id for update;
  if not found then raise exception 'Pesanan tidak ditemukan'; end if;
  if not (o.status='pending_review' or (o.status='awaiting_payment' and upper(coalesce(o.cashi_provider_status,''))='SETTLED')) then raise exception 'Pembayaran harus mengirim bukti atau berstatus Cashi SETTLED sebelum diproses'; end if;
  if p_approve and upper(coalesce(o.cashi_provider_status,''))<>'SETTLED' and char_length(trim(coalesce(o.proof_reference,'')))<3 then raise exception 'Pembayaran belum terverifikasi: pastikan Cashi SETTLED atau bukti pembayaran sudah dikirim'; end if;
  if not p_approve then
    update public.jsvidey_payment_orders set status='rejected',admin_note=clean_note,updated_at=now() where id=o.id;
    return jsonb_build_object('id',o.id,'status','rejected','admin_note',clean_note);
  end if;
  if o.package='premium' then
    update public.profiles set plan='premium',plan_expires_at=null where id=o.user_id;
  else
    select case when lower(coalesce(plan,''))='vip' and plan_expires_at>now() then plan_expires_at else now() end
      into v_base from public.profiles where id=o.user_id for update;
    v_base:=coalesce(v_base,now());
    v_expiry:=v_base+case o.package when 'vip1' then interval '1 day' when 'vip3' then interval '3 days'
      when 'vip5' then interval '5 days' when 'vip7' then interval '7 days' else interval '7 days' end;
    update public.profiles set plan='vip',plan_expires_at=v_expiry where id=o.user_id;
  end if;
  update public.jsvidey_payment_orders set status='approved',admin_note=clean_note,updated_at=now() where id=o.id;
  return jsonb_build_object('id',o.id,'status','approved','package',o.package,'admin_note',clean_note);
end;
$$;
revoke all on function public.jsvidey_admin_review_payment(uuid,boolean,text) from public, anon;
grant execute on function public.jsvidey_admin_review_payment(uuid,boolean,text) to authenticated;

commit;
