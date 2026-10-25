const PAYMENT_SUPABASE_URL='https://ordvxiydkxbtahjpseph.supabase.co';
const PAYMENT_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yZHZ4aXlka3hidGFoanBzZXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2MDM3MjMsImV4cCI6MjEwODE3OTcyM30.PCruI7EeLyagV_PMyCd57s3N9oYcL41k-fEgwE8G60E';
(function(){
 const plans={vip1:{label:'VIP 1 Hari',amount:20000},vip3:{label:'VIP 3 Hari',amount:35000},vip5:{label:'VIP 5 Hari',amount:45000},vip7:{label:'VIP 7 Hari',amount:50000},premium_monthly:{label:'PREMIUM 1 Bulan',amount:100000},premium_permanent:{label:'PREMIUM Permanen',amount:250000}};
 const $=id=>document.getElementById(id),fmt=n=>'Rp'+new Intl.NumberFormat('id-ID').format(n);
 const params=new URLSearchParams(location.search),key=params.get('plan')||'vip1',plan=plans[key]||plans.vip1;
 $('orderPlan').textContent=plan.label;$('orderAmount').textContent=fmt(plan.amount);$('payPlan').textContent=plan.label;$('payAmount').textContent=fmt(plan.amount);
 const confirmPackage=$('confirmPackage'),createOrderButton=$('createOrder');
 if(confirmPackage&&createOrderButton){createOrderButton.disabled=!confirmPackage.checked;confirmPackage.addEventListener('change',()=>{createOrderButton.disabled=!confirmPackage.checked;});}
 let db=null,user=null,orderId=null,qrCreated=false;
 function message(t,bad=false,target='orderMessage'){const el=$(target);if(!el)return;el.textContent=t;el.classList.toggle('error',bad)}
 function safeUrl(s){try{const u=new URL(String(s||''));return u.protocol==='https:'?u.href:''}catch(_){return''}}
 async function functionErrorDetail(error){
   const ctx=error&&error.context;
   if(ctx){
     try{
       if(typeof ctx.clone==='function'){
         const raw=await ctx.clone().text();
         let body={};try{body=JSON.parse(raw)}catch(_){body={detail:raw}}
         if(body&&(body.detail||body.message||body.error))return [body.error,body.detail||body.message].filter(Boolean).join(': ');
       } else if(typeof ctx.json==='function'){
         const body=await ctx.json();
         if(body&&(body.detail||body.message||body.error))return [body.error,body.detail||body.message].filter(Boolean).join(': ');
       } else if(typeof ctx==='object'){
         const body=ctx.json||ctx.body||ctx;
         if(body&&(body.detail||body.message||body.error))return [body.error,body.detail||body.message].filter(Boolean).join(': ');
       }
     }catch(_){}
   }
   return error?.message||'Permintaan ke server pembayaran gagal. Periksa log Edge Function.';
 }

 function safeQrSource(s){
   const value=String(s||'').trim();
   if(/^https:\/\//i.test(value))return safeUrl(value);
   // Accept Cashi data URIs with whitespace/newlines in base64 and normalize them.
   if(/^data:image\//i.test(value)){
     const comma=value.indexOf(',');if(comma<0)return'';
     const meta=value.slice(0,comma).replace(/\s+/g,'').toLowerCase();
     if(!/^data:image\/(?:png|jpeg|jpg|webp);base64$/.test(meta))return'';
     let payload=value.slice(comma+1).replace(/\s+/g,'').replace(/-/g,'+').replace(/_/g,'/');
     if(!payload||!/^[A-Za-z0-9+/]*={0,2}$/.test(payload))return'';
     payload=payload.replace(/=+$/,'');payload+='='.repeat((4-payload.length%4)%4);
     return meta+','+payload;
   }
   // The Edge Function normally converts raw base64 to a data URI, but tolerate it here too.
   let payload=value.replace(/\s+/g,'').replace(/-/g,'+').replace(/_/g,'/');
   if(payload.length>100&&/^[A-Za-z0-9+/]+={0,2}$/.test(payload)){
     payload=payload.replace(/=+$/,'');payload+='='.repeat((4-payload.length%4)%4);return'data:image/png;base64,'+payload;
   }
   return'';
 }
 function showPayStage(id){$('orderStage').hidden=true;$('payStage').hidden=false;$('orderIdText').textContent=id;window.scrollTo({top:0,behavior:'smooth'})}
 function renderInvoice(data){
   const qr=safeQrSource(data.qr_url||data.qrUrl),checkout=safeUrl(data.checkout_url||data.checkoutUrl);
   if(qr){const img=document.createElement('img');img.src=qr;img.alt='QR pembayaran Cashi';img.loading='eager';img.addEventListener('error',()=>{$('qrFrame').innerHTML='<div class="qr-placeholder"><i class="fa-solid fa-triangle-exclamation"></i><b>QR gagal ditampilkan</b><small>Gunakan tombol Buka pembayaran Cashi jika tersedia, atau coba buat QR lagi.</small></div>';qrCreated=!!checkout;$('retryCashi').hidden=qrCreated;},{once:true});$('qrFrame').replaceChildren(img)}
   else if(checkout){
     // Cashi returned a checkout link but no usable native QR. Render a QR code
     // that encodes the checkout URL, so scanning it opens Cashi's payment page.
     const wrap=document.createElement('div');wrap.className='generated-checkout-qr';
     const img=document.createElement('img');
     img.alt='QR untuk membuka halaman pembayaran Cashi';img.loading='eager';
     img.width=300;img.height=300;
     img.src='https://api.qrserver.com/v1/create-qr-code/?size=300x300&format=png&data='+encodeURIComponent(checkout);
     const caption=document.createElement('small');caption.textContent='QR ini membuka halaman pembayaran Cashi. Pastikan nominal dan pesanan benar sebelum membayar.';
     img.addEventListener('error',()=>{wrap.innerHTML='<div class="qr-placeholder"><i class="fa-solid fa-arrow-up-right-from-square"></i><b>QR tidak dapat dimuat</b><small>Gunakan tombol Buka pembayaran Cashi di bawah.</small></div>'},{once:true});
     wrap.append(img,caption);$('qrFrame').replaceChildren(wrap);
   }
   else $('qrFrame').innerHTML='<div class="qr-placeholder"><i class="fa-solid fa-triangle-exclamation"></i><b>QR belum diterima</b><small>Tekan coba lagi atau hubungi admin.</small></div>';
   let link=$('cashCheckoutLink');
   if(checkout){link.href=checkout;link.hidden=false}else{link.hidden=true;link.removeAttribute('href')}
   $('payAmount').textContent=fmt(Number(data.amount||plan.amount));
   qrCreated=!!(qr||checkout);$('retryCashi').hidden=qrCreated||!!data.recovery_required;
 }
 async function createCashiInvoice(id){
   $('retryCashi').disabled=true;message('Menghubungkan ke Cashi dan membuat QR nominal otomatis…',false,'paymentStatus');
   const {data,error}=await db.functions.invoke('jsvidey-cashi-create-payment',{body:{order_id:id}});
   $('retryCashi').disabled=false;
   if(error){
     let detail=await functionErrorDetail(error);
     if(/CASHI_ORDER_EXISTS_NO_CHECKOUT|DUPLICATE_ORDER_ID|duplicate order_id/i.test(detail)){
       detail='Cashi sudah memiliki transaksi untuk pesanan ini, tetapi QR/checkout belum berhasil dipulihkan. Jangan membuat transaksi baru. Hubungi admin/Cashi untuk memulihkan transaksi yang sama.';
       $('retryCashi').hidden=true;
     } else $('retryCashi').hidden=false;
     message(detail,true,'paymentStatus');return false;
   }
   if(!data||data.error){
     const detail=data?.detail||data?.error||'Gagal membuat pembayaran';
     message(detail,true,'paymentStatus');
     $('retryCashi').hidden=data?.error==='CASHI_ORDER_EXISTS_NO_CHECKOUT';
     return false;
   }
   renderInvoice(data);
   if(data.recovery_required) message('Transaksi lama ditemukan di Cashi, tetapi QR/checkout tidak dikirim oleh API. Jangan membuat transaksi baru; hubungi admin/Cashi untuk pemulihan checkout.',true,'paymentStatus');
   else message(data.reused?'Transaksi Cashi lama berhasil dipulihkan. Periksa QR/tautan pembayaran di atas.':'QR Cashi dibuat. Bayar tepat sesuai nominal yang ditampilkan.',false,'paymentStatus');
   return true;
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
     if(error)throw new Error(await functionErrorDetail(error));
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
