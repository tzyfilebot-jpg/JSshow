-- Jsshow catalog, thumbnail, announcements and VIP server access.
-- Run after js videy auth/catalog/admin migrations in Supabase SQL Editor.

alter table public.videos add column if not exists thumbnail_url text;
alter table public.videos add column if not exists category text not null default 'Trending';
alter table public.videos add column if not exists audience text not null default 'public';
alter table public.videos drop constraint if exists videos_audience_check;
alter table public.videos add constraint videos_audience_check check (audience in ('public','members','vip','premium'));
create index if not exists videos_category_status_created_idx on public.videos(category,status,created_at desc);

-- Server categories are VIP-only even if an admin accidentally chooses public/member audience.
drop policy if exists "Public can read published videos" on public.videos;
drop policy if exists "Creators can view their own videos" on public.videos;
drop policy if exists "Anon can read public published videos" on public.videos;
create policy "Anon can read public published videos" on public.videos for select to anon
using (status='published' and coalesce(audience,'public')='public' and coalesce(category,'') not ilike 'server%');

-- A regular logged-in member can read member videos, but only a VIP plan can read VIP rows.
-- The plan field is expected on public.profiles and is managed by trusted admin/payment flow.
drop policy if exists "Members can read all published videos" on public.videos;
drop policy if exists "Jsshow authenticated catalog access" on public.videos;
create policy "Jsshow authenticated catalog access" on public.videos for select to authenticated
using (
 status='published' and (
   (coalesce(audience,'public')='public' and coalesce(category,'') not ilike 'server%')
   or (coalesce(audience,'public')='members' and coalesce(category,'') not ilike 'server%' and auth.uid() is not null)
   or ((coalesce(audience,'public')='vip' or coalesce(category,'') ilike 'server%') and exists (
     select 1 from public.profiles p where p.id=auth.uid() and lower(coalesce(p.plan,'free')) in ('vip','premium','pro')
   ))
 )
);

-- Keep public catalog limited to public video metadata. Thumbnail is safe to display publicly.
revoke all on public.videos from public, anon, authenticated;
grant select (id,title,video_url,status,created_at,category,thumbnail_url,slug,audience) on public.videos to anon,authenticated;
-- Direct INSERT is granted to authenticated only; the RLS policy below limits publishing to admins.
revoke insert,update,delete on public.videos from anon,authenticated;
grant insert on public.videos to authenticated;
drop policy if exists "Admins can publish embed videos" on public.videos;
create policy "Admins can publish embed videos" on public.videos for insert to authenticated
with check (public.jsvidey_is_admin() and auth.uid()=user_id);

-- Secure direct watch RPCs too: knowing a video ID or slug does not bypass VIP access.
create or replace function public.get_public_embed_video(p_video_id uuid)
returns table (id uuid,title text,video_url text,status text,created_at timestamptz,audience text)
language sql stable security definer set search_path=public,auth as $$
 select v.id,v.title,v.video_url,v.status,v.created_at,v.audience
 from public.videos v
 where v.id=p_video_id and v.status='published' and v.video_url is not null
 and ((coalesce(v.audience,'public')='public' and coalesce(v.category,'') not ilike 'server%')
   or (auth.uid() is not null and coalesce(v.audience,'public')='members' and coalesce(v.category,'') not ilike 'server%')
   or (auth.uid() is not null and (coalesce(v.audience,'public')='vip' or coalesce(v.category,'') ilike 'server%') and exists(select 1 from public.profiles p where p.id=auth.uid() and lower(coalesce(p.plan,'free')) in ('vip','premium','pro')))
 );
$$;
revoke all on function public.get_public_embed_video(uuid) from public;
grant execute on function public.get_public_embed_video(uuid) to anon,authenticated;

