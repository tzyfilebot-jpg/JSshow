-- JSSHOW VIP/PREMIUM visibility, social counters and Premium pricing migration.
-- Run once in Supabase SQL Editor after the existing JSSHOW catalog/social/Cashi migrations.

-- Normalize access-level constraints for this deployment.
alter table public.videos add column if not exists audience text not null default 'public';
alter table public.videos drop constraint if exists videos_audience_check;
alter table public.videos add constraint videos_audience_check check (audience in ('public','members','vip','premium'));
alter table public.profiles add column if not exists plan_expires_at timestamptz;

-- Public-safe catalog metadata: show locked VIP/Premium cards without exposing playable video URLs.
create or replace function public.jsvidey_catalog_videos()
returns table(id uuid,slug text,title text,created_at timestamptz,status text,category text,audience text,thumbnail_url text)
language sql stable security definer set search_path=public,auth as $$
 select v.id,v.slug,v.title,v.created_at,v.status,coalesce(v.category,'Trending'),
        coalesce(v.audience,'public'),v.thumbnail_url
 from public.videos v
 where v.status='published'
 order by v.created_at desc
 limit 300;
$$;
revoke all on function public.jsvidey_catalog_videos() from public;
grant execute on function public.jsvidey_catalog_videos() to anon,authenticated;

-- A share is counted only when the viewer presses Share and the browser reports a copy attempt.
create table if not exists public.video_shares (
 id bigint generated always as identity primary key,
 video_id uuid not null references public.videos(id) on delete cascade,
 created_at timestamptz not null default now()
);
create index if not exists video_shares_video_created_idx on public.video_shares(video_id,created_at desc);
alter table public.video_shares enable row level security;
revoke all on public.video_shares from public,anon,authenticated;

create or replace function public.jsvidey_record_video_share(p_video_id uuid)
returns bigint language plpgsql security definer set search_path=public,auth as $$
declare total bigint;
begin
 if p_video_id is null or not exists(select 1 from public.videos v where v.id=p_video_id and v.status='published') then
   raise exception 'Video tidak ditemukan';
 end if;
 insert into public.video_shares(video_id) values(p_video_id);
 select count(*)::bigint into total from public.video_shares where video_id=p_video_id;
 return total;
end; $$;
revoke all on function public.jsvidey_record_video_share(uuid) from public;
grant execute on function public.jsvidey_record_video_share(uuid) to anon,authenticated;

-- Replace the earlier aggregate RPC so all cards can show like/comment/share totals.
drop function if exists public.jsvidey_get_video_social_counts(uuid[]);
create function public.jsvidey_get_video_social_counts(p_video_ids uuid[])
returns table(video_id uuid,like_count bigint,comment_count bigint,share_count bigint)
language sql stable security definer set search_path=public,auth as $$
 select v.id,
   (select count(*)::bigint from public.video_likes l where l.video_id=v.id),
   (select count(*)::bigint from public.video_comments c where c.video_id=v.id),
   (select count(*)::bigint from public.video_shares s where s.video_id=v.id)
 from public.videos v
 where v.id=any(coalesce(p_video_ids,array[]::uuid[])) and v.status='published';
$$;
revoke all on function public.jsvidey_get_video_social_counts(uuid[]) from public;
grant execute on function public.jsvidey_get_video_social_counts(uuid[]) to anon,authenticated;

-- Enforce Basic < VIP < Premium. Expired memberships no longer unlock paid tiers.
-- The prior function may return a different OUT-row shape; PostgreSQL requires DROP before changing it.
drop function if exists public.get_public_embed_video(uuid);
create function public.get_public_embed_video(p_video_id uuid)
returns table(id uuid,title text,video_url text,status text,created_at timestamptz,audience text)
language sql stable security definer set search_path=public,auth as $$
 select v.id,v.title,v.video_url,v.status,v.created_at,coalesce(v.audience,'public')
 from public.videos v
 where v.id=p_video_id and v.status='published' and v.video_url is not null
 and (
   (coalesce(v.audience,'public')='public' and coalesce(v.category,'') not ilike 'server%')
   or (coalesce(v.audience,'public')='members' and auth.uid() is not null)
   or ((coalesce(v.audience,'public')='vip' or (coalesce(v.category,'') ilike 'server%' and coalesce(v.category,'') not ilike 'server premium%'))
       and coalesce(v.category,'') not ilike 'server premium%'
       and exists(select 1 from public.profiles p where p.id=auth.uid()
         and lower(coalesce(p.plan,'basic')) in ('vip','premium','pro')
         and (p.plan_expires_at is null or p.plan_expires_at>now())))
   or ((coalesce(v.audience,'public')='premium' or coalesce(v.category,'') ilike 'server premium%')
       and exists(select 1 from public.profiles p where p.id=auth.uid()
         and lower(coalesce(p.plan,'basic')) in ('premium','pro')
         and (p.plan_expires_at is null or p.plan_expires_at>now())))
 );
