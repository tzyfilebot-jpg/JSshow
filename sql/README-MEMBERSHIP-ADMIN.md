# Migrasi panel admin membership

Setelah mengunggah file website, buka Supabase Dashboard → SQL Editor, lalu jalankan `jsvidey_membership_admin_controls.sql` satu kali.

Migrasi ini:
- menambahkan kolom masa aktif jika belum ada;
- membuat panel admin dapat membaca paket dan tanggal kedaluwarsa member;
- mengizinkan admin memilih Basic, VIP 1/3/5/7/30 hari, atau Premium permanen;
- membatasi perubahan paket ke administrator terautentikasi.

QR pembayaran tetap dibuat oleh Edge Function Cashi yang sudah digunakan website. Migrasi ini tidak mengganti secret Cashi atau mengaktifkan metode pembayaran yang tidak didukung penyedia.
