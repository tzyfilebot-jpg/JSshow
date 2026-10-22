-- Jsvidey Admin Control Center. Run after jsvidey_auth.sql, jsvidey_dashboard.sql.
-- SECURITY: admin membership is stored separately; ordinary users cannot promote themselves through profiles.
create table if not exists public.jsvidey_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.jsvidey_admins enable row level security;
revoke all on public.jsvidey_admins from anon, authenticated;

create table if not exists public.withdraw_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_idr bigint not null check (amount_idr > 0),
  payout_method text not null default 'manual',
  payout_details text not null default '',
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note text not null default '',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null
);
create index if not exists withdraw_requests_status_date_idx on public.withdraw_requests(status, created_at desc);
alter table public.withdraw_requests enable row level security;
drop policy if exists "Users can read own withdraw requests" on public.withdraw_requests;
create policy "Users can read own withdraw requests" on public.withdraw_requests for select to authenticated using (auth.uid() = user_id);
revoke insert, update, delete on public.withdraw_requests from anon, authenticated;
grant select on public.withdraw_requests to authenticated;

create table if not exists public.jsvidey_platform_config (
  singleton boolean primary key default true check (singleton),
  settings jsonb not null default '{"maintenance_enabled":false,"maintenance_message":"Kami sedang melakukan pemeliharaan.","registration_enabled":true,"default_cpm_idr":10000,"creator_share_percent":60,"max_upload_mb":20,"storage_quota_gb":100,"bucket_label":"jsvidey-media","ads_enabled":false,"pre_roll":"off","mid_roll_seconds":300,"ad_tag_url":""}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
insert into public.jsvidey_platform_config(singleton) values(true) on conflict(singleton) do nothing;
alter table public.jsvidey_platform_config enable row level security;
revoke all on public.jsvidey_platform_config from anon, authenticated;

create table if not exists public.jsvidey_notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 2000),
  target_user_id uuid references auth.users(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists jsvidey_notifications_date_idx on public.jsvidey_notifications(created_at desc);
alter table public.jsvidey_notifications enable row level security;
drop policy if exists "Users can read notifications addressed to them" on public.jsvidey_notifications;
create policy "Users can read notifications addressed to them" on public.jsvidey_notifications for select to authenticated using (target_user_id = auth.uid() or target_user_id is null);
revoke insert, update, delete on public.jsvidey_notifications from anon, authenticated;
grant select on public.jsvidey_notifications to authenticated;

create or replace function public.jsvidey_is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.jsvidey_admins a where a.user_id = auth.uid());
$$;
revoke all on function public.jsvidey_is_admin() from public, anon;
grant execute on function public.jsvidey_is_admin() to authenticated;

create or replace function public.jsvidey_admin_dashboard()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if not public.jsvidey_is_admin() then raise exception 'Admin access required'; end if;
  select jsonb_build_object(
    'users', (select coalesce(jsonb_agg(jsonb_build_object('id',u.id,'email',u.email,'username',p.username,'display_name',p.display_name,'created_at',u.created_at,'banned_until',u.banned_until,'is_admin',exists(select 1 from public.jsvidey_admins a where a.user_id=u.id)) order by u.created_at desc),'[]'::jsonb) from auth.users u left join public.profiles p on p.id=u.id),
    'videos', (select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'title',v.title,'video_url',v.video_url,'storage_key',v.storage_key,'file_size_bytes',v.file_size_bytes,'status',v.status,'created_at',v.created_at,'user_id',v.user_id,'username',p.username,'email',u.email) order by v.created_at desc),'[]'::jsonb) from public.videos v left join public.profiles p on p.id=v.user_id left join auth.users u on u.id=v.user_id),
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

