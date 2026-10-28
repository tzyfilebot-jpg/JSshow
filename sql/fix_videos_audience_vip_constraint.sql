-- Jsvidey: perbaiki constraint audience agar akses VIP/Premium dapat disimpan.
-- Jalankan di Supabase SQL Editor setelah backup / saat proyek memakai fitur VIP.
-- Ini tidak menghapus RLS atau policy; hanya menyamakan nilai yang diizinkan
-- dengan nilai yang sudah dipakai oleh admin.js dan jsvidey_admin_update_video_access.

begin;

alter table public.videos
  alter column audience set default 'public';

alter table public.videos
  drop constraint if exists videos_audience_check;

alter table public.videos
  add constraint videos_audience_check
  check (audience in ('public', 'members', 'vip', 'premium'));

commit;

-- Verifikasi:
select conname, pg_get_constraintdef(oid) as aturan
from pg_constraint
where conrelid = 'public.videos'::regclass
  and conname = 'videos_audience_check';
