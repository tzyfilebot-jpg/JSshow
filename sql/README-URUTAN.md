# Urutan SQL Jsvidey (versi diperbaiki)

## Instalasi baru
Jalankan satu file per kali di Supabase Dashboard → SQL Editor, sesuai urutan berikut. Jangan lompat-lompat karena beberapa file memakai tabel/fungsi dari langkah sebelumnya.

1. `jsvidey_auth.sql` — profil dan trigger akun.
2. `jsvidey_dashboard.sql` — tabel video, statistik, wallet, serta kolom akses video awal.
3. `jsvidey_video_catalog.sql` — kategori dan kebijakan katalog publik dengan grant kolom terbatas.
4. `jsvidey_short_links.sql` — slug tautan pendek.
5. `jsvidey_admin_control_center.sql` — RPC dan tabel kontrol admin.
6. `jsvidey_nav_menu.sql` — menu navbar; bergantung pada fungsi admin langkah 5.
7. `jsvidey_admin_embed_only.sql` — membatasi publikasi video embed kepada admin.
8. `get_public_embed_video.sql` — lookup video melalui UUID.
9. `get_public_embed_video_by_slug.sql` — lookup video melalui slug.
10. `jsvidey-social-database.sql` — tabel Like, komentar, favorit, RPC status Like, dan RPC perubahan Like. Ini **wajib** untuk tombol interaksi. Like, komentar, dan favorit memerlukan login; perubahan Like dilakukan melalui RPC tanpa membuka baris Like mentah. Kolom identitas penulis komentar tidak dibuka ke publik. Publishing hanya untuk admin; pembaruan/penghapusan metadata dilakukan melalui RPC admin. Bagikan tidak memerlukan login.
11. `jsvidey_video_platform_expansion.sql` — aturan video public/member dan pengaturan platform. Jalankan setelah tabel komentar tersedia.
12. `make_admin_saputrarmx190301.sql` — hanya setelah akun `saputrarmx190301@gmail.com` terdaftar dan setelah langkah 5.

Opsional:
- `fix_creator_leaderboard_security.sql` — hanya jika perlu memperbaiki view leaderboard; setelah langkah 2.
- `jsvidey_public-watch-member-download.sql` — catatan konfigurasi, bukan migrasi database.

## Jika database sudah pernah dipakai
Jangan menjalankan ulang seluruh daftar secara membabi buta. (Opsional) jalankan `audit_current_database_readonly.sql` terlebih dahulu; file itu hanya berisi SELECT dan tidak mengubah database. Backup database terlebih dahulu, lalu gunakan `fix_social_interactions_safe.sql` sebagai migrasi perbaikan yang idempotent setelah tabel `public.videos` tersedia. File ini mempertahankan baris video yang ada, memastikan tabel sosial tersedia, membatasi kolom video/komentar yang bisa dibaca client (termasuk mencabut grant SELECT kolom lama), menyediakan RPC Like yang dipakai kode terbaru, mengunci kebijakan insert video pada admin jika fungsi admin tersedia, dan mencabut izin update/delete langsung pada tabel videos.

`fix_social_interactions_safe.sql` tidak menggantikan kebutuhan menjalankan migrasi dasar untuk fitur lain yang belum terpasang. Jangan jalankan `make_admin_saputrarmx190301.sql` sebelum akun yang disebutkan benar-benar ada.

## Catatan keamanan dan validasi
- Jangan menaruh service-role key di HTML/JavaScript. Kode frontend hanya memakai anon key.
- Migrasi ini disusun untuk source di ZIP dan belum dijalankan pada database live pengguna. SQL Editor Supabase yang sebenarnya adalah tempat untuk memvalidasi terhadap kondisi database aktual.
- Jika SQL berhenti dengan error, jangan terus menekan Run. Simpan pesan error lengkap dan periksa sebelum meneruskan.

## Jsshow dashboard, thumbnail, announcement, and VIP update