$$;
revoke all on function public.get_public_embed_video(uuid) from public;
grant execute on function public.get_public_embed_video(uuid) to anon,authenticated;

-- Drop the slug variant too in case its existing OUT-row shape differs.
drop function if exists public.get_public_embed_video_by_slug(text);
create function public.get_public_embed_video_by_slug(p_slug text)
returns table(id uuid,title text,video_url text,status text,slug text,audience text)
language sql stable security definer set search_path=public,auth as $$
 select v.id,v.title,v.video_url,v.status,v.slug,coalesce(v.audience,'public')
 from public.videos v
 where v.slug=p_slug and v.status='published' and v.video_url is not null
 and (
   (coalesce(v.audience,'public')='public' and coalesce(v.category,'') not ilike 'server%')
   or (coalesce(v.audience,'public')='members' and auth.uid() is not null)
   or ((coalesce(v.audience,'public')='vip' or (coalesce(v.category,'') ilike 'server%' and coalesce(v.category,'') not ilike 'server premium%'))
       and coalesce(v.category,'') not ilike 'server premium%'
       and exists(select 1 from public.profiles p where p.id=auth.uid()
         and lower(coalesce(p.plan,'basic')) in ('vip','premium','pro')
         and (p.plan_expires_at is null or p.plan_expires_at>now())))
   or ((coalesce(v.audience,'public')='premium' or coalesce(v.category,'') ilike 'server premium%')
       and exists(select 1 from public.profiles p where p.id=auth.uid()
         and lower(coalesce(p.plan,'basic')) in ('premium','pro')
         and (p.plan_expires_at is null or p.plan_expires_at>now())))
 );
$$;
revoke all on function public.get_public_embed_video_by_slug(text) from public;
grant execute on function public.get_public_embed_video_by_slug(text) to anon,authenticated;

create or replace function public.jsvidey_video_access_status(p_video_id uuid default null,p_slug text default null)
returns table(title text,audience text,category text,allowed boolean)
language sql stable security definer set search_path=public,auth as $$
 select v.title,coalesce(v.audience,'public'),coalesce(v.category,''),
 case
  when v.status<>'published' or v.video_url is null then false
  when coalesce(v.audience,'public')='public' and coalesce(v.category,'') not ilike 'server%' then true
  when coalesce(v.audience,'public')='members' then auth.uid() is not null
  when coalesce(v.audience,'public')='premium' or coalesce(v.category,'') ilike 'server premium%' then exists(
    select 1 from public.profiles p where p.id=auth.uid() and lower(coalesce(p.plan,'basic')) in ('premium','pro')
    and (p.plan_expires_at is null or p.plan_expires_at>now()))
  when coalesce(v.audience,'public')='vip' or (coalesce(v.category,'') ilike 'server%' and coalesce(v.category,'') not ilike 'server premium%') then exists(
    select 1 from public.profiles p where p.id=auth.uid() and lower(coalesce(p.plan,'basic')) in ('vip','premium','pro')
    and (p.plan_expires_at is null or p.plan_expires_at>now()))
  else false end
 from public.videos v
 where (p_video_id is not null and v.id=p_video_id) or (p_slug is not null and v.slug=p_slug)
 limit 1;
$$;
revoke all on function public.jsvidey_video_access_status(uuid,text) from public;
grant execute on function public.jsvidey_video_access_status(uuid,text) to anon,authenticated;

