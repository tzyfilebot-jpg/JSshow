const PAYMENT_SUPABASE_URL='https://ordvxiydkxbtahjpseph.supabase.co';
const PAYMENT_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yZHZ4aXlka3hidGFoanBzZXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2MDM3MjMsImV4cCI6MjEwODE3OTcyM30.PCruI7EeLyagV_PMyCd57s3N9oYcL41k-fEgwE8G60E';
(function(){
 const plans={vip1:{label:'VIP 1 Hari',amount:20000},vip3:{label:'VIP 3 Hari',amount:35000},vip5:{label:'VIP 5 Hari',amount:45000},vip7:{label:'VIP 7 Hari',amount:50000},premium_monthly:{label:'PREMIUM 1 Bulan',amount:100000},premium_permanent:{label:'PREMIUM Permanen',amount:250000}};
 const $=id=>document.getElementById(id),fmt=n=>'Rp'+new Intl.NumberFormat('id-ID').format(n);
 const params=new URLSearchParams(location.search),key=params.get('plan')||'vip1',plan=plans[key]||plans.vip1;
 $('orderPlan').textContent=plan.label;$('orderAmount').textContent=fmt(plan.amount);$('payPlan').textContent=plan.label;$('payAmount').textContent=fmt(plan.amount);
 let db=null,user=null,orderId=null,qrCreated=false;
 function message(t,bad=false,target='orderMessage'){const el=$(target);if(!el)return;el.textContent=t;el.classList.toggle('error',bad)}
 function safeUrl(s){try{const u=new URL(s);return u.protocol==='https:'?u.href:''}catch(_){return''}}
 function showPayStage(id){$('orderStage').hidden=true;$('payStage').hidden=false;$('orderIdText').textContent=id;window.scrollTo({top:0,behavior:'smooth'})}
 function renderInvoice(data){
   const qr=safeUrl(data.qr_url),checkout=safeUrl(data.checkout_url);
   if(qr){const img=document.createElement('img');img.src=qr;img.alt='QR pembayaran Cashi';img.loading='eager';$('qrFrame').replaceChildren(img)}
   else if(checkout){$('qrFrame').innerHTML='<div class="qr-placeholder"><i class="fa-solid fa-arrow-up-right-from-square"></i><b>QR tidak disediakan</b><small>Lanjutkan melalui halaman pembayaran Cashi.</small></div>'}
   else $('qrFrame').innerHTML='<div class="qr-placeholder"><i class="fa-solid fa-triangle-exclamation"></i><b>QR belum diterima</b><small>Tekan coba lagi atau hubungi admin.</small></div>';
   let link=$('cashCheckoutLink');
   if(checkout){link.href=checkout;link.hidden=false}else{link.hidden=true;link.removeAttribute('href')}
   $('payAmount').textContent=fmt(Number(data.amount||plan.amount));
   qrCreated=!!(qr||checkout);$('retryCashi').hidden=qrCreated;
 }
 async function createCashiInvoice(id){
   $('retryCashi').disabled=true;message('Menghubungkan ke Cashi dan membuat QR nominal otomatis…',false,'paymentStatus');
   const {data,error}=await db.functions.invoke('jsvidey-cashi-create-payment',{body:{order_id:id}});
   $('retryCashi').disabled=false;
   if(error){let detail=error.message||'Gagal membuat QR Cashi.';if(error.context?.json?.detail)detail+=' '+error.context.json.detail;message(detail+' Pastikan Edge Function dan secret Cashi sudah dipasang.',true,'paymentStatus');$('retryCashi').hidden=false;return false}
   if(!data||data.error){message((data?.error||'Gagal membuat pembayaran')+(data?.detail?': '+data.detail:''),true,'paymentStatus');$('retryCashi').hidden=false;return false}
   renderInvoice(data);message('QR Cashi dibuat. Bayar tepat sesuai nominal yang ditampilkan.',false,'paymentStatus');return true;
 }
 async function init(){
   if(!window.supabase?.createClient){$('loginHint').textContent='Library Supabase tidak berhasil dimuat.';return}
   db=window.supabase.createClient(PAYMENT_SUPABASE_URL,PAYMENT_ANON_KEY);
   const {data:{user:u},error}=await db.auth.getUser();if(error)throw error;user=u;
   if(!user){$('loginHint').textContent='Silakan login terlebih dahulu untuk membuat pesanan.';$('createOrder').textContent='Login untuk melanjutkan';$('createOrder').disabled=false;$('createOrder').onclick=()=>location.href='login.html?next='+encodeURIComponent(location.pathname+location.search);return}
   $('loginHint').textContent='Login sebagai '+(user.email||'member');
   const {data:cfg}=await db.rpc('jsvidey_public_vip_config');const c=cfg||{};$('receiver').textContent=c.vip_cashi_receiver||'Sesuai informasi penerima pada aplikasi Cashi';
   $('createOrder').onclick=createOrder;$('retryCashi').onclick=()=>orderId&&createCashiInvoice(orderId);$('submitProof').onclick=submitProof;$('checkPayment').onclick=checkPayment;
 }
 async function createOrder(){
   if(!db||!user)return;
   const btn=$('createOrder');btn.disabled=true;message('Membuat pesanan…');
   const {data,error}=await db.rpc('jsvidey_create_payment_order',{p_package:key});
   btn.disabled=false;
   if(error){message('Pesanan belum dapat dibuat: '+error.message,true);return}
   orderId=typeof data==='string'?data:(data?.id||data?.order_id||data?.orderId);
   if(!orderId){message('ID pesanan tidak diterima. Hubungi admin sebelum membayar.',true);return}
   showPayStage(orderId);
   await createCashiInvoice(orderId);
 }
 async function checkPayment(){
   if(!db||!orderId)return;
   const btn=$('checkPayment');btn.disabled=true;message('Memeriksa status langsung ke Cashi…',false,'paymentStatus');
   try{
     const {data,error}=await db.functions.invoke('jsvidey-cashi-check-status',{body:{order_id:orderId}});
     if(error)throw new Error(error.message||'Pengecekan Cashi gagal');
     if(data?.error)throw new Error(data.detail||data.error);
     if(data?.status==='APPROVED'){message('Pembayaran disetujui admin. Membership sudah diproses.',false,'paymentStatus');$('submitProof').disabled=true;return}
     if(data?.status==='REJECTED'){message('Pembayaran ditolak admin. Periksa catatan admin atau hubungi admin.',true,'paymentStatus');return}
     if(data?.paid){message('Pembayaran terdeteksi lunas oleh Cashi. Status VIP/Premium tetap menunggu verifikasi admin.',false,'paymentStatus');$('submitProof').disabled=true;}
     else message('Status Cashi: '+(data?.status||'PENDING')+'. Jika baru membayar, tunggu sebentar lalu cek kembali.',false,'paymentStatus');
     const {data:row,error:rowError}=await db.from('jsvidey_payment_orders').select('status,admin_note,cashi_provider_status').eq('id',orderId).maybeSingle();
     if(rowError)throw rowError;
     if(row?.status==='approved'){message('Pembayaran disetujui admin. Membership sudah diproses.',false,'paymentStatus');$('submitProof').disabled=true}
     else if(row?.status==='rejected')message('Pembayaran ditolak admin. '+(row.admin_note||'Hubungi admin untuk informasi.'),true,'paymentStatus');
     else if(row?.status==='pending_review'&&row?.cashi_provider_status==='SETTLED'){message('Cashi mengonfirmasi pembayaran lunas. Pesanan menunggu verifikasi admin; membership belum aktif.',false,'paymentStatus');$('submitProof').disabled=true}
   }catch(e){message('Gagal mengecek pembayaran: '+(e.message||'coba lagi nanti'),true,'paymentStatus')}
   finally{btn.disabled=false}
 }
 async function submitProof(){
   if(!orderId||!db)return;const proof=$('proof').value.trim();
   if(!proof){message('Masukkan nomor referensi atau tautan bukti pembayaran.',true,'paymentStatus');return}
   const btn=$('submitProof');btn.disabled=true;
   const {error}=await db.rpc('jsvidey_submit_payment_proof',{p_order_id:orderId,p_proof:proof});
   if(error){btn.disabled=false;message('Gagal mengirim konfirmasi: '+error.message,true,'paymentStatus');return}
   message('Konfirmasi terkirim. Status membership tetap belum aktif sampai admin menyetujui pembayaran.',false,'paymentStatus');
 }
 init().catch(e=>message(e.message||'Gagal memuat pembayaran.',true));
})();
