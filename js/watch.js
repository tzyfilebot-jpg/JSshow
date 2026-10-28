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
 function normalizeThumbnailUrl(raw){
   const value=String(raw||'').trim(); if(!value) return '';
   try {
     const u=new URL(value,location.origin); if(u.protocol!=='https:' && u.origin!==location.origin) return '';
     const host=u.hostname.toLowerCase().replace(/^www\./,'');
     if(host==='drive.google.com'||host==='docs.google.com'){
       let id=(u.pathname.match(/\/file\/d\/([^/]+)/)||[])[1]||u.searchParams.get('id');
       if(!id){const m=u.pathname.match(/\/uc\/([^/]+)/);if(m)id=m[1];}
       if(id) return 'https://drive.google.com/thumbnail?id='+encodeURIComponent(id)+'&sz=w1200';
     }
     if(host==='drive.googleusercontent.com') return value;
     return u.href;
   } catch(_){ return ''; }
 }
 function openEntryNotice(record){
   pendingVideo=record; playStarting=false;
   if(entryTitle)entryTitle.textContent=record.title||'Video Jsvidey';
   if(entryThumb){const thumb=normalizeThumbnailUrl(record.thumbnail_url||record.thumbnail||record.thumbnailUrl||record.thumbnail_url_public||''); if(thumb){entryThumb.src=thumb;entryThumb.hidden=false;entryThumb.onerror=()=>{entryThumb.onerror=null;const original=String(record.thumbnail_url||record.thumbnail||record.thumbnailUrl||'');if(original&&original!==thumb){entryThumb.src=original;entryThumb.onerror=()=>{entryThumb.hidden=true;};}else entryThumb.hidden=true;};}else{entryThumb.removeAttribute('src');entryThumb.hidden=true;}}
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
     const playbackType = classify(selected.video_url).direct ? 'video' : 'embed';
     window.dispatchEvent(new CustomEvent('jsvidey:player-started', {detail:{kind:playbackType,url:selected.video_url}}));
     if(player && !player.hidden) {
       // showEmbed() has already assigned src and called load(). Do not call
       // load() a second time here: it can reset/abort the media request just
       // before play() on mobile Safari.
       try {
         await player.play();
       } catch (playError) {
         const status=$('statusText');
         if(status)status.textContent='Video sudah disiapkan. Tekan tombol Play pada pemutar untuk mencoba lagi.';
         console.warn('JSVidey playback did not start from the entry button:', playError);
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
   // Keep lookup/provider errors inline under the video title; do not show a
   // floating overlay over the player.
   if(state){state.hidden=true;state.classList.remove('error','watch-access-state');state.textContent='';}
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
       const mediaError=player.error;
       const errorCode=mediaError?.code || 0;
       const reasons={
         1:'Pemutaran dibatalkan sebelum selesai.',
         2:'Browser gagal mengambil data video dari server sumber. Penyedia mungkin membatasi hotlink atau permintaan dari domain lain.',
         3:'Data video diterima tetapi gagal didekode oleh browser.',
         4:'Sumber tidak dikenali sebagai format video yang didukung atau server menolak permintaan pemutar.'
       };
       const reason=reasons[errorCode] || 'Browser tidak dapat memuat sumber video.';
       const msg='Video gagal diputar (kode '+(errorCode||'tidak tersedia')+'). '+reason;
       if(state){state.hidden=false;state.classList.add('error');state.textContent=msg;}
       const status=$('statusText');
       if(status){
         status.textContent='';
         const detail=document.createElement('span');
         detail.textContent=msg+' Jika URL sumber bisa diputar langsung tetapi gagal di sini, minta penyedia mengizinkan embed/pemutaran dari domain jsshow.pages.dev atau gunakan URL embed resmi mereka.';
         const link=document.createElement('a');
         link.href=String(url);
         link.target='_blank';
         link.rel='noopener noreferrer';
         link.textContent=' Buka sumber video langsung';
         status.append(detail,link);
       }
       console.warn('JSVidey media playback error:', {
         code:errorCode,
         message:mediaError?.message || '',
         networkState:player.networkState,
         readyState:player.readyState,
         currentSrc:player.currentSrc
       });
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
   let record = Array.isArray(data) ? data[0] : data;
   // The secure embed RPC intentionally hides VIP/Premium media URLs from users
   // without access. A missing row therefore does not mean the video is missing:
   // resolve safe published metadata from the catalogue and show the membership gate.
   let catalogRows=[];
   if(!record || record.status!=='published' || !(record.thumbnail_url||record.thumbnail||record.thumbnailUrl||record.thumbnail_url_public)){
     try {
       const catalog=await watchWithTimeout(db.rpc('jsvidey_catalog_videos'),7000,'');
       catalogRows=Array.isArray(catalog?.data)?catalog.data:[];
       const match=catalogRows.find(row=>
         (videoSlug && String(row.slug||'')===String(videoSlug)) ||
         (videoId && String(row.id||'')===String(videoId)) ||
         (record?.id && String(row.id||'')===String(record.id)) ||
         (record?.slug && String(row.slug||'')===String(record.slug))
       );
       if(match && match.status==='published') record={...match,...(record||{}),status:record?.status||match.status,thumbnail_url:record?.thumbnail_url||record?.thumbnail||match.thumbnail_url||match.thumbnail||match.thumbnailUrl||match.thumbnail_url_public};
     } catch(_) { /* Catalogue fallback is optional if the secure lookup succeeded. */ }
   }
   if(!record || record.status!=='published'){
     fail('Video tidak ditemukan atau belum dipublikasikan. Pastikan slug benar dan video berstatus Published di panel admin.'); return;
   }
   // Always verify member access before exposing the player. Some public lookup
   // functions can return metadata even for VIP/Premium records.
   let accessInfo=null;
   try {
     const access=await watchWithTimeout(db.rpc('jsvidey_video_access_status',{p_video_id:record.id||videoId||null,p_slug:record.slug||videoSlug||null}),8000,'Pemeriksaan akses video terlalu lama.');
     if(!access.error){accessInfo=Array.isArray(access.data)?access.data[0]:access.data;}
   } catch(accessError) { console.warn('Video access check unavailable:',accessError); }
   const rawAudience=String(accessInfo?.audience||record.audience||record.access_level||record.visibility||record.tier||'public').trim().toLowerCase();
   const rawCategory=String(accessInfo?.category||record.category||'').trim().toLowerCase();
   const isPremium=rawAudience.includes('premium')||rawCategory.includes('premium');
   const isVip=!isPremium&&(rawAudience==='vip'||rawAudience.includes('vip')||rawCategory.startsWith('server'));
   const isLoginRequired=!isVip&&!isPremium&&(
     ['members','member','login','login_required','registered','account','basic','basic_login'].includes(rawAudience) ||
     rawAudience.includes('login') || rawAudience.includes('member') || rawAudience.includes('account')
   );
   const membershipVideo=isVip||isPremium||isLoginRequired;
   const accessRequired=(Boolean(accessInfo && accessInfo.allowed===false) && membershipVideo) || (!record.video_url && membershipVideo);
   if(accessRequired){
     const tierLabel=isPremium?'Video Premium':(isVip?'Video VIP':(isLoginRequired?'Video Memerlukan Akun Login':'Video Memerlukan Akun Login'));
     const message=tierLabel;
     let signedIn=false;
     try { const auth=await watchWithTimeout(db.auth.getSession(),5000,''); signedIn=Boolean(auth?.data?.session?.user); } catch (_) {}
     const next=location.pathname+location.search;
     const loginUrl='/login.html?next='+encodeURIComponent(next);
     const registerUrl='/register.html?next='+encodeURIComponent(next);
     const upgradeUrl=isPremium?'/vip.html?plan=premium':'/vip.html?plan=vip';
     const actions=signedIn
       ? '<a class="watch-access-cta" href="'+upgradeUrl+'"><i class="fa-solid fa-crown"></i> Upgrade '+(isPremium?'Premium':(isVip?'VIP':'Akun'))+'</a>'
       : '<a class="watch-access-cta" href="'+loginUrl+'"><i class="fa-solid fa-right-to-bracket"></i> Login</a><a class="watch-access-secondary" href="'+registerUrl+'"><i class="fa-solid fa-user-plus"></i> Daftar</a>';
     const accessBox=$('watchAccessNotice');
     if(accessBox){
       const rawThumb=normalizeThumbnailUrl(record.thumbnail_url||record.thumbnail||record.thumbnailUrl||record.thumbnail_url_public||'');
       const accessDescription=isPremium
         ? 'Silahkan Login Dan Jadi Member Premium Untuk melihat Semua Video Premium Yang lebih menarik dan lebih luas Dan Bisa Akses Semua Video.'
         : (isVip
           ? 'Silahkan Login Dan Jadi Member VIP Untuk melihat Semua Video VIP Yang lebih menarik Lain nya.'
           : 'Silahkan Login Dan Untuk menonton Video tersebut.');
       accessBox.innerHTML=(rawThumb?'<img class="watch-access-thumbnail" alt="Thumbnail video" src="'+rawThumb.replace(/&/g,'&amp;').replace(/"/g,'&quot;')+'">':'')+
         '<div class="watch-access-icon"><i class="fa-solid '+(isPremium?'fa-gem':(isVip?'fa-crown':'fa-lock'))+'"></i></div><strong>'+message+'</strong><p>'+accessDescription+'</p><div class="watch-access-actions">'+actions+'</div>';
       accessBox.hidden=false;
       const img=accessBox.querySelector('img'); if(img)img.onerror=()=>img.remove();
     }
     const titleEl=$('videoTitle'); if(titleEl)titleEl.textContent=record.title||'Video Jsvidey';
     const status=$('statusText'); if(status)status.textContent='';
     if(state){state.hidden=true;state.classList.remove('error','watch-access-state');}
     if(entryNotice)entryNotice.hidden=true;
     const stage=$('player')?.parentElement;
     if(stage){stage.classList.add('access-locked');if(frame){frame.hidden=true;iframe.removeAttribute('src');}if(player){player.pause();player.removeAttribute('src');player.hidden=true;}}
     return;
   }
   const accessBox=$('watchAccessNotice'); if(accessBox){accessBox.hidden=true;accessBox.replaceChildren();}
   const playerStage=$('player')?.parentElement;if(playerStage)playerStage.classList.remove('access-locked');
   if(!record.video_url){fail('Tautan video belum tersedia.');return;}
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