create or replace function public.get_public_embed_video_by_slug(p_slug text)
returns table (id uuid,title text,video_url text,status text,slug text,audience text)
language sql stable security definer set search_path=public,auth as $$
 select v.id,v.title,v.video_url,v.status,v.slug,v.audience
 from public.videos v
 where v.slug=p_slug and v.status='published' and v.video_url is not null
 and ((coalesce(v.audience,'public')='public' and coalesce(v.category,'') not ilike 'server%')
   or (auth.uid() is not null and coalesce(v.audience,'public')='members' and coalesce(v.category,'') not ilike 'server%')
   or (auth.uid() is not null and (coalesce(v.audience,'public')='vip' or coalesce(v.category,'') ilike 'server%') and exists(select 1 from public.profiles p where p.id=auth.uid() and lower(coalesce(p.plan,'free')) in ('vip','premium','pro')))
 );
$$;
revoke all on function public.get_public_embed_video_by_slug(text) from public;
grant execute on function public.get_public_embed_video_by_slug(text) to anon,authenticated;

-- Existing admin notification workflow already inserts into this table; dashboard reads only broadcasts.
-- This policy is read-only for members and excludes targeted private messages from public pages.
alter table public.jsvidey_notifications enable row level security;
drop policy if exists "Jsshow members read broadcasts" on public.jsvidey_notifications;
create policy "Jsshow members read broadcasts" on public.jsvidey_notifications for select to authenticated
using (target_user_id is null or target_user_id=auth.uid());
grant select (id,title,body,target_user_id,created_at) on public.jsvidey_notifications to authenticated;

-- Refresh admin payload so the media table can preview thumbnails and member plans.
create or replace function public.jsvidey_admin_dashboard()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if not public.jsvidey_is_admin() then raise exception 'Admin access required'; end if;
  select jsonb_build_object(
    'users', (select coalesce(jsonb_agg(jsonb_build_object('id',u.id,'email',u.email,'username',p.username,'display_name',p.display_name,'plan',p.plan,'created_at',u.created_at,'banned_until',u.banned_until,'is_admin',exists(select 1 from public.jsvidey_admins a where a.user_id=u.id)) order by u.created_at desc),'[]'::jsonb) from auth.users u left join public.profiles p on p.id=u.id),
    'videos', (select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'title',v.title,'video_url',v.video_url,'storage_key',v.storage_key,'file_size_bytes',v.file_size_bytes,'status',v.status,'audience',v.audience,'category',v.category,'thumbnail_url',v.thumbnail_url,'created_at',v.created_at,'user_id',v.user_id,'username',p.username,'email',u.email) order by v.created_at desc),'[]'::jsonb) from public.videos v left join public.profiles p on p.id=v.user_id left join auth.users u on u.id=v.user_id),
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

