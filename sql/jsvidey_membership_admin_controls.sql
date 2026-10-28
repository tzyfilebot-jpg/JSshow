-- JSVidey: expose member plan/expiry to the admin panel and allow admins to set durations.
-- Run once in Supabase SQL Editor after deploying the matching website ZIP.

alter table public.profiles add column if not exists plan_expires_at timestamptz;

create or replace function public.jsvidey_admin_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  if not public.jsvidey_is_admin() then raise exception 'Admin access required'; end if;
  select jsonb_build_object(
    'users', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id',u.id,'email',u.email,'username',p.username,'display_name',p.display_name,
        'created_at',u.created_at,'banned_until',u.banned_until,
        'plan',coalesce(p.plan,'basic'),'plan_expires_at',p.plan_expires_at,
        'is_admin',exists(select 1 from public.jsvidey_admins a where a.user_id=u.id)
      ) order by u.created_at desc),'[]'::jsonb)
      from auth.users u left join public.profiles p on p.id=u.id
    ),
    'videos', (select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'title',v.title,'video_url',v.video_url,'storage_key',v.storage_key,'file_size_bytes',v.file_size_bytes,'status',v.status,'audience',v.audience,'thumbnail_url',v.thumbnail_url,'created_at',v.created_at,'user_id',v.user_id,'username',p.username,'email',u.email) order by v.created_at desc),'[]'::jsonb) from public.videos v left join public.profiles p on p.id=v.user_id left join auth.users u on u.id=v.user_id),
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

create or replace function public.jsvidey_admin_set_plan(p_user_id uuid,p_plan text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare normalized text; expiry timestamptz;
begin
  if not public.jsvidey_is_admin() then raise exception 'Admin access required'; end if;
  normalized := lower(trim(coalesce(p_plan,'basic')));
  if normalized not in ('basic','free','vip','vip_1d','vip_3d','vip_5d','vip_7d','vip_30d','premium','pro') then
    raise exception 'Paket tidak valid';
  end if;
  expiry := case normalized
    when 'vip_1d' then now()+interval '1 day'
    when 'vip_3d' then now()+interval '3 days'
    when 'vip_5d' then now()+interval '5 days'
    when 'vip_7d' then now()+interval '7 days'
    when 'vip_30d' then now()+interval '30 days'
    when 'vip' then now()+interval '7 days'
    else null end;
  normalized := case when normalized in ('basic','free') then 'basic'
                     when normalized like 'vip%' then 'vip'
                     when normalized='pro' then 'premium'
                     else normalized end;
  update public.profiles
     set plan=normalized,
         plan_expires_at=case when normalized='vip' then expiry else null end
   where id=p_user_id;
  if not found then raise exception 'Profil member tidak ditemukan'; end if;
  return jsonb_build_object('ok',true,'user_id',p_user_id,'plan',normalized,'plan_expires_at',case when normalized='vip' then expiry else null end);
end;
$$;
revoke all on function public.jsvidey_admin_set_plan(uuid,text) from public, anon;
grant execute on function public.jsvidey_admin_set_plan(uuid,text) to authenticated;