create or replace function public.jsvidey_admin_action(action text, payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid; target_id uuid; amount bigint; config jsonb; msg_id uuid; affected int;
begin
  if not public.jsvidey_is_admin() then raise exception 'Admin access required'; end if;
  uid := auth.uid();
  case action
    when 'delete_video' then
      target_id := (payload->>'video_id')::uuid;
      delete from public.videos where id=target_id;
      if not found then raise exception 'Media tidak ditemukan'; end if;
      return jsonb_build_object('ok',true,'message','Metadata media dihapus. Objek B2 perlu dihapus oleh Edge Function admin-delete-media.');
    when 'delete_all_videos' then
      delete from public.videos;
      get diagnostics affected = row_count;
      return jsonb_build_object('ok',true,'deleted',affected,'message','Semua metadata media dihapus. Pastikan objek di bucket B2 juga dibersihkan.');
    when 'ban_user' then
      target_id := (payload->>'user_id')::uuid;
      if exists(select 1 from public.jsvidey_admins where user_id=target_id) then raise exception 'Tidak dapat ban administrator'; end if;
      update auth.users set banned_until = now() + interval '100 years' where id=target_id;
      if not found then raise exception 'User tidak ditemukan'; end if;
      return jsonb_build_object('ok',true);
    when 'unban_user' then
      target_id := (payload->>'user_id')::uuid;
      update auth.users set banned_until = null where id=target_id;
      if not found then raise exception 'User tidak ditemukan'; end if;
      return jsonb_build_object('ok',true);
    when 'delete_user' then
      target_id := (payload->>'user_id')::uuid;
      if target_id=uid then raise exception 'Tidak dapat menghapus akun admin yang sedang digunakan'; end if;
      if exists(select 1 from public.jsvidey_admins where user_id=target_id) then raise exception 'Tidak dapat menghapus administrator'; end if;
      delete from auth.users where id=target_id;
      if not found then raise exception 'User tidak ditemukan'; end if;
      return jsonb_build_object('ok',true);
    when 'review_withdrawal' then
      target_id := (payload->>'withdrawal_id')::uuid;
      if payload->>'decision' not in ('approved','rejected') then raise exception 'Keputusan tidak valid'; end if;
      select amount_idr,user_id into amount,target_id from public.withdraw_requests where id=(payload->>'withdrawal_id')::uuid and status='pending' for update;
      if not found then raise exception 'Permintaan withdraw tidak ditemukan atau sudah ditinjau'; end if;
      if payload->>'decision'='approved' then
        update public.creator_wallets set available_balance_idr=available_balance_idr-amount,updated_at=now() where user_id=target_id and available_balance_idr>=amount;
        if not found then raise exception 'Saldo tersedia tidak cukup; withdraw tidak dapat di-approve'; end if;
      end if;
      update public.withdraw_requests set status=payload->>'decision',admin_note=left(coalesce(payload->>'admin_note',''),1000),reviewed_at=now(),reviewed_by=uid where id=(payload->>'withdrawal_id')::uuid;
      return jsonb_build_object('ok',true);
    when 'save_config' then
      config := coalesce((select settings from public.jsvidey_platform_config where singleton=true),'{}'::jsonb) || coalesce(payload,'{}'::jsonb);
      if (config->>'max_upload_mb')::numeric < 1 or (config->>'max_upload_mb')::numeric > 5000 then raise exception 'Limit upload harus 1–5000 MB'; end if;
      if (config->>'storage_quota_gb')::numeric < 1 then raise exception 'Kuota harus minimal 1 GB'; end if;
      if (config->>'default_cpm_idr')::numeric < 0 or (config->>'creator_share_percent')::numeric < 0 or (config->>'creator_share_percent')::numeric > 100 then raise exception 'Pengaturan CPM/bagi hasil tidak valid'; end if;
      if (config->>'mid_roll_seconds')::numeric < 30 or (config->>'mid_roll_seconds')::numeric > 7200 then raise exception 'Mid-roll harus antara 30–7200 detik'; end if;
      update public.jsvidey_platform_config set settings=config,updated_at=now(),updated_by=uid where singleton=true;
      return jsonb_build_object('ok',true,'config',config);
    when 'send_notification' then
      target_id := nullif(payload->>'target_user_id','')::uuid;
      if target_id is not null and not exists(select 1 from auth.users where id=target_id) then raise exception 'Target user tidak ditemukan'; end if;
      insert into public.jsvidey_notifications(title,body,target_user_id,created_by) values(left(trim(payload->>'title'),120),left(trim(payload->>'body'),2000),target_id,uid) returning id into msg_id;
      return jsonb_build_object('ok',true,'id',msg_id);
    when 'add_earning' then
      target_id := (payload->>'user_id')::uuid;
      amount := (payload->>'amount_idr')::bigint;
      if amount < 0 or not exists(select 1 from auth.users where id=target_id) then raise exception 'User atau jumlah tidak valid'; end if;
      insert into public.creator_earnings(user_id,amount_idr,views,cpm_idr,source) values(target_id,amount,greatest(0,coalesce((payload->>'views')::integer,0)),coalesce((select (settings->>'default_cpm_idr')::numeric from public.jsvidey_platform_config where singleton=true),0),'admin_adjustment');
      insert into public.creator_wallets(user_id,available_balance_idr) values(target_id,amount) on conflict(user_id) do update set available_balance_idr=public.creator_wallets.available_balance_idr+excluded.available_balance_idr,updated_at=now();
      return jsonb_build_object('ok',true);
    else raise exception 'Aksi admin tidak dikenal';
  end case;
end;
$$;
revoke all on function public.jsvidey_admin_action(text,jsonb) from public, anon;
grant execute on function public.jsvidey_admin_action(text,jsonb) to authenticated;

-- Replace the original strict 20 MiB DB constraint with a platform-controlled ceiling (up to 5 GB).
alter table public.videos drop constraint if exists videos_file_size_bytes_check;
alter table public.videos add constraint videos_file_size_bytes_check check (file_size_bytes is null or (file_size_bytes > 0 and file_size_bytes <= 5368709120));

-- Public-safe status only; never exposes private bucket credentials or internal admin data.
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
    'ad_tag_url', coalesce(settings->>'ad_tag_url','')
  ) from public.jsvidey_platform_config where singleton=true;
