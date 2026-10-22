# Urutan menjalankan SQL Jsvidey

Jalankan di Supabase Dashboard → SQL Editor, **satu file per Run**, berurutan:

1. `jsvidey_auth.sql` — tabel profil dan trigger akun baru.
2. `jsvidey_dashboard.sql` — tabel video dan tabel dashboard. Kolom `storage_key` dan `file_size_bytes` disediakan untuk kompatibilitas dashboard; workflow embed dapat membiarkannya NULL.
3. `jsvidey_video_catalog.sql` — kategori/thumbnail dan kebijakan baca video published untuk katalog publik.
4. `jsvidey_short_links.sql` — kolom slug untuk tautan pendek `/judul-video`.
5. `jsvidey_admin_control_center.sql` — RPC dan tabel kontrol admin; butuh tabel dari langkah sebelumnya.
6. `jsvidey_nav_menu.sql` — menu navbar dinamis; butuh fungsi `jsvidey_is_admin()` dari langkah 5.
7. `jsvidey_admin_embed_only.sql` — batasi penambahan video published ke admin.
8. `get_public_embed_video.sql` — fungsi lookup metadata embed publik berdasarkan UUID.
9. `get_public_embed_video_by_slug.sql` — fungsi lookup metadata embed publik berdasarkan slug, tanpa membuka SELECT tabel video ke anon.
10. `jsvidey_video_platform_expansion.sql` — non-destructive extension: public/member video visibility, login-only comments, Adsterra and promotion settings. Run after files above; existing published videos remain public by default.
11. `make_admin_saputrarmx190301.sql` — **jalankan paling akhir**, setelah akun `saputrarmx190301@gmail.com` sudah terdaftar di Supabase Auth.

## Opsional / hanya bila fitur tersebut digunakan
- `jsvidey-social-database.sql` — tabel like, komentar, dan favorit video pribadi (`video_favorites`). Jalankan untuk mengaktifkan tombol Like, Komentar, Favorit dan halaman My Favorit. Link Share tidak membutuhkan tabel tambahan.
- `fix_creator_leaderboard_security.sql` — perbaikan opsi keamanan view leaderboard; jalankan setelah `jsvidey_dashboard.sql` membuat view tersebut.
- `jsvidey_public-watch-member-download.sql` — catatan saja, bukan migrasi yang membuat objek database; pemutaran/unduhan lewat Edge Functions perlu dikonfigurasi terpisah.

## Penting
- Jangan jalankan `make_admin_saputrarmx190301.sql` sebelum akun tersebut ada.
- Jangan menjalankan SQL lain secara acak atau terus menekan Run jika ada error. Salin pesan error untuk diperiksa terlebih dahulu.
- File-file ini disusun untuk source yang disertakan; belum dijalankan pada database live pengguna. Backup database sebelum mengubah proyek yang sudah berisi data.
