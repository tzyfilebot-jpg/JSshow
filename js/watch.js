const WATCH_SUPABASE_URL='https://ordvxiydkxbtahjpseph.supabase.co';
const WATCH_SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yZHZ4aXlka3hidGFoanBzZXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2MDM3MjMsImV4cCI6MjEwODE3OTcyM30.PCruI7EeLyagV_PMyCd57s3N9oYcL41k-fEgwE8G60E';
const watchWithTimeout=(promise,ms=12000,message='Permintaan ke Supabase terlalu lama.')=>Promise.race([Promise.resolve(promise),new Promise((_,reject)=>setTimeout(()=>reject(new Error(message)),ms))]);
(async()=>{
 const $=id=>document.getElementById(id);
 let videoId=new URLSearchParams(location.search).get('id');
 const params=new URLSearchParams(location.search);
 let videoSlug=params.get('slug');
 if(!videoSlug && !videoId){const parts=location.pathname.split('/').filter(Boolean);if(parts.length===1 && !parts[0].includes('.')){try{videoSlug=decodeURIComponent(parts[0]);}catch(_){videoSlug=parts[0];}}}
 const state=$('state'),player=$('player'),frame=$('embedFrame'),iframe=$('embedPlayer');
 const ratioTools=$('ratioTools');
 const entryNotice=$('watchEntryNotice'),entryThumb=$('watchEntryThumbnail'),entryTitle=$('watchEntryTitle'),entryPlay=$('watchEntryPlay'),entryJoin=$('watchEntryJoin'),entryLoading=$('watchEntryLoading');
 let pendingVideo=null,playStarting=false;
 function openEntryNotice(record){
   pendingVideo=record; playStarting=false;
   if(entryTitle)entryTitle.textContent=record.title||'Video Jsvidey';
   if(entryThumb){const thumb=record.thumbnail_url||record.thumbnail||record.thumbnailUrl||''; if(thumb){entryThumb.src=thumb;entryThumb.hidden=false;entryThumb.onerror=()=>{entryThumb.hidden=true;};}else{entryThumb.removeAttribute('src');entryThumb.hidden=true;}}
   if(entryLoading)entryLoading.hidden=true;
   if(entryPlay){entryPlay.disabled=false;entryPlay.innerHTML='<i class="fa-solid fa-play"></i> Play';}
   if(entryNotice)entryNotice.hidden=false;
 }
 function closeEntryNotice(){if(entryNotice)entryNotice.hidden=true;}
 if(entryJoin)entryJoin.href='https://t.me/+DqdGHeiPZA9mYTQx';
 if(entryPlay)entryPlay.addEventListener('click',async()=>{
   if(playStarting||!pendingVideo)return;
   playStarting=true; entryPlay.disabled=true;
   if(entryLoading){entryLoading.hidden=false;entryLoading.innerHTML='<i class="fa-solid fa-circle-notch fa-spin"></i> Menyiapkan pemutar…';}
   entryPlay.innerHTML='<i class="fa-solid fa-circle-notch fa-spin"></i> Membuka…';
   // Do not await a countdown before opening the player: mobile browsers can
   // discard the user's playback gesture after an async delay.
   const selected=pendingVideo;
   closeEntryNotice();
   try {
     showEmbed(selected.video_url,selected.title);
     if(player && !player.hidden) {
       // Keep playback initiation in the original click gesture for mobile Safari.
       player.load();
       try {
         await player.play();
       } catch (_) {
         const status=$('statusText');
         if(status)status.textContent='Video siap. Tekan tombol ▶ pada pemutar untuk mulai menonton.';
       }
     }
   } catch(error) {
     fail('Video tidak dapat dibuka: '+(error?.message||'Periksa URL video.'));
   } finally {
     playStarting=false;
     if(entryLoading)entryLoading.hidden=true;
     if(entryPlay){entryPlay.disabled=false;entryPlay.innerHTML='<i class="fa-solid fa-play"></i> Play';}
   }
 });
 const ratioButtons=ratioTools?Array.from(ratioTools.querySelectorAll('[data-ratio]')):[];
 function setRatio(mode){if(frame){frame.classList.toggle('landscape',mode==='landscape');frame.classList.toggle('portrait',mode==='portrait');}ratioButtons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.ratio===mode)));}
 ratioButtons.forEach(b=>b.addEventListener('click',()=>setRatio(b.dataset.ratio)));
 function fail(message){
   if(state){state.hidden=false;state.classList.add('error');state.textContent=message;}
   const status=$('statusText');if(status)status.textContent=message;
 }
 function classify(raw){
   let u;try{u=new URL(String(raw||'').trim())}catch(_){throw new Error('Link media tidak valid.')}
   if(u.protocol!=='https:')throw new Error('Link media tidak aman. Hanya HTTPS yang didukung.');
   const host=u.hostname.toLowerCase().replace(/^www\./,'');const path=u.pathname;let id,provider='Media eksternal',embed=u.href;
   if(host==='youtu.be'||host==='youtube.com'||host==='m.youtube.com'||host==='youtube-nocookie.com'){
     if(host==='youtu.be')id=path.split('/').filter(Boolean)[0];
     else if(path==='/watch')id=u.searchParams.get('v');
     else id=(path.match(/^\/(?:embed|shorts|live)\/([^/?]+)/)||[])[1];
     if(!id)throw new Error('Link YouTube tidak dikenali.');
     provider='YouTube';embed='https://www.youtube-nocookie.com/embed/'+encodeURIComponent(id);
   }else if(host==='drive.google.com'){
     id=(path.match(/\/file\/d\/([^/]+)/)||[])[1]||u.searchParams.get('id');
     if(!id)throw new Error('Link Google Drive tidak dikenali.');
     provider='Google Drive';embed='https://drive.google.com/file/d/'+encodeURIComponent(id)+'/preview';
   }else if(host==='videy.co'||host.endsWith('.videy.co')||host==='videy.net'||host.endsWith('.videy.net')){
     provider='Videy';
     // Normalize Videy share URLs to the canonical player route.
     const videyId=u.searchParams.get('id') || (path.match(/\/v\/([^/]+)/)||[])[1];
     if(videyId){embed='https://videy.co/v/?id='+encodeURIComponent(videyId);}
     else if(path==='/v/' || path==='/v'){throw new Error('Link Videy tidak memiliki ID video (?id=...).');}
   }else if(host==='vimeo.com'||host==='player.vimeo.com'){
     id=host==='player.vimeo.com'?(path.match(/\/video\/([0-9]+)/)||[])[1]:path.split('/').filter(Boolean)[0];
     if(!id||!/^\d+$/.test(id))throw new Error('Link Vimeo tidak dikenali.');
     provider='Vimeo';embed='https://player.vimeo.com/video/'+id;
   }
   const direct=/\.(mp4|webm|mov|m4v|ogv|ogg|m3u8)$/i.test(path);
   return {embed,provider,direct};
 }
 let embedWatchdog=null;
 function showEmbed(url,title){
   const m=classify(url);
   if(embedWatchdog){clearTimeout(embedWatchdog);embedWatchdog=null;}
   window.__sourceVideoUrl=url;
   const titleEl=$('videoTitle');if(titleEl)titleEl.textContent=title||'Video Jsvidey';
   const status=$('statusText');
   // Exactly one renderer is active at a time. Keep the loading message as an
   // overlay, not as a separate block above the media.
   if(state){state.hidden=false;state.classList.remove('error');state.innerHTML='<i class="fa-solid fa-circle-notch fa-spin"></i><span>Memuat pemutar '+m.provider+'…</span>';}
   if(m.direct){
     if(ratioTools)ratioTools.hidden=true;
     frame.classList.remove('portrait','landscape');
     iframe.removeAttribute('src');frame.hidden=true;
     player.pause();player.removeAttribute('src');player.hidden=false;player.controls=true;player.setAttribute('controls','');player.setAttribute('playsinline','');player.load();
     player.onerror=()=>{
       const msg='Video gagal dimuat di pemutar JSSHOW. Pastikan URL MP4 aktif dan penyedia mengizinkan pemutaran dari website lain.';
       if(state){state.hidden=false;state.classList.add('error');state.textContent=msg;}
       const status=$('statusText');if(status)status.textContent=msg;
     };
     player.onloadeddata=()=>{if(state){state.hidden=true;state.classList.remove('error');}};
     player.oncanplay=()=>{if(state){state.hidden=true;state.classList.remove('error');}};
     player.onloadedmetadata=()=>{
       if(player.videoWidth&&player.videoHeight)player.style.aspectRatio=player.videoWidth+'/'+player.videoHeight;
     };
     player.src=m.embed;
     player.hidden=false;player.controls=true;
     player.setAttribute('controls','');player.setAttribute('playsinline','');
     player.load();
   }
   else{
     player.pause();player.removeAttribute('src');player.load();player.hidden=true;
     iframe.onload=()=>{
       if(embedWatchdog){clearTimeout(embedWatchdog);embedWatchdog=null;}
       if(state){state.hidden=true;state.classList.remove('error');}
       if(status)status.textContent=m.provider==='Google Drive'?'Google Drive terbuka. Jika video tidak muncul, periksa izin file dan coba buka sumber aslinya.':'Pemutar '+m.provider+' sudah dimuat. Jika video tetap kosong, buka sumber video langsung.';
     };
     iframe.onerror=()=>{
       if(embedWatchdog){clearTimeout(embedWatchdog);embedWatchdog=null;}
       const msg='Pemutar '+m.provider+' gagal dimuat. Penyedia mungkin memblokir embed atau link sudah tidak aktif.';
       if(state){state.hidden=false;state.classList.add('error');state.textContent=msg;}
       if(status)status.textContent=msg;
     };
     iframe.src=m.embed;frame.hidden=false;
     const isDrive=m.provider==='Google Drive';if(ratioTools)ratioTools.hidden=!isDrive;setRatio('landscape');
     // Avoid an endless spinner when a provider blocks iframe loading silently.
     embedWatchdog=setTimeout(()=>{
       embedWatchdog=null;
       if(state){state.hidden=false;state.classList.add('error');state.textContent='Pemutar tidak memberi respons. Link mungkin diblokir, privat, atau tidak mendukung embed.';}
       if(status){
         const safeUrl=String(url).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
         status.innerHTML='Pemutar tidak merespons. <a href="'+safeUrl+'" target="_blank" rel="noopener noreferrer">Buka video langsung</a>. Untuk Google Drive, pastikan akses file diatur ke “Siapa saja yang memiliki link”.';
       }
     },18000);
   }
   if(state && m.direct){state.hidden=false;state.classList.remove('error');state.innerHTML='<i class="fa-solid fa-circle-notch fa-spin"></i><span>Menyiapkan video…</span>';}
   if(status)status.textContent=m.provider==='Google Drive'?'Media: Google Drive. Pastikan file disetel “Siapa saja yang memiliki link” sebagai Viewer; file privat atau yang dibatasi organisasi tidak dapat diputar melalui embed.':'Media: '+m.provider+'. Tombol Download tersedia di bagian bawah video jika penyedia mendukungnya.';
   const downloadPageButton=$('downloadPageButton');if(downloadPageButton)downloadPageButton.href='/download.html?id='+encodeURIComponent(videoId);
 }
 const startupWatchdog=setTimeout(()=>{if(state&&!state.hidden&&!state.classList.contains('error')&&(!entryNotice||entryNotice.hidden)){fail('Halaman video belum berhasil menyiapkan data. Periksa koneksi atau fungsi lookup video di Supabase, lalu muat ulang.');}},14000);
 if(!videoId&&!videoSlug){clearTimeout(startupWatchdog);fail('Link video tidak ditemukan. Buka tautan video yang valid.');return;}
 if(videoId&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(videoId)){
   // URL pendek lama dapat masuk sebagai ?id=slug; perlakukan sebagai slug.
   videoSlug=videoId;videoId=null;
 }
 try{
   // Use the authenticated Supabase client for both UUID and slug lookups. This preserves
   // the signed-in JWT for member-only videos without granting broad SELECT access to videos.
   if (!window.jsvideySupabaseClient && !window.supabase?.createClient) throw new Error('Library Supabase gagal dimuat.');
   const db = window.jsvideySupabaseClient || (window.jsvideySupabaseClient = window.supabase.createClient(WATCH_SUPABASE_URL, WATCH_SUPABASE_ANON_KEY, {
     auth: { persistSession: true, autoRefreshToken: true, storageKey: 'sb-ordvxiydkxbtahjpseph-auth-token' }
   }));
   const rpcName = videoSlug ? 'get_public_embed_video_by_slug' : 'get_public_embed_video';
   const rpcArgs = videoSlug ? { p_slug: videoSlug } : { p_video_id: videoId };
   const { data, error } = await watchWithTimeout(
     db.rpc(rpcName, rpcArgs), 12000,
     'Lookup video melewati batas 12 detik. Periksa fungsi ' + rpcName + ' di Supabase.'
   );
   if (error) throw new Error(error.message || 'Lookup video gagal. Pastikan SQL lookup video sudah diterapkan.');
   const record = Array.isArray(data) ? data[0] : data;
   if(!record?.video_url||record.status!=='published'){
     const access=await watchWithTimeout(db.rpc('jsvidey_video_access_status',{p_video_id:videoId||null,p_slug:videoSlug||null}),8000,'Pemeriksaan akses video terlalu lama.');
     const info=Array.isArray(access.data)?access.data[0]:access.data;
     if(info&&!info.allowed){
       const audience=String(info.audience||'vip').toLowerCase();
       const premium=audience==='premium';
       const message=premium?'Video ini khusus anggota Premium.':'Video ini khusus anggota VIP dan Premium.';
       let signedIn=false;
       try { const auth=await watchWithTimeout(db.auth.getUser(),5000,''); signedIn=Boolean(auth?.data?.user); } catch (_) {}
       const next=location.pathname+location.search;
       const loginUrl='/login.html?next='+encodeURIComponent(next);
       const registerUrl='/register.html?next='+encodeURIComponent(next);
       const actions=signedIn
         ? '<a class="watch-access-cta" href="/vip.html"><i class="fa-solid fa-crown"></i> Upgrade</a>'
         : '<a class="watch-access-cta" href="'+loginUrl+'"><i class="fa-solid fa-right-to-bracket"></i> Login</a><a class="watch-access-secondary" href="'+registerUrl+'"><i class="fa-solid fa-user-plus"></i> Daftar</a>';
       if(state){state.hidden=false;state.classList.add('error','watch-access-state');state.innerHTML='<div class="watch-access-icon"><i class="fa-solid fa-crown"></i></div><strong>'+message+'</strong><p>'+(signedIn?'Upgrade status akunmu untuk membuka video ini.':'Login atau daftar terlebih dahulu. Setelah masuk, kamu bisa upgrade status akun untuk menonton video ini.')+'</p><div class="watch-access-actions">'+actions+'</div>';}
       const status=$('statusText');if(status)status.textContent=message;
     }else fail('Video tidak ditemukan, belum dipublikasikan, atau link belum tersimpan.');
     return;
   }
   videoId=record.id;
   window.__jsvideyVideoId=record.id;
   window.__jsvideyVideoSlug=record.slug||videoSlug||null;
   window.dispatchEvent(new CustomEvent('jsvidey:video-ready',{detail:{id:record.id,slug:record.slug||videoSlug||null}}));
   window.__jsvideyShareUrl=window.__jsvideyVideoSlug ? location.origin+'/v/'+encodeURIComponent(window.__jsvideyVideoSlug) : location.origin+'/watch.html?id='+encodeURIComponent(record.id);
   // Show the title/thumbnail gate first. The player is mounted only after Play + 3s loading.
   clearTimeout(startupWatchdog);
   openEntryNotice(record);
   // Count a view through a database function; never allow the browser to write raw view rows.
   watchWithTimeout(db.rpc('jsvidey_record_video_view',{p_video_id:record.id}),8000,'Pencatatan view terlalu lama.')
     .then(({error})=>{if(error)console.warn('View count not recorded:',error.message)})
     .catch(error=>console.warn('View count not recorded:',error.message));
 }catch(e){
   clearTimeout(startupWatchdog);
   console.error('Embed lookup failed:',e);
   const detail=e?.name==='AbortError'?'Permintaan ke Supabase melewati batas waktu 12 detik.':(e?.message||String(e));
   fail('Gagal memuat link embed: '+detail+' Coba muat ulang halaman.');
 }
})();
