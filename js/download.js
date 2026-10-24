const SUPABASE_URL='https://ordvxiydkxbtahjpseph.supabase.co';
const SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yZHZ4aXlka3hidGFoanBzZXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2MDM3MjMsImV4cCI6MjEwODE3OTcyM30.PCruI7EeLyagV_PMyCd57s3N9oYcL41k-fEgwE8G60E';
(()=> {
 const $=id=>document.getElementById(id);
 const params=new URLSearchParams(location.search),id=params.get('id');
 const status=$('downloadStatus'),titleEl=$('downloadTitle'),eligibility=$('downloadEligibility');
 const thumbnail=$('downloadThumbnail'),startButton=$('startDownloadFlow'),steps=$('downloadSteps'),ready=$('downloadReady'),downloadButton=$('downloadNow');
 const stepOrder=['top','middle','bottom'];
 const stepElements={top:$('downloadStepTop'),middle:$('downloadStepMiddle'),bottom:$('downloadStepBottom')};
 const stepStatuses={top:$('downloadTopStatus'),middle:$('downloadMiddleStatus'),bottom:$('downloadBottomStatus')};
 let adConfig={};
 let db=null,video=null,currentUser=null,downloadUrl='',busy=false;
 const alignDefaults={top_align:'right',middle_align:'center',bottom_align:'left'};
 function setStatus(text){if(status)status.textContent=text}
 function safeHttps(value){try{const u=new URL(String(value||''));return u.protocol==='https:'?u.href:''}catch(_){return ''}}
 function normalizeDownloadTarget(value){
   const raw=safeHttps(value);if(!raw)return '';
   try{
     const u=new URL(raw);
     if(u.hostname==='drive.google.com'){
       const driveId=(u.pathname.match(/\/file\/d\/([^/]+)/)||[])[1]||u.searchParams.get('id');
       if(driveId && !(u.pathname==='/uc'&&u.searchParams.get('export')==='download'))
         return 'https://drive.google.com/uc?export=download&id='+encodeURIComponent(driveId);
     }
     return u.href;
   }catch(_){return ''}
 }
 function fallbackDownload(source){
   try{
     const u=new URL(source);
     if(u.hostname==='drive.google.com'){
       const driveId=(u.pathname.match(/\/file\/d\/([^/]+)/)||[])[1]||u.searchParams.get('id');
       if(driveId)return 'https://drive.google.com/uc?export=download&id='+encodeURIComponent(driveId);
     }
     if(/\.(mp4|webm|mov|m4v|ogv|ogg)(?:$)/i.test(u.pathname))return u.href;
   }catch(_){}
   return '';
 }
 async function init(){
   if(!id){setStatus('ID video tidak ditemukan. Kembali ke video lalu tekan Download.');eligibility.textContent='Tautan download membutuhkan ID video.';startButton.disabled=true;return}
   $('backToWatch').href='/watch.html?id='+encodeURIComponent(id);
   if(!window.supabase?.createClient){setStatus('Library database gagal dimuat.');startButton.disabled=true;return}
   db=window.jsvideySupabaseClient||window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,storageKey:'sb-ordvxiydkxbtahjpseph-auth-token'}});
   try{
     const auth=await db.auth.getUser();currentUser=auth.data?.user||null;
     const result=await db.rpc('get_public_download_video',{p_video_id:id});
     if(result.error)throw new Error('Fungsi database get_public_download_video belum tersedia. Jalankan sql/jsvidey_download_flow.sql di Supabase.');
     video=Array.isArray(result.data)?result.data[0]:result.data;
     if(!video?.id||video.status!=='published'){
       if(!currentUser){location.replace('/login.html?next='+encodeURIComponent('download.html?id='+id));return}
       throw new Error('Video tidak ditemukan, belum dipublikasikan, atau akun tidak memiliki akses.');
     }
     if(video.audience&&video.audience!=='public'){
       const access=await db.rpc('jsvidey_video_access_status',{p_video_id:video.id,p_slug:video.slug||null});
       const info=Array.isArray(access.data)?access.data[0]:access.data;
       if(!access.error&&info&&!info.allowed){
         setStatus('Video ini memerlukan paket membership yang sesuai.');
         eligibility.innerHTML='Silakan periksa paket akses video di halaman <a href="/vip.html">Membership</a>.';
         startButton.disabled=true;return;
       }
     }
     titleEl.textContent=video.title||'Video JSSHOW';
     if(video.thumbnail_url){thumbnail.src=video.thumbnail_url;thumbnail.hidden=false;thumbnail.onerror=()=>{thumbnail.hidden=true}}
     downloadUrl=normalizeDownloadTarget(video.download_url)||fallbackDownload(video.video_url);
     if(!downloadUrl){
       eligibility.textContent='Link download belum diatur admin. Video ini belum dapat diunduh langsung.';
       startButton.disabled=true;
     }else{
       eligibility.textContent='Tekan Download Video untuk memulai 3 tahap iklan. Setiap tahap menunggu 7 detik.';
       startButton.disabled=false;
     }
     // Read the same official Adsterra configuration used by the rest of the site.
     try{const adResult=await db.rpc('jsvidey_public_platform_status');adConfig=(!adResult.error&&adResult.data)||{}}catch(_){adConfig={}}
     const settingsResult=await db.rpc('jsvidey_get_download_settings');
     const cfg=!settingsResult.error&&settingsResult.data?settingsResult.data:alignDefaults;
     const map={top:cfg.top_align||alignDefaults.top_align,middle:cfg.middle_align||alignDefaults.middle_align,bottom:cfg.bottom_align||alignDefaults.bottom_align};
     stepOrder.forEach(key=>{stepElements[key].dataset.align=['left','center','right'].includes(map[key])?map[key]:'center'});
     setStatus('Video berhasil ditemukan.');
   }catch(error){
     console.error('Download page initialization failed:',error);
     setStatus(error.message||'Gagal memuat informasi video.');
     eligibility.textContent='Pastikan video dipublikasikan, link download benar, dan migrasi SQL download sudah dijalankan.';
     startButton.disabled=true;
   }
 }
 startButton?.addEventListener('click',()=>{
   if(startButton.disabled||!downloadUrl)return;
   startButton.hidden=true;steps.hidden=false;stepElements.top.hidden=false;
   stepStatuses.top.textContent='Klik tombol Download untuk membuka iklan. Setelah itu tunggu 7 detik.';
 });
 document.querySelectorAll('[data-download-step]').forEach(button=>{
   button.addEventListener('click',()=>{
     const key=button.dataset.downloadStep,index=stepOrder.indexOf(key);
     if(index<0||busy||button.disabled)return;
     busy=true;button.disabled=true;button.textContent='Memuat 7 detik…';
     // Never send visitors to a hard-coded third-party ad URL. The official
     // Adsterra Popunder/Social Bar tags are initialized by monetization.js.
     // If a banner tag exists, render that official tag in the current step.
     const adCode=String(adConfig.ad_top_code||adConfig.ad_bottom_code||'').trim();
     const step=stepElements[key];
     let slot=step.querySelector('.download-ad-slot');
     if(!slot){slot=document.createElement('div');slot.className='download-ad-slot';slot.style.cssText='margin:12px auto;max-width:100%;overflow:hidden;text-align:center';step.insertBefore(slot,stepStatuses[key]);}
     slot.replaceChildren();
     if(adCode){
       const doc=new DOMParser().parseFromString(adCode,'text/html');
       for(const node of [...doc.body.childNodes]){
         if(node.nodeType===Node.TEXT_NODE&&!node.textContent.trim())continue;
         if(node.nodeName==='SCRIPT'){
           const script=document.createElement('script');
           for(const attr of [...node.attributes])script.setAttribute(attr.name,attr.value);
           script.text=node.textContent||'';slot.appendChild(script);
         }else if(['DIV','A','IMG','INS','SPAN','P','STYLE','IFRAME'].includes(node.nodeName)){
           const copy=document.importNode(node,true);
           if(copy.nodeName==='IFRAME'&&!/^https:\/\//i.test(copy.getAttribute('src')||''))continue;
           slot.appendChild(copy);
         }
       }
     }
     let remaining=7;
     stepStatuses[key].textContent=adCode?'Slot iklan resmi dimuat. Tunggu '+remaining+' detik…':'Kode banner Adsterra belum diisi di Panel Admin. Tahap tetap berjalan; tambahkan kode agar iklan tampil.';
     const timer=setInterval(()=>{
       remaining--;
       if(remaining<=0){
         clearInterval(timer);busy=false;button.textContent='Selesai ✓';button.disabled=true;
         stepElements[key].hidden=true;
         if(index<stepOrder.length-1){
           const next=stepOrder[index+1];stepElements[next].hidden=false;
           stepStatuses[next].textContent='Tahap berikutnya siap. Klik Download untuk memuat slot iklan dan tunggu 7 detik.';
         }else{
           steps.hidden=true;ready.hidden=false;
           eligibility.textContent='Semua tahap selesai. Tombol akhir membuka link download dari panel admin.';
         }
       }else stepStatuses[key].textContent='Iklan dibuka. Tunggu '+remaining+' detik…';
     },1000);
   });
 });
 downloadButton?.addEventListener('click',async()=>{
   if(!downloadUrl||busy)return;
   busy=true;downloadButton.disabled=true;downloadButton.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Membuka download…';
   try{
     if(db&&currentUser&&video?.id){
       const {error}=await db.from('jsvidey_download_history').insert({user_id:currentUser.id,video_id:video.id,title:video.title||'Video JSSHOW',source_url:video.video_url,download_url:downloadUrl});
       if(error)console.warn('Riwayat download tidak tersimpan:',error.message);
     }
     window.location.assign(downloadUrl);
   }catch(error){
     setStatus('Gagal membuka link download: '+(error.message||'coba lagi.'));
     downloadButton.disabled=false;downloadButton.innerHTML='<i class="fa-solid fa-download"></i> Download Video';busy=false;
   }
 });
 init();
})();