After the existing authentication, video catalog, short-link, platform expansion, and admin-control SQL migrations have been applied, run `sql/jsvidey_dashboard_vip.sql` in the Supabase SQL Editor. It adds the VIP audience option, thumbnail metadata support, server-category VIP access checks for catalog reads and direct watch RPCs, broadcast announcement read policy, and a safe public VIP-payment configuration RPC.

In Panel Admin → Media, enter a thumbnail URL and select the category/server and access level when publishing a video. In Panel Admin → Platform & notifikasi, set the VIP price and paste the HTTPS URL of the real Cashi QR image plus the receiver name/ID. Payment is manual: the admin must verify proof and change the member's `profiles.plan` to `vip`; the page does not pretend to verify payments automatically.


## Paket Basic / VIP / Premium, Top 10, dan akses katalog (update 2026-10-23)

Untuk project `JSshow-main-routing-fixed`, jalankan ulang `jsvidey_dashboard_vip.sql` setelah migrasi dasar sudah terpasang. Update terbaru pada file ini:
- memperbolehkan status paket `basic`, `vip`, `premium`;
- menambahkan `plan_expires_at` untuk masa aktif VIP;
- menyediakan RPC aman `jsvidey_catalog_videos` agar pengguna Basic dapat melihat judul/thumbnail video terkunci tanpa menerima URL embed;
- menyediakan `jsvidey_top_videos` yang mengurutkan Top 10 dari `video_views`;
- mencatat penayangan melalui `jsvidey_record_video_view`;
- memeriksa akses video langsung dan menyediakan diagnosis akses untuk pesan Upgrade;
- memperbolehkan admin menetapkan paket Basic, VIP, atau Premium.

Backup database sebelum menjalankan SQL. SQL ini belum dijalankan pada database live; validasi pesan SQL Editor sebelum menguji website.


## Pembayaran VIP/Premium (manual review)
Setelah migrasi dasar, `jsvidey_admin_control_center.sql`, dan `jsvidey_dashboard_vip.sql` berhasil, jalankan `jsvidey_payment_orders.sql`. Halaman `vip.html` memilih paket dan mengarahkan ke `payment.html`; pesanan dibuat oleh RPC dengan harga yang ditetapkan database. Bukti/reference dikirim ke tabel pesanan dan admin meninjau melalui RPC. Aktivasi paket hanya terjadi saat admin menyetujui pesanan lewat `jsvidey_admin_review_payment`. QR Cashi harus berupa URL HTTPS yang dikonfigurasi pada Platform & notifikasi.


## Perbaikan tombol sosial dan kode embed acak
1. Jalankan `fix_social_interactions_safe.sql` di Supabase SQL Editor untuk fungsi Like/Favorit/komentar.
2. Jalankan `jsvidey_random_video_codes.sql` untuk mengubah kode video menjadi 4 karakter acak sambil mempertahankan tautan lama melalui alias.
3. Deploy ulang situs setelah ZIP terbaru dipasang.


## Panel admin lengkap dan kontrol per halaman (update 2026-10-24)

Setelah migrasi dasar admin, `jsvidey_nav_menu.sql`, `jsvidey_dashboard_vip.sql`, `jsvidey_payment_orders.sql`, `jsvidey_cashi_integration.sql`, dan `jsvidey_admin_monetization_online.sql` diterapkan, jalankan `jsvidey_admin_full_control.sql` paling akhir. Migrasi ini menambah hitungan sesi online (tamu dan member), akses minimum Basic/VIP/Premium untuk item navbar, RPC untuk mengubah akses media Basic/VIP/Premium, konfigurasi `page_controls`, serta alasan wajib untuk menyetujui/menolak pembayaran membership.

Di Panel Admin, tab **Kontrol per halaman** mengatur maintenance, kode iklan, format iklan, gambar promosi, link tujuan, dan posisi promosi untuk halaman atau kategori terpilih. Pemeriksaan halaman menguji respons HTTP dan aset lokal; ini tidak menggantikan pengujian manual JavaScript/browser dan tidak mendeteksi setiap error runtime. Hitungan online adalah perkiraan sesi browser aktif dalam 2 menit, bukan jumlah orang unik yang terverifikasi.
