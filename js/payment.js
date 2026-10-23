const PAYMENT_SUPABASE_URL='https://ordvxiydkxbtahjpseph.supabase.co';
(function(){
 const plans={vip1:{label:'VIP 1 Hari',amount:20000},vip3:{label:'VIP 3 Hari',amount:35000},vip5:{label:'VIP 5 Hari',amount:45000},vip7:{label:'VIP 7 Hari',amount:50000},premium:{label:'Premium Permanen',amount:120000}};
 const $=id=>document.getElementById(id),fmt=n=>'Rp'+new Intl.NumberFormat('id-ID').format(n);
 const planKey=new URLSearchParams(location.search).get('plan')||'vip1',plan=plans[planKey]||plans.vip1;
 $('orderPlan').textContent=plan.label;$('orderAmount').textContent=fmt(plan.amount);
 let db=null,user=null,orderId=null;
 function message(t,bad=false){$('orderMessage').textContent=t;$('orderMessage').classList.toggle('error',bad)}
 function safeUrl(s){try{const u=new URL(s);return u.protocol==='https:'?u.href:''}catch(_){return''}}
 async function init(){
   if(!window.supabase?.createClient){$('loginHint').textContent='Library Supabase tidak berhasil dimuat.';return}
   // Public anon key is shared with the existing site.
   const key='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yZHZ4aXlka3hidGFoanBzZXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2MDM3MjMsImV4cCI6MjEwODE3OTcyM30.PCruI7EeLyagV_PMyCd57s3N9oYcL41k-fEgwE8G60E';
   if(!key){$('loginHint').textContent='Konfigurasi login belum tersedia. Silakan login ulang atau hubungi admin.';return}
   db=window.supabase.createClient(PAYMENT_SUPABASE_URL,key);
   const {data:{user:u}}=await db.auth.getUser();user=u;
   if(!user){$('loginHint').textContent='Silakan login terlebih dahulu untuk membuat pesanan.';$('createOrder').disabled=true;$('createOrder').textContent='Login untuk melanjutkan';$('createOrder').onclick=()=>location.href='login.html?next='+encodeURIComponent(location.pathname+location.search);return}
   $('loginHint').textContent='Login sebagai '+(user.email||'member');
   const {data:cfg}=await db.rpc('jsvidey_public_vip_config');
   const c=cfg||{},qr=safeUrl(c.vip_qr_url);
   $('receiver').textContent=c.vip_cashi_receiver||'Belum diatur admin';
   if(qr){$('qrFrame').innerHTML='<img src="'+qr.replace(/&/g,'&amp;').replace(/"/g,'&quot;')+'" alt="QR Cashi resmi">';$('qrHint').textContent='Bayar '+fmt(plan.amount)+' kepada penerima yang tertera. Jangan membayar jika detail tidak sesuai.'}
   else {$('qrFrame').innerHTML='<div class="qr-placeholder"><i class="fa-solid fa-triangle-exclamation"></i><b>QR belum tersedia</b><small>Admin perlu mengatur URL QR Cashi di Panel Admin.</small></div>';$('createOrder').disabled=true;$('qrHint').textContent='Pesanan belum dapat dibuat sampai admin mengatur QR Cashi.'}
   $('createOrder').onclick=createOrder;$('submitProof').onclick=submitProof;
 }
 async function createOrder(){
   if(!db||!user)return;
   $('createOrder').disabled=true;message('Membuat pesanan…');
   const {data,error}=await db.rpc('jsvidey_create_payment_order',{p_package:planKey});
   $('createOrder').disabled=false;
   if(error){message('Belum dapat membuat pesanan. Pastikan migrasi sql/jsvidey_payment_orders.sql sudah dijalankan. '+error.message,true);return}
   orderId=typeof data==='string'?data:(data?.id||data?.order_id||data?.orderId);
   if(!orderId){message('Pesanan dibuat tetapi ID tidak diterima. Hubungi admin sebelum membayar.',true);return}
   message('Pesanan dibuat: '+orderId+'. Silakan bayar sesuai nominal, lalu kirim konfirmasi.');
   $('createOrder').textContent='Pesanan dibuat';$('createOrder').disabled=true;$('submitProof').disabled=false;
 }
 async function submitProof(){
   if(!orderId||!db)return;const proof=$('proof').value.trim();
   if(!proof){message('Masukkan nomor referensi atau tautan bukti pembayaran.',true);return}
   $('submitProof').disabled=true;
   const {error}=await db.rpc('jsvidey_submit_payment_proof',{p_order_id:orderId,p_proof:proof});
   $('submitProof').disabled=false;
   if(error){message('Gagal mengirim konfirmasi. Pastikan migrasi pembayaran sudah dijalankan. '+error.message,true);return}
   message('Konfirmasi terkirim. Status akun tetap Basic sampai admin menyetujui pembayaran.');
   $('submitProof').disabled=true;
 }
 init().catch(e=>message(e.message||'Gagal memuat pembayaran.',true));
})();