$$;
revoke all on function public.jsvidey_public_platform_status() from public;
grant execute on function public.jsvidey_public_platform_status() to anon, authenticated;

-- Creator withdrawal request entry point. Locks the wallet and counts pending requests to prevent over-requesting the available balance.
create or replace function public.jsvidey_request_withdrawal(p_amount_idr bigint, p_payout_method text, p_payout_details text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare current_balance bigint; pending_amount bigint; request_id uuid;
begin
  if auth.uid() is null then raise exception 'Login diperlukan'; end if;
  if p_amount_idr is null or p_amount_idr < 1000 then raise exception 'Minimum withdraw adalah Rp1.000'; end if;
  if char_length(trim(coalesce(p_payout_details,''))) < 3 or char_length(p_payout_details) > 1000 then raise exception 'Detail tujuan pembayaran tidak valid'; end if;
  if p_payout_method not in ('bank_transfer','e_wallet','other') then raise exception 'Metode pembayaran tidak valid'; end if;
  select available_balance_idr into current_balance from public.creator_wallets where user_id=auth.uid() for update;
  if not found then raise exception 'Wallet tidak ditemukan'; end if;
  select coalesce(sum(amount_idr),0) into pending_amount from public.withdraw_requests where user_id=auth.uid() and status='pending';
  if current_balance-pending_amount < p_amount_idr then raise exception 'Saldo tersedia tidak cukup setelah memperhitungkan withdraw pending'; end if;
  insert into public.withdraw_requests(user_id,amount_idr,payout_method,payout_details) values(auth.uid(),p_amount_idr,p_payout_method,left(trim(p_payout_details),1000)) returning id into request_id;
  return request_id;
end;
$$;
revoke all on function public.jsvidey_request_withdrawal(bigint,text,text) from public, anon;
grant execute on function public.jsvidey_request_withdrawal(bigint,text,text) to authenticated;
