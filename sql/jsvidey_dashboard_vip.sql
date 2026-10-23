-- Jsshow catalog, thumbnail, announcements and VIP server access.
-- Run after js videy auth/catalog/admin migrations in Supabase SQL Editor.

alter table public.videos add column if not exists thumbnail_url text;
alter table public.videos add column if not exists category text not null default 'Trending';
alter table public.videos add column if not exists audience text not null default 'public';
alter table public.videos drop constraint if exists videos_audience_check;
alter table public.videos add constraint videos_audience_check check (audience in ('public','members','vip'));
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
begin
 if not public.jsvidey_is_admin() then raise exception 'Admin access required'; end if;
 if p_plan not in ('free','vip') then raise exception 'Plan harus free atau vip'; end if;
 update public.profiles set plan=p_plan where id=p_user_id;
 if not found then raise exception 'Profil member tidak ditemukan'; end if;
 return jsonb_build_object('ok',true,'user_id',p_user_id,'plan',p_plan);
end;
$$;
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
