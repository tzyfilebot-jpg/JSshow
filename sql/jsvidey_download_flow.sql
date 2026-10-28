-- JSSHOW download flow: per-video thumbnail/download target and configurable button alignment.
alter table public.videos add column if not exists download_url text;
alter table public.videos add column if not exists thumbnail_url text;

-- Expose only published video metadata needed by the download page.
create or replace function public.get_public_download_video(p_video_id uuid)
returns table (
  id uuid,
  title text,
  video_url text,
  thumbnail_url text,
  download_url text,
  status text,
  audience text,
  slug text
)
language sql
stable
security definer
set search_path = ''
as $$
  select v.id, v.title, v.video_url, v.thumbnail_url, v.download_url, v.status, v.audience, v.slug
  from public.videos v
  where v.id = p_video_id
    and v.status = 'published'
    and v.video_url is not null
    and (coalesce(v.audience, 'public') = 'public' or auth.uid() is not null)
  limit 1;
$$;
revoke all on function public.get_public_download_video(uuid) from public;
grant execute on function public.get_public_download_video(uuid) to anon, authenticated;

-- Publicly readable presentation settings; only verified admins can update them.
create table if not exists public.jsvidey_download_settings (
  singleton boolean primary key default true check (singleton),
  top_align text not null default 'right' check (top_align in ('left','center','right')),
  middle_align text not null default 'center' check (middle_align in ('left','center','right')),
  bottom_align text not null default 'left' check (bottom_align in ('left','center','right')),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
insert into public.jsvidey_download_settings(singleton) values(true) on conflict(singleton) do nothing;
alter table public.jsvidey_download_settings enable row level security;
revoke all on public.jsvidey_download_settings from public, anon, authenticated;
drop policy if exists "Read download button positions" on public.jsvidey_download_settings;
create policy "Read download button positions" on public.jsvidey_download_settings
  for select to anon, authenticated using (true);
grant select on public.jsvidey_download_settings to anon, authenticated;

create or replace function public.jsvidey_get_download_settings()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'top_align', top_align,
    'middle_align', middle_align,
    'bottom_align', bottom_align
  )
  from public.jsvidey_download_settings
  where singleton = true
  limit 1;
$$;
revoke all on function public.jsvidey_get_download_settings() from public;
grant execute on function public.jsvidey_get_download_settings() to anon, authenticated;

create or replace function public.jsvidey_admin_save_download_settings(p_settings jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_top text := coalesce(p_settings->>'top_align', 'right');
  v_middle text := coalesce(p_settings->>'middle_align', 'center');
  v_bottom text := coalesce(p_settings->>'bottom_align', 'left');
begin
  if not public.jsvidey_is_admin() then raise exception 'Admin access required'; end if;
  if v_top not in ('left','center','right')
     or v_middle not in ('left','center','right')
     or v_bottom not in ('left','center','right') then
    raise exception 'Posisi tombol tidak valid';
  end if;
  insert into public.jsvidey_download_settings(singleton, top_align, middle_align, bottom_align, updated_at, updated_by)
  values(true, v_top, v_middle, v_bottom, now(), auth.uid())
  on conflict(singleton) do update set
    top_align = excluded.top_align,
    middle_align = excluded.middle_align,
    bottom_align = excluded.bottom_align,
    updated_at = now(),
    updated_by = auth.uid();
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.jsvidey_admin_save_download_settings(jsonb) from public, anon;
grant execute on function public.jsvidey_admin_save_download_settings(jsonb) to authenticated;

-- Keep the admin media table in sync with the metadata shown by the UI.
create or replace function public.jsvidey_admin_dashboard()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if not public.jsvidey_is_admin() then raise exception 'Admin access required'; end if;
  select jsonb_build_object(
    'users', (select coalesce(jsonb_agg(jsonb_build_object('id',u.id,'email',u.email,'username',p.username,'display_name',p.display_name,'created_at',u.created_at,'banned_until',u.banned_until,'is_admin',exists(select 1 from public.jsvidey_admins a where a.user_id=u.id)) order by u.created_at desc),'[]'::jsonb) from auth.users u left join public.profiles p on p.id=u.id),
    'videos', (select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'title',v.title,'video_url',v.video_url,'thumbnail_url',v.thumbnail_url,'download_url',v.download_url,'audience',v.audience,'slug',v.slug,'storage_key',v.storage_key,'file_size_bytes',v.file_size_bytes,'status',v.status,'created_at',v.created_at,'user_id',v.user_id,'username',p.username,'email',u.email) order by v.created_at desc),'[]'::jsonb) from public.videos v left join public.profiles p on p.id=v.user_id left join auth.users u on u.id=v.user_id),
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
