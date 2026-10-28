-- JSSHOW: replace title-based short codes with compact random codes (e.g. Xy1L).
-- Existing short links are preserved through public.video_slug_aliases.
-- Run after sql/jsvidey_short_links.sql and the membership/video access migrations.
create table if not exists public.video_slug_aliases (
  slug text primary key,
  video_id uuid not null references public.videos(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists video_slug_aliases_video_id_idx on public.video_slug_aliases(video_id);
alter table public.video_slug_aliases enable row level security;
revoke all on public.video_slug_aliases from public, anon, authenticated;
insert into public.video_slug_aliases(slug, video_id)
select v.slug, v.id from public.videos v where v.slug is not null and btrim(v.slug) <> '' and v.slug !~ '^[A-Za-z0-9]{4}$' on conflict (slug) do nothing;
do $$
declare rec record; code text; alphabet text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'; i integer; attempts integer;
begin
  for rec in select id from public.videos where slug is null or slug !~ '^[A-Za-z0-9]{4}$' order by created_at nulls first, id loop
    attempts := 0;
    loop
      attempts := attempts + 1; code := '';
      for i in 1..4 loop code := code || substr(alphabet, floor(random() * length(alphabet))::integer + 1, 1); end loop;
      exit when not exists (select 1 from public.videos where slug = code and id <> rec.id)
        and not exists (select 1 from public.video_slug_aliases where slug = code);
      if attempts > 100 then raise exception 'Tidak dapat menghasilkan kode video acak yang unik.'; end if;
    end loop;
    update public.videos set slug = code where id = rec.id;
  end loop;
end $$;
create unique index if not exists videos_slug_unique_idx on public.videos(slug);
create index if not exists videos_published_slug_idx on public.videos(slug) where status = 'published';
drop function if exists public.get_public_embed_video_by_slug(text);
create function public.get_public_embed_video_by_slug(p_slug text)
returns table (id uuid, title text, video_url text, status text, slug text, audience text)
language sql stable security definer set search_path = '' as $$
  select v.id, v.title, v.video_url, v.status, v.slug, v.audience
  from public.videos v
  where (v.slug = p_slug or exists (select 1 from public.video_slug_aliases a where a.slug = p_slug and a.video_id = v.id))
    and v.status = 'published' and v.video_url is not null
    and (coalesce(v.audience, 'public') = 'public' or auth.uid() is not null)
  order by (v.slug = p_slug) desc limit 1;
$$;
revoke all on function public.get_public_embed_video_by_slug(text) from public;
grant execute on function public.get_public_embed_video_by_slug(text) to anon, authenticated;


-- Preserve access-tier diagnostics for old aliases too (important for VIP/Premium locks).
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
 where (p_video_id is not null and v.id=p_video_id)
    or (p_slug is not null and (v.slug=p_slug or exists(select 1 from public.video_slug_aliases a where a.slug=p_slug and a.video_id=v.id)))
 limit 1;
$$;
revoke all on function public.jsvidey_video_access_status(uuid,text) from public;
grant execute on function public.jsvidey_video_access_status(uuid,text) to anon,authenticated;
