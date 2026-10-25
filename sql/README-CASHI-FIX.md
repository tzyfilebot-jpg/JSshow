# Perbaikan integrasi pembayaran Cashi JSshow

## Yang diperbaiki
- Pemetaan respons QR Cashi diperluas untuk nama field QR yang umum; QR tidak pernah dibuat dari URL checkout biasa.
- Endpoint webhook memverifikasi signature Cashi (format JSON.stringify seperti dokumentasi, dengan fallback raw body), memverifikasi status lewat `GET /api/check-status/:orderId`, lalu memanggil RPC aktivasi membership otomatis.
- Status check yang sudah ada tetap menjadi jalur aktivasi otomatis dari halaman pembayaran.
- Loading QR sudah tersedia di frontend.

## Langkah pemasangan
1. Backup database dan deploy file frontend yang diperbarui.
2. Jalankan `jsvidey_cashi_auto_membership_fix.sql` di Supabase SQL Editor jika belum pernah dijalankan.
3. Deploy ulang Edge Functions: `jsvidey-cashi-create-payment`, `jsvidey-cashi-check-status`, dan `jsvidey-cashi-webhook`.
4. Pastikan Edge Function secrets tersedia: `CASHI_API_KEY`, `CASHI_SECRET_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
5. Atur URL webhook Cashi ke URL function `jsvidey-cashi-webhook`.
6. Uji transaksi dengan nominal kecil. Pastikan respons `POST /api/create-order` memiliki `success: true` dan `qrUrl` berupa `data:image/png;base64,...` atau URL gambar QR Cashi yang valid.

## Catatan
- `CASHI_API_KEY` dan `CASHI_SECRET_KEY` hanya boleh disimpan di Supabase Edge Function Secrets, tidak di HTML/JavaScript frontend.
- QR gambar yang dikembalikan Cashi harus diuji dengan aplikasi bank/e-wallet. Kode ini tidak mengubah tautan checkout menjadi QRIS.
- Jika API Cashi tidak mengirim `qrUrl` maupun checkout URL, periksa log function dan minta Cashi memulihkan transaksi yang sama; jangan membuat transaksi baru sembarangan.
- Status lunas diverifikasi dengan API status Cashi sebelum membership diaktifkan.