-- Admin-only plan activation/deactivation after manually verifying Cashi payments.
create or replace function public.jsvidey_admin_set_plan(p_user_id uuid,p_plan text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare normalized text; expiry timestamptz;
begin
 if not public.jsvidey_is_admin() then raise exception 'Admin access required'; end if;
 normalized:=lower(trim(coalesce(p_plan,'basic')));
 if normalized not in ('basic','free','vip','vip_1d','vip_3d','vip_5d','vip_7d','premium','pro') then
   raise exception 'Paket harus Basic, VIP 1/3/5/7 Hari, atau Premium';
 end if;
 expiry:=case normalized when 'vip_1d' then now()+interval '1 day'
                         when 'vip_3d' then now()+interval '3 days'
                         when 'vip_5d' then now()+interval '5 days'
                         when 'vip_7d' then now()+interval '7 days'
                         when 'vip' then now()+interval '7 days'
                         else null end;
 normalized:=case when normalized in ('free','basic') then 'basic'
                   when normalized like 'vip%' then 'vip'
                   when normalized='pro' then 'premium' else normalized end;
 update public.profiles set plan=normalized,
   plan_expires_at=case when normalized='vip' then expiry else null end
 where id=p_user_id;
 if not found then raise exception 'Profil member tidak ditemukan'; end if;
 return jsonb_build_object('ok',true,'user_id',p_user_id,'plan',normalized,'plan_expires_at',expiry);
end; $$;
revoke all on function public.jsvidey_admin_set_plan(uuid,text) from public,anon;
grant execute on function public.jsvidey_admin_set_plan(uuid,text) to authenticated;

-- Public read-only subset of VIP purchase settings; secret platform settings are never returned.
create or replace function public.jsvidey_public_vip_config()
returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object(
   'vip_price_idr', coalesce((settings->>'vip_price_idr')::numeric,50000),
   'vip_qr_url', coalesce(settings->>'vip_qr_url',''),
   'vip_cashi_receiver', coalesce(settings->>'vip_cashi_receiver','')
 ) from public.jsvidey_platform_config where singleton=true
 union all
 select jsonb_build_object('vip_price_idr',50000,'vip_qr_url','','vip_cashi_receiver','')
 where not exists(select 1 from public.jsvidey_platform_config where singleton=true)
 limit 1;
$$;
revoke all on function public.jsvidey_public_vip_config() from public;
grant execute on function public.jsvidey_public_vip_config() to anon,authenticated;


-- Jsshow package and popularity rules (run after the existing dashboard/VIP migration).
-- Normalize historical plan labels, then allow Basic, VIP, and Premium consistently.
alter table public.profiles add column if not exists plan_expires_at timestamptz;
alter table public.profiles drop constraint if exists profiles_plan_check;
update public.profiles
set plan = case lower(coalesce(plan,'basic'))
  when 'free' then 'basic'
  when 'basic' then 'basic'
  when 'vip' then 'vip'
  when 'premium' then 'premium'
  when 'pro' then 'premium'
  else 'basic' end;
alter table public.profiles add constraint profiles_plan_check
  check (lower(plan) in ('basic','vip','premium','pro'));
alter table public.profiles alter column plan set default 'basic';

-- Allow all requested video access levels, preserving legacy member-only rows.
alter table public.videos drop constraint if exists videos_audience_check;
alter table public.videos add constraint videos_audience_check
  check (audience in ('public','members','vip','premium'));

-- Server content and premium-only content are checked on every database read / embed lookup.
drop policy if exists "Anon can read public published videos" on public.videos;
create policy "Anon can read public published videos" on public.videos
for select to anon
using (status='published' and coalesce(audience,'public')='public'
  and coalesce(category,'') not ilike 'server%');

drop policy if exists "Jsshow authenticated catalog access" on public.videos;
create policy "Jsshow authenticated catalog access" on public.videos
for select to authenticated
using (
 status='published' and (
   (coalesce(audience,'public')='public' and coalesce(category,'') not ilike 'server%')
   or (coalesce(audience,'public')='members' and coalesce(category,'') not ilike 'server%')
   or ((coalesce(audience,'public')='vip' or coalesce(category,'') ilike 'server%')
       and exists(select 1 from public.profiles p where p.id=auth.uid()
         and lower(coalesce(p.plan,'basic')) in ('vip','premium','pro')
         and (p.plan_expires_at is null or p.plan_expires_at > now())))
   or (coalesce(audience,'public')='premium'
       and exists(select 1 from public.profiles p where p.id=auth.uid()
         and lower(coalesce(p.plan,'basic')) in ('premium','pro')))
 )
);

create or replace function public.get_public_embed_video(p_video_id uuid)
returns table (id uuid,title text,video_url text,status text,created_at timestamptz,audience text)
language sql stable security definer set search_path=public,auth as $$
 select v.id,v.title,v.video_url,v.status,v.created_at,v.audience
 from public.videos v where v.id=p_video_id and v.status='published' and v.video_url is not null
 and (
   (coalesce(v.audience,'public')='public' and coalesce(v.category,'') not ilike 'server%')
   or (auth.uid() is not null and coalesce(v.audience,'public')='members' and coalesce(v.category,'') not ilike 'server%')
   or (auth.uid() is not null and (coalesce(v.audience,'public')='vip' or coalesce(v.category,'') ilike 'server%')
       and exists(select 1 from public.profiles p where p.id=auth.uid()
         and lower(coalesce(p.plan,'basic')) in ('vip','premium','pro')
         and (p.plan_expires_at is null or p.plan_expires_at > now())))
   or (auth.uid() is not null and coalesce(v.audience,'public')='premium'
       and exists(select 1 from public.profiles p where p.id=auth.uid()
         and lower(coalesce(p.plan,'basic')) in ('premium','pro')))
 );
$$;
revoke all on function public.get_public_embed_video(uuid) from public;
grant execute on function public.get_public_embed_video(uuid) to anon,authenticated;

create or replace function public.get_public_embed_video_by_slug(p_slug text)
returns table (id uuid,title text,video_url text,status text,slug text,audience text)
language sql stable security definer set search_path=public,auth as $$
 select v.id,v.title,v.video_url,v.status,v.slug,v.audience
 from public.videos v where v.slug=p_slug and v.status='published' and v.video_url is not null
 and (
   (coalesce(v.audience,'public')='public' and coalesce(v.category,'') not ilike 'server%')
   or (auth.uid() is not null and coalesce(v.audience,'public')='members' and coalesce(v.category,'') not ilike 'server%')
   or (auth.uid() is not null and (coalesce(v.audience,'public')='vip' or coalesce(v.category,'') ilike 'server%')
       and exists(select 1 from public.profiles p where p.id=auth.uid()
         and lower(coalesce(p.plan,'basic')) in ('vip','premium','pro')
         and (p.plan_expires_at is null or p.plan_expires_at > now())))
   or (auth.uid() is not null and coalesce(v.audience,'public')='premium'
       and exists(select 1 from public.profiles p where p.id=auth.uid()
         and lower(coalesce(p.plan,'basic')) in ('premium','pro')))
 );
$$;
revoke all on function public.get_public_embed_video_by_slug(text) from public;
grant execute on function public.get_public_embed_video_by_slug(text) to anon,authenticated;

-- Views are recorded by a security-definer RPC; clients cannot insert raw analytics rows.
create or replace function public.jsvidey_record_video_view(p_video_id uuid)
returns boolean language plpgsql security definer set search_path=public,auth as $$
declare v public.videos%rowtype; uid uuid;
begin
 select * into v from public.videos where id=p_video_id and status='published';
 if not found then return false; end if;
 uid:=auth.uid();
 if uid is null and (coalesce(v.audience,'public')<>'public' or coalesce(v.category,'') ilike 'server%') then return false; end if;
 if coalesce(v.audience,'public')='vip' or coalesce(v.category,'') ilike 'server%' then
   if not exists(select 1 from public.profiles p where p.id=uid and lower(coalesce(p.plan,'basic')) in ('vip','premium','pro') and (p.plan_expires_at is null or p.plan_expires_at>now())) then return false; end if;
 end if;
 if coalesce(v.audience,'public')='premium' and not exists(select 1 from public.profiles p where p.id=uid and lower(coalesce(p.plan,'basic')) in ('premium','pro')) then return false; end if;
 if uid is not null and exists(select 1 from public.video_views vv where vv.video_id=p_video_id and vv.viewer_id=uid and vv.viewed_at>now()-interval '30 minutes') then return true; end if;
 insert into public.video_views(video_id,creator_id,viewer_id,views,viewed_at)
 values(v.id,v.user_id,uid,1,now());
 return true;
end; $$;
revoke all on function public.jsvidey_record_video_view(uuid) from public;
grant execute on function public.jsvidey_record_video_view(uuid) to anon,authenticated;

drop function if exists public.jsvidey_top_videos(integer);
create function public.jsvidey_top_videos(p_limit integer default 10)
returns table(id uuid,slug text,title text,created_at timestamptz,status text,category text,audience text,thumbnail_url text,view_count bigint)
language sql stable security definer set search_path=public,auth as $$
 select v.id,v.slug,v.title,v.created_at,v.status,v.category,v.audience,v.thumbnail_url,
        coalesce(sum(vv.views),0)::bigint as view_count
 from public.videos v left join public.video_views vv on vv.video_id=v.id
 where v.status='published'
 group by v.id order by view_count desc,v.created_at desc limit greatest(1,least(coalesce(p_limit,10),10));
$$;
revoke all on function public.jsvidey_top_videos(integer) from public;
grant execute on function public.jsvidey_top_videos(integer) to anon,authenticated;

-- Safe catalogue RPC returns public metadata only, so Basic users can see locked VIP/Premium cards
-- without receiving provider embed URLs. The watch RPC remains the only source of playable URLs.
create or replace function public.jsvidey_catalog_videos()
returns table(id uuid,slug text,title text,created_at timestamptz,status text,category text,audience text,thumbnail_url text)
language sql stable security definer set search_path=public,auth as $$
 select v.id,v.slug,v.title,v.created_at,v.status,v.category,v.audience,v.thumbnail_url
 from public.videos v where v.status='published'
 and (coalesce(v.audience,'public') in ('public','members','vip','premium') or coalesce(v.category,'') ilike 'server%')
 order by v.created_at desc limit 300;
$$;
revoke all on function public.jsvidey_catalog_videos() from public;
grant execute on function public.jsvidey_catalog_videos() to anon,authenticated;

-- Admin can assign Basic, VIP, or Premium; optional expiry is assigned by package duration.
create or replace function public.jsvidey_admin_set_plan(p_user_id uuid,p_plan text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare normalized text;
begin
 if not public.jsvidey_is_admin() then raise exception 'Admin access required'; end if;
 normalized:=lower(trim(coalesce(p_plan,'basic')));
 if normalized not in ('basic','free','vip','premium','pro') then raise exception 'Paket harus Basic, VIP, atau Premium'; end if;
 normalized:=case normalized when 'free' then 'basic' when 'pro' then 'premium' else normalized end;
 update public.profiles set plan=normalized,
   plan_expires_at=case when normalized='vip' then now()+interval '7 days' else null end
 where id=p_user_id;
 if not found then raise exception 'Profil member tidak ditemukan'; end if;
 return jsonb_build_object('ok',true,'user_id',p_user_id,'plan',normalized);
end; $$;
revoke all on function public.jsvidey_admin_set_plan(uuid,text) from public,anon;
grant execute on function public.jsvidey_admin_set_plan(uuid,text) to authenticated;


-- Safe access diagnostic for the watch page: reveals metadata and access tier, never the embed URL.
create or replace function public.jsvidey_video_access_status(p_video_id uuid default null,p_slug text default null)
returns table(title text,audience text,category text,allowed boolean)
language sql stable security definer set search_path=public,auth as $$
 select v.title,coalesce(v.audience,'public'),coalesce(v.category,''),
 case
   when v.status<>'published' or v.video_url is null then false
   when coalesce(v.audience,'public')='public' and coalesce(v.category,'') not ilike 'server%' then true
   when coalesce(v.audience,'public')='members' then auth.uid() is not null
   when coalesce(v.audience,'public')='vip' or coalesce(v.category,'') ilike 'server%' then exists(
     select 1 from public.profiles p where p.id=auth.uid() and lower(coalesce(p.plan,'basic')) in ('vip','premium','pro') and (p.plan_expires_at is null or p.plan_expires_at>now()))
   when coalesce(v.audience,'public')='premium' then exists(select 1 from public.profiles p where p.id=auth.uid() and lower(coalesce(p.plan,'basic')) in ('premium','pro'))
   else false end
 from public.videos v
 where (p_video_id is not null and v.id=p_video_id) or (p_slug is not null and v.slug=p_slug)
 limit 1;
$$;
revoke all on function public.jsvidey_video_access_status(uuid,text) from public;
grant execute on function public.jsvidey_video_access_status(uuid,text) to anon,authenticated;
