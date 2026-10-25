# Jsvidey Admin Repair Pack

## Cara menerapkan

1. Deploy seluruh file dari ZIP ini ke Cloudflare Pages / hosting yang dipakai.
2. Buka Supabase Dashboard → SQL Editor.
3. Jalankan `sql/jsvidey_admin_repair_pack.sql` satu kali.
4. Jika SQL gagal, jangan jalankan berulang tanpa membaca pesan error. Kirim teks errornya agar migrasi disesuaikan dengan skema database aktif.
5. Setelah SQL sukses, logout/login admin lalu buka `admin.html`.

## Yang diperbaiki / ditambahkan

- Chat Support menjadi percakapan dua arah per akun: member dan admin bisa mengirim pesan dan gambar (JPG/PNG/WEBP/GIF sampai 5 MB).
- Widget mengambang `Chat` hanya tampil pada halaman publik ketika sesi login tersedia. Menu menyediakan Support, Gabung Group, dan Join Channel Oxcie.
- Bug Reader dapat menyimpan error dari halaman yang sedang dibuka oleh administrator ke tabel terpusat. Pada panel admin, filter halaman dan tombol “Buka halaman” tersedia.
- Pengaturan akses media menyimpan nilai `public`, `members`, `vip`, atau `premium`, dan dashboard admin mengembalikan kolom `audience` agar status yang dipilih bisa ditampilkan lagi.
- Paket member dapat diatur menjadi Basic, VIP, atau Premium, dengan durasi hari yang bisa ditentukan. Isi `0` berarti tidak ada tanggal kedaluwarsa.
- Pesanan membership dapat dihapus melalui RPC yang memeriksa hak admin di database.
- Jenis penempatan iklan menambahkan Native bar dan Popunder di samping posisi banner/konten/floating yang sudah ada. Perubahan halaman tetap mengikuti aturan penempatan yang disimpan.

## Catatan penting

- Bug Reader merekam runtime error ketika administrator login dan membuka halaman yang Bug Reader-nya diaktifkan di menu **Kontrol setiap halaman**. Ini bukan alat untuk memindai semua browser pengunjung secara diam-diam.
- Tes kesehatan halaman memeriksa respons HTTP dan aset lokal; ia tidak bisa menjamin seluruh interaksi UI bebas bug.
- Kode Adsterra harus berasal dari dashboard Adsterra milik Anda. Popunder dapat diblokir browser, perangkat, atau kebijakan jaringan; tidak ada kode situs yang dapat menjamin semua tayangan selalu muncul.
- Media VIP/Premium juga memerlukan kebijakan akses pada query/player yang sudah ada. Constraint dan panel admin saja tidak menggantikan pemeriksaan akses di sisi server.
- Gambar chat menggunakan bucket publik `jsvidey-support-attachments`; jangan mengirim data pribadi atau bukti yang berisi informasi sensitif.
