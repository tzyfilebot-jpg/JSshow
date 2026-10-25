const PAYMENT_SUPABASE_URL='https://ordvxiydkxbtahjpseph.supabase.co';
const PAYMENT_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yZHZ4aXlka3hidGFoanBzZXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2MDM3MjMsImV4cCI6MjEwODE3OTcyM30.PCruI7EeLyagV_PMyCd57s3N9oYcL41k-fEgwE8G60E';
(function(){
 const plans={vip1:{label:'VIP 1 Hari',amount:20000},vip3:{label:'VIP 3 Hari',amount:35000},vip5:{label:'VIP 5 Hari',amount:45000},vip7:{label:'VIP 7 Hari',amount:50000},premium_monthly:{label:'PREMIUM 1 Bulan',amount:100000,package:'premium_monthly'},premium_permanent:{label:'PREMIUM Permanen',amount:250000,package:'premium_permanent'}};
 const $=id=>document.getElementById(id),fmt=n=>'Rp'+new Intl.NumberFormat('id-ID').format(n);
 const params=new URLSearchParams(location.search),key=params.get('plan')||'vip1',plan=plans[key]||plans.vip1,packageKey=plan.package||key;
 $('orderPlan').textContent=plan.label;$('orderAmount').textContent=fmt(plan.amount);$('payPlan').textContent=plan.label;$('payAmount').textContent=fmt(plan.amount);
 const confirmPackage=$('confirmPackage'),createOrderButton=$('createOrder');
 if(confirmPackage&&createOrderButton){createOrderButton.disabled=!confirmPackage.checked;confirmPackage.addEventListener('change',()=>{createOrderButton.disabled=!confirmPackage.checked;});}
 let db=null,user=null,orderId=null,qrCreated=false,statusTimer=null,statusBusy=false;
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
   if(s && typeof s==='object'){
     s=s.data_url||s.dataUrl||s.url||s.qrUrl||s.qr_url||s.base64||s.content||s.qr||'';
   }
   const value=String(s||'').trim();
   if(/^https:\/\//i.test(value))return safeUrl(value);
   // Cashi's qrUrl is commonly a data URI. Keep its original MIME type
   // instead of rejecting image types not anticipated by the previous parser.
   if(/^data:image\//i.test(value)){
     const comma=value.indexOf(',');
     if(comma<0)return '';
     const meta=value.slice(0,comma).trim();
     const payload=value.slice(comma+1).trim();
     if(!payload)return '';
     if(/;base64$/i.test(meta)){
       const compact=payload.replace(/\s+/g,'').replace(/-/g,'+').replace(/_/g,'/');
       if(!compact||!/^[A-Za-z0-9+/]*={0,2}$/.test(compact))return '';
       let normalized=compact.replace(/=+$/,'');
       normalized+='='.repeat((4-normalized.length%4)%4);
       return meta+','+normalized;
     }
     // Accept valid non-base64 data URIs, including percent-encoded SVG.
     if(/%[0-9a-f]{2}/i.test(payload)||/^data:image\/svg\+xml/i.test(value))return value;
     return '';
   }
   // Some gateways return a bare base64 image rather than a data URI.
   const compact=value.replace(/\s+/g,'').replace(/-/g,'+').replace(/_/g,'/');
   if(compact.length>100&&/^[A-Za-z0-9+/]+={0,2}$/.test(compact)){
     let normalized=compact.replace(/=+$/,'');
     normalized+='='.repeat((4-normalized.length%4)%4);
     return 'data:image/png;base64,'+normalized;
   }
   return '';
 }
 function showPayStage(id){$('orderStage').hidden=true;$('payStage').hidden=false;$('orderIdText').textContent=id;window.scrollTo({top:0,behavior:'smooth'})}
 function renderInvoice(data){
   const qr=safeQrSource(data.qr_url||data.qrUrl||data.qr),checkout=safeUrl(data.checkout_url||data.checkoutUrl||data.payment_url);
   const frame=$('qrFrame');frame.replaceChildren();
   if(qr){
     const img=document.createElement('img');img.src=qr;img.alt='QR pembayaran Cashi';img.loading='eager';
     img.addEventListener('error',()=>{
       frame.innerHTML='<div class="qr-placeholder"><i class="fa-solid fa-triangle-exclamation"></i><b>QR Cashi tidak dapat dibaca</b><small>Periksa kembali status pesanan atau hubungi dukungan pembayaran.</small></div>';
     },{once:true});frame.append(img);
   } else frame.innerHTML='<div class="qr-placeholder"><i class="fa-solid fa-triangle-exclamation"></i><b>QRIS Cashi belum diterima</b><small>QR tidak dibuat dari tautan biasa. Gunakan tombol Membayar untuk membuka checkout Cashi jika tersedia, atau coba pulihkan transaksi yang sama.</small></div>'; 
   const payNow=$('payNowButton');
   if(checkout){payNow.href=checkout;payNow.hidden=false;}else{payNow.hidden=true;payNow.removeAttribute('href');}
   $('payAmount').textContent=fmt(Number(data.amount||plan.amount));
   qrCreated=!!(qr||checkout);$('retryCashi').hidden=qrCreated||!!data.recovery_required;
 }
 function lang(){try{return localStorage.getItem('jsvidey-language')||'id'}catch(_){return'id'}}
 async function createCashiInvoice(id){
   const retry=$('retryCashi'),frame=$('qrFrame');retry.disabled=true;frame.innerHTML='<div class="qr-loading" role="status" aria-live="polite"><span class="qr-spinner" aria-hidden="true"></span><b>'+ (lang()==='en'?'Creating your Cashi payment QR…':'Sedang membuat QR pembayaran Cashi…') +'</b><small>'+ (lang()==='en'?'Please wait. The QR will match your selected package amount.':'Mohon tunggu. QR akan sesuai nominal paket yang dipilih.') +'</small></div>';message(lang()==='en'?'Connecting to Cashi and creating a payment…':'Menghubungkan ke Cashi dan membuat pembayaran…',false,'paymentStatus');
   let result;try{result=await db.functions.invoke('jsvidey-cashi-create-payment',{body:{order_id:id}})}catch(e){result={error:e}}
   const {data,error}=result;retry.disabled=false;
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
   if(data.recovery_required) message('Pesanan tersimpan, tetapi Cashi belum memberikan QR atau tautan pembayaran yang dapat ditampilkan. Status akan diperiksa otomatis. Jangan membuat pesanan baru untuk transaksi ini.',true,'paymentStatus');
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
   const {data,error}=await db.rpc('jsvidey_create_payment_order',{p_package:packageKey});
   if(error){btn.disabled=false;message('Pesanan belum dapat dibuat: '+error.message,true);return}
   orderId=typeof data==='string'?data:(data?.id||data?.order_id||data?.orderId);
   if(!orderId){message('ID pesanan tidak diterima. Hubungi admin sebelum membayar.',true);return}
   showPayStage(orderId);
   await createCashiInvoice(orderId);startAutoCheck();btn.disabled=false;
 }
 async function checkPayment(silent=false){
   if(!db||!orderId||statusBusy)return;
   statusBusy=true;
   const btn=$('checkPayment');if(!silent)btn.disabled=true;
   if(!silent)message('Memeriksa status langsung ke Cashi…',false,'paymentStatus');
   try{
     const {data,error}=await db.functions.invoke('jsvidey-cashi-check-status',{body:{order_id:orderId}});
     if(error)throw new Error(await functionErrorDetail(error));
     if(data?.error)throw new Error(data.detail||data.error);
     if(data?.status==='APPROVED'){message('Pembayaran disetujui admin. Membership sudah diproses.',false,'paymentStatus');$('submitProof').disabled=true;if(statusTimer)clearInterval(statusTimer);return}
     if(data?.status==='REJECTED'){message('Pembayaran ditolak admin. Periksa catatan admin atau hubungi admin.',true,'paymentStatus');if(statusTimer)clearInterval(statusTimer);return}
     if(data?.paid){message(data?.membership_activated?'Pembayaran lunas! Membership VIP/Premium sudah aktif otomatis.':'Pembayaran lunas terdeteksi. Sistem sedang menyelesaikan aktivasi membership.',false,'paymentStatus');$('submitProof').disabled=true;if(statusTimer)clearInterval(statusTimer);}
     else message('Status Cashi: '+(data?.status||'PENDING')+'. Jika baru membayar, tunggu sebentar lalu cek kembali.',false,'paymentStatus');
     const {data:row,error:rowError}=await db.from('jsvidey_payment_orders').select('status,admin_note,cashi_provider_status').eq('id',orderId).maybeSingle();
     if(rowError)throw rowError;
     if(row?.status==='approved'){message('Pembayaran lunas dan membership VIP/Premium sudah aktif.',false,'paymentStatus');$('submitProof').disabled=true}
     else if(row?.status==='rejected')message('Pembayaran ditolak admin. '+(row.admin_note||'Hubungi admin untuk informasi.'),true,'paymentStatus');
     else if(row?.status==='pending_review'&&row?.cashi_provider_status==='SETTLED'){message('Pembayaran terkonfirmasi. Status membership sedang disinkronkan; periksa kembali sebentar lagi.',false,'paymentStatus');$('submitProof').disabled=true}
   }catch(e){if(!silent)message('Gagal mengecek pembayaran: '+(e.message||'coba lagi nanti'),true,'paymentStatus')}
   finally{if(!silent)btn.disabled=false;statusBusy=false}
 }
 function startAutoCheck(){
   if(statusTimer)clearInterval(statusTimer);
   statusTimer=setInterval(()=>{if(!document.hidden)checkPayment(true)},7000);
 }
 async function submitProof(){
   if(!orderId||!db)return;const proof=$('proof').value.trim();
   if(!proof){message('Masukkan nomor referensi atau tautan bukti pembayaran.',true,'paymentStatus');return}
   const btn=$('submitProof');btn.disabled=true;
   const {error}=await db.rpc('jsvidey_submit_payment_proof',{p_order_id:orderId,p_proof:proof});
   if(error){btn.disabled=false;message('Gagal mengirim konfirmasi: '+error.message,true,'paymentStatus');return}
   message('Konfirmasi terkirim. Bukti manual tetap perlu diverifikasi admin; aktivasi otomatis hanya dilakukan setelah Cashi mengonfirmasi lunas.',false,'paymentStatus');
 }
 init().catch(e=>message(e.message||'Gagal memuat pembayaran.',true));
})();
