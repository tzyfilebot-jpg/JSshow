-- Show Stream: admin-managed navigation menu
create table if not exists public.jsvidey_nav_menu (
 id uuid primary key default gen_random_uuid(),
 label text not null check (char_length(label) between 1 and 60),
 slug text not null,
 menu_type text not null default 'category' check (menu_type in ('category','server')),
 sort_order integer not null default 10,
 is_active boolean not null default true,
 created_at timestamptz not null default now()
);
alter table public.jsvidey_nav_menu enable row level security;
drop policy if exists "Public can read active navigation" on public.jsvidey_nav_menu;
create policy "Public can read active navigation" on public.jsvidey_nav_menu
 for select to anon, authenticated using (is_active = true or public.jsvidey_is_admin());
drop policy if exists "Admins manage navigation" on public.jsvidey_nav_menu;
create policy "Admins manage navigation" on public.jsvidey_nav_menu
 for all to authenticated using (public.jsvidey_is_admin()) with check (public.jsvidey_is_admin());
grant select on public.jsvidey_nav_menu to anon, authenticated;
grant insert, update, delete on public.jsvidey_nav_menu to authenticated;
insert into public.jsvidey_nav_menu (label,slug,menu_type,sort_order)
select x.label,x.slug,x.menu_type,x.sort_order from (values
 ('Top 10 videos','Top 10 videos','category',10),
 ('Viral Tiktok','Viral Tiktok','category',20),
 ('Viral','Viral','category',30),
 ('Local Indo','Local Indo','category',40),
 ('Brazzers','Brazzers','category',50),
 ('Jav','Jav','category',60),
 ('Tante','Tante','category',70),
 ('Brutal','Brutal','category',80),
 ('Server1','Server1','server',110),
 ('Server2','Server2','server',120),
 ('Server3','Server3','server',130)
) as x(label,slug,menu_type,sort_order)
where not exists (select 1 from public.jsvidey_nav_menu m where lower(m.label)=lower(x.label));
