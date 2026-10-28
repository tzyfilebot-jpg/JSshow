-- Jsshow VIP/Premium checkout and manual payment confirmation.
-- Run after js videy auth, admin-control, and dashboard_vip migrations.
create table if not exists public.jsvidey_payment_orders (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 package text not null check(package in ('vip1','vip3','vip5','vip7','premium')),
 amount_idr integer not null check(amount_idr > 0),
 status text not null default 'awaiting_payment' check(status in ('awaiting_payment','pending_review','approved','rejected')),
 proof_reference text,
 admin_note text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists jsvidey_payment_orders_user_created_idx on public.jsvidey_payment_orders(user_id,created_at desc);
create index if not exists jsvidey_payment_orders_status_created_idx on public.jsvidey_payment_orders(status,created_at desc);
alter table public.jsvidey_payment_orders enable row level security;
revoke all on public.jsvidey_payment_orders from public,anon,authenticated;
grant select on public.jsvidey_payment_orders to authenticated;
drop policy if exists "Users read own payment orders" on public.jsvidey_payment_orders;
create policy "Users read own payment orders" on public.jsvidey_payment_orders for select to authenticated
using (user_id=auth.uid() or public.jsvidey_is_admin());

create or replace function public.jsvidey_create_payment_order(p_package text)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare v_package text:=lower(trim(coalesce(p_package,''))); v_amount integer; v_id uuid;
begin
 if auth.uid() is null then raise exception 'Silakan login terlebih dahulu'; end if;
 v_amount:=case v_package when 'vip1' then 20000 when 'vip3' then 35000 when 'vip5' then 45000 when 'vip7' then 50000 when 'premium' then 120000 else null end;
 if v_amount is null then raise exception 'Paket tidak valid'; end if;
 if not exists(select 1 from public.jsvidey_platform_config where singleton=true and coalesce(settings->>'vip_qr_url','') like 'https://%') then
   raise exception 'QR Cashi belum diatur admin';
 end if;
 insert into public.jsvidey_payment_orders(user_id,package,amount_idr) values(auth.uid(),v_package,v_amount) returning id into v_id;
 return jsonb_build_object('id',v_id,'package',v_package,'amount_idr',v_amount,'status','awaiting_payment');
end $$;
revoke all on function public.jsvidey_create_payment_order(text) from public,anon;
grant execute on function public.jsvidey_create_payment_order(text) to authenticated;

create or replace function public.jsvidey_submit_payment_proof(p_order_id uuid,p_proof text)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare v_status text;
begin
 if auth.uid() is null then raise exception 'Silakan login terlebih dahulu'; end if;
 if length(trim(coalesce(p_proof,'')))<3 or length(trim(p_proof))>500 then raise exception 'Nomor referensi atau tautan bukti wajib diisi (maksimal 500 karakter)'; end if;
 update public.jsvidey_payment_orders set proof_reference=trim(p_proof),status='pending_review',updated_at=now()
 where id=p_order_id and user_id=auth.uid() and status in ('awaiting_payment','rejected')
 returning status into v_status;
 if v_status is null then raise exception 'Pesanan tidak ditemukan atau sudah dikirim untuk ditinjau'; end if;
 return jsonb_build_object('id',p_order_id,'status',v_status);
end $$;
revoke all on function public.jsvidey_submit_payment_proof(uuid,text) from public,anon;
grant execute on function public.jsvidey_submit_payment_proof(uuid,text) to authenticated;

create or replace function public.jsvidey_admin_payment_orders()
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
 if not public.jsvidey_is_admin() then raise exception 'Admin access required'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'user_id',o.user_id,'email',u.email,'username',p.username,'package',o.package,'amount_idr',o.amount_idr,'status',o.status,'proof_reference',o.proof_reference,'admin_note',o.admin_note,'created_at',o.created_at) order by o.created_at desc),'[]'::jsonb)
 into result from public.jsvidey_payment_orders o left join auth.users u on u.id=o.user_id left join public.profiles p on p.id=o.user_id;
 return result;
end $$;
revoke all on function public.jsvidey_admin_payment_orders() from public,anon;
grant execute on function public.jsvidey_admin_payment_orders() to authenticated;

create or replace function public.jsvidey_admin_review_payment(p_order_id uuid,p_approve boolean,p_note text default null)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare o public.jsvidey_payment_orders%rowtype; v_plan text; v_expiry timestamptz;
begin
 if not public.jsvidey_is_admin() then raise exception 'Admin access required'; end if;
 select * into o from public.jsvidey_payment_orders where id=p_order_id for update;
 if not found then raise exception 'Pesanan tidak ditemukan'; end if;
 if o.status not in ('pending_review','awaiting_payment','rejected') then raise exception 'Pesanan sudah diproses'; end if;
 if not p_approve then
   update public.jsvidey_payment_orders set status='rejected',admin_note=left(coalesce(p_note,''),500),updated_at=now() where id=o.id;
   return jsonb_build_object('id',o.id,'status','rejected');
 end if;
 if o.package='premium' then
   update public.profiles set plan='premium',plan_expires_at=null where id=o.user_id;
 else
   v_expiry:=now()+case o.package when 'vip1' then interval '1 day' when 'vip3' then interval '3 days' when 'vip5' then interval '5 days' when 'vip7' then interval '7 days' else interval '1 day' end;
   update public.profiles set plan='vip',plan_expires_at=v_expiry where id=o.user_id;
 end if;
 update public.jsvidey_payment_orders set status='approved',admin_note=left(coalesce(p_note,''),500),updated_at=now() where id=o.id;
 return jsonb_build_object('id',o.id,'status','approved','package',o.package);
end $$;
revoke all on function public.jsvidey_admin_review_payment(uuid,boolean,text) from public,anon;
grant execute on function public.jsvidey_admin_review_payment(uuid,boolean,text) to authenticated;
