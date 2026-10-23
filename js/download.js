const SUPABASE_URL='https://ordvxiydkxbtahjpseph.supabase.co';
const SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yZHZ4aXlka3hidGFoanBzZXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2MDM3MjMsImV4cCI6MjEwODE3OTcyM30.PCruI7EeLyagV_PMyCd57s3N9oYcL41k-fEgwE8G60E';
(async()=>{
 const $=id=>document.getElementById(id),params=new URLSearchParams(location.search),id=params.get('id');
 const status=$('downloadStatus'),title=$('downloadTitle'),eligibility=$('downloadEligibility'),tasks=$('adTasks'),ready=$('downloadReady'),downloadButton=$('downloadNow');
 let source='',downloadUrl='',isDownloadable=false,activeStep=0,adTimers=new Map(),finished=new Set();
 const adDirect='https://www.profitableratercpmnetwork.com/pkmkxfrmiy?key=5b5750804fb6a29007e75d321e567d75';
 const ad1Src='https://pl31626285.profitableratercpmnetwork.com/1e/25/0c/1e250cc0da41c572970286fab29d5009.js';
 const ad3Src='https://pl31626334.profitableratercpmnetwork.com/ef7f0e942fbcf5b02dd491deb0f7ac5f/invoke.js';
 function safeTitle(value){return String(value||'JSSHOW-video').normalize('NFKD').replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80)||'JSSHOW-video'}
 function loadScript(src,attrs={}){return new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.async=true;script.referrerPolicy='no-referrer-when-downgrade';Object.entries(attrs).forEach(([k,v])=>script.setAttribute(k,v));script.onload=()=>resolve();script.onerror=()=>reject(new Error('Skrip iklan tidak dapat dimuat; mungkin diblokir browser.'));document.body.append(script)})}
 function setStepState(step,message){const el=$('ad'+step+'Status');if(el)el.textContent=message}
 function unlockStep(step){const next=$(`[data-open-ad="${step}"]`);if(next)next.disabled=false}
 function startCountdown(step){const btn=$(`[data-continue-ad="${step}"]`),open=$(`[data-open-ad="${step}"]`);if(!btn)return;let remaining=10;btn.disabled=true;btn.querySelector('span').textContent=remaining+' dtk';const old=adTimers.get(step);if(old)clearInterval(old);const timer=setInterval(()=>{remaining--;if(remaining<=0){clearInterval(timer);adTimers.delete(step);btn.disabled=false;btn.querySelector('span').textContent='Lanjut sekarang';setStepState(step,'Waktu iklan selesai. Lanjutkan ke langkah berikutnya.');if(open)open.disabled=true}else btn.querySelector('span').textContent=remaining+' dtk'},1000);adTimers.set(step,timer)}
 async function openAd(step){if(step!==activeStep+1||finished.has(step))return;activeStep=step;const open=$(`[data-open-ad="${step}"]`);if(open)open.disabled=true;setStepState(step,'Iklan dibuka. Tunggu 10 detik sebelum melanjutkan.');
   if(step===1){$('ad1Slot').hidden=false;try{await loadScript(ad1Src)}catch(e){setStepState(step,'Iklan mungkin diblokir. Tunggu sebentar lalu lanjutkan.')}}
   if(step===2){const popup=window.open(adDirect,'_blank');if(popup){try{popup.opener=null}catch(_){}}setStepState(step,popup?'Iklan dibuka di tab baru. Tunggu 10 detik di halaman ini.':'Popup mungkin diblokir browser. Iklan mungkin perlu dibuka manual: '+adDirect)}
   if(step===3){$('ad3Slot').hidden=false;try{await loadScript(ad3Src,{'data-cfasync':'false'})}catch(e){setStepState(step,'Iklan mungkin diblokir. Tunggu sebentar lalu lanjutkan.')}}
   startCountdown(step);
 }
 document.querySelectorAll('[data-open-ad]').forEach(btn=>btn.addEventListener('click',()=>openAd(Number(btn.dataset.openAd))));
 document.querySelectorAll('[data-continue-ad]').forEach(btn=>btn.addEventListener('click',()=>{const step=Number(btn.dataset.continueAd);if(btn.disabled||step!==activeStep)return;finished.add(step);btn.disabled=true;btn.textContent='Selesai ✓';setStepState(step,'Langkah selesai.');if(step<3){unlockStep(step+1);setStepState(step+1,'Siap dimulai.')}else{tasks.hidden=true;ready.hidden=false;status.textContent='Semua langkah iklan sudah diselesaikan.';eligibility.textContent='Download siap dimulai.'}}));
 if(!id){status.textContent='ID video tidak ditemukan. Buka halaman ini dari tombol Download di halaman video.';eligibility.textContent='Tidak dapat memeriksa file tanpa ID video.';return}
 $('backToWatch').href='watch.html?id='+encodeURIComponent(id);
 if(!window.supabase?.createClient){status.textContent='Library database gagal dimuat.';return}
 const db=window.jsvideySupabaseClient||window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,storageKey:'sb-ordvxiydkxbtahjpseph-auth-token'}});
 try{
   const {data:authData,error:authError}=await db.auth.getUser();if(authError||!authData?.user){location.replace('login.html?next='+encodeURIComponent('download.html?id='+id));return}
   const {data,error}=await db.rpc('get_public_embed_video',{p_video_id:id});const v=Array.isArray(data)?data[0]:data;
   if(error||!v?.video_url||v.status!=='published')throw error||new Error('Video tidak ditemukan atau belum dipublikasikan.');
   source=v.video_url;title.textContent=v.title||'Video JSSHOW';const u=new URL(source);const driveId=(u.hostname==='drive.google.com'&&(u.pathname.match(/\/file\/d\/([^/]+)/)||[])[1])||u.searchParams.get('id');const direct=/\.(mp4|webm|mov|m4v|ogv|ogg)(?:$)/i.test(u.pathname);
   if(driveId){downloadUrl='https://drive.google.com/uc?export=download&id='+encodeURIComponent(driveId);isDownloadable=true}else if(direct){downloadUrl=source;isDownloadable=true}else{status.textContent='Video ditemukan, tetapi sumbernya tidak menyediakan tautan download langsung yang dapat dikenali.';eligibility.textContent='Download tidak tersedia untuk sumber ini. Penyedia seperti YouTube/Vimeo biasanya hanya mengizinkan pemutaran atau berbagi lewat platform asal.';tasks.hidden=true;ready.hidden=true;return}
   status.textContent='Video ditemukan. Selesaikan 3 langkah di bawah untuk melanjutkan.';eligibility.textContent='Sumber mendukung tautan download. Setelah tiga langkah selesai, tombol Download Now akan muncul.';tasks.hidden=false;unlockStep(1);
 }catch(e){status.textContent='Tidak bisa membaca video: '+(e?.message||'kesalahan tidak diketahui');eligibility.textContent='Pastikan video dipublikasikan, akses akun sesuai, dan fungsi get_public_embed_video tersedia.';console.error('Download page init failed:',e);return}
 downloadButton.addEventListener('click',()=>{if(!isDownloadable||finished.size!==3)return;try{if(downloadUrl.includes('drive.google.com/uc?export=download')){window.location.href=downloadUrl;status.textContent='Permintaan download Google Drive dibuka.';return}const a=document.createElement('a');a.href=downloadUrl;a.download=safeTitle(title.textContent);a.rel='noopener';a.target='_blank';document.body.append(a);a.click();a.remove();status.textContent='Permintaan download dikirim. Jika file terbuka di tab baru, gunakan menu download dari browser atau penyedia.'}catch(e){status.textContent='Download gagal dimulai: '+(e?.message||'silakan buka sumber video langsung.')}});
})();