-- Support Premium monthly (Rp100,000) and permanent (Rp250,000) in the existing checkout.
alter table public.jsvidey_payment_orders drop constraint if exists jsvidey_payment_orders_package_check;
alter table public.jsvidey_payment_orders add constraint jsvidey_payment_orders_package_check
 check(package in ('vip1','vip3','vip5','vip7','premium','premium_monthly','premium_permanent'));

create or replace function public.jsvidey_create_payment_order(p_package text)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare v_package text:=lower(trim(coalesce(p_package,''))); v_amount integer; v_id uuid;
begin
 if auth.uid() is null then raise exception 'Silakan login terlebih dahulu'; end if;
 v_amount:=case v_package
  when 'vip1' then 20000 when 'vip3' then 35000 when 'vip5' then 45000 when 'vip7' then 50000
  when 'premium' then 250000 when 'premium_monthly' then 100000 when 'premium_permanent' then 250000 else null end;
 if v_amount is null then raise exception 'Paket tidak valid'; end if;
 if exists(select 1 from public.profiles p where p.id=auth.uid() and lower(coalesce(p.plan,''))='premium'
   and (p.plan_expires_at is null or p.plan_expires_at>now())) then
   raise exception 'Akun sudah Premium aktif';
 end if;
 insert into public.jsvidey_payment_orders(user_id,package,amount_idr,status)
 values(auth.uid(),v_package,v_amount,'awaiting_payment') returning id into v_id;
 return jsonb_build_object('id',v_id,'package',v_package,'amount_idr',v_amount,'status','awaiting_payment');
end; $$;
revoke all on function public.jsvidey_create_payment_order(text) from public,anon;
grant execute on function public.jsvidey_create_payment_order(text) to authenticated;

create or replace function public.jsvidey_admin_review_payment(
 p_order_id uuid,p_approve boolean,p_note text default null
) returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare o public.jsvidey_payment_orders%rowtype; v_expiry timestamptz; v_base timestamptz;
begin
 if not public.jsvidey_is_admin() then raise exception 'Admin access required'; end if;
 select * into o from public.jsvidey_payment_orders where id=p_order_id for update;
 if not found then raise exception 'Pesanan tidak ditemukan'; end if;
 if o.status not in ('pending_review','awaiting_payment','rejected') then raise exception 'Pesanan sudah diproses'; end if;
 if not p_approve then
  update public.jsvidey_payment_orders set status='rejected',admin_note=left(coalesce(p_note,''),500),updated_at=now() where id=o.id;
  return jsonb_build_object('id',o.id,'status','rejected');
 end if;
 if coalesce(o.cashi_provider_status,'')<>'SETTLED' and length(trim(coalesce(o.proof_reference,'')))<3 then
  raise exception 'Pembayaran belum terverifikasi. Pastikan Cashi berstatus SETTLED atau bukti pembayaran sudah dikirim.';
 end if;
 if o.package in ('premium','premium_permanent') then
  update public.profiles set plan='premium',plan_expires_at=null where id=o.user_id;
 elsif o.package='premium_monthly' then
  update public.profiles set plan='premium',plan_expires_at=now()+interval '1 month' where id=o.user_id;
 else
  select case when lower(coalesce(plan,''))='vip' and plan_expires_at>now() then plan_expires_at else now() end
   into v_base from public.profiles where id=o.user_id for update;
  v_base:=coalesce(v_base,now());
  v_expiry:=v_base+case o.package when 'vip1' then interval '1 day' when 'vip3' then interval '3 days'
   when 'vip5' then interval '5 days' when 'vip7' then interval '7 days' else interval '1 day' end;
  update public.profiles set plan='vip',plan_expires_at=v_expiry where id=o.user_id;
 end if;
 update public.jsvidey_payment_orders set status='approved',admin_note=left(coalesce(p_note,''),500),updated_at=now() where id=o.id;
 return jsonb_build_object('id',o.id,'status','approved','package',o.package);
end; $$;
revoke all on function public.jsvidey_admin_review_payment(uuid,boolean,text) from public,anon;
grant execute on function public.jsvidey_admin_review_payment(uuid,boolean,text) to authenticated;
