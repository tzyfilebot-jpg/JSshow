const SUPABASE_URL='https://ordvxiydkxbtahjpseph.supabase.co';
const SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yZHZ4aXlka3hidGFoanBzZXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2MDM3MjMsImV4cCI6MjEwODE3OTcyM30.PCruI7EeLyagV_PMyCd57s3N9oYcL41k-fEgwE8G60E';
(async()=>{
 const $=id=>document.getElementById(id);
 let videoId=new URLSearchParams(location.search).get('id');
 const params=new URLSearchParams(location.search);
 let videoSlug=params.get('slug');
 if(!videoSlug && !videoId){const parts=location.pathname.split('/').filter(Boolean);if(parts.length===1 && !parts[0].includes('.')){try{videoSlug=decodeURIComponent(parts[0]);}catch(_){videoSlug=parts[0];}}}
 const state=$('state'),player=$('player'),frame=$('embedFrame'),iframe=$('embedPlayer');
 const ratioTools=$('ratioTools');
 const ratioButtons=ratioTools?Array.from(ratioTools.querySelectorAll('[data-ratio]')):[];
 function setRatio(mode){if(frame){frame.classList.toggle('landscape',mode==='landscape');}ratioButtons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.ratio===mode)));}
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
   }else if(host==='vimeo.com'||host==='player.vimeo.com'){
     id=host==='player.vimeo.com'?(path.match(/\/video\/([0-9]+)/)||[])[1]:path.split('/').filter(Boolean)[0];
     if(!id||!/^\d+$/.test(id))throw new Error('Link Vimeo tidak dikenali.');
     provider='Vimeo';embed='https://player.vimeo.com/video/'+id;
   }
   const direct=/\.(mp4|webm|mov|m4v|ogv|ogg|m3u8)(?:$)/i.test(path);
   return {embed,provider,direct};
 }
 function showEmbed(url,title){
   const m=classify(url);
   window.__sourceVideoUrl=url;
   const titleEl=$('videoTitle');if(titleEl)titleEl.textContent=title||'Video Jsvidey';
   if(m.direct){if(ratioTools)ratioTools.hidden=true;iframe.removeAttribute('src');frame.hidden=true;player.src=m.embed;player.hidden=false;player.onloadedmetadata=()=>{if(player.videoWidth&&player.videoHeight){player.style.aspectRatio=player.videoWidth+'/'+player.videoHeight;}};}
   else{player.pause();player.removeAttribute('src');player.load();player.hidden=true;iframe.src=m.embed;frame.hidden=false;const isDrive=m.provider==='Google Drive';if(ratioTools)ratioTools.hidden=!isDrive;setRatio('landscape');}
   if(state)state.hidden=true;
   const status=$('statusText');
   if(status)status.textContent='Media: '+m.provider+'. Tombol Download tersedia di bagian bawah video jika penyedia mendukungnya.';
   const downloadPageButton=$('downloadPageButton');if(downloadPageButton)downloadPageButton.href='/download.html?id='+encodeURIComponent(videoId);
 }
 if(!videoId&&!videoSlug){fail('Link video tidak ditemukan. Buka tautan video yang valid.');return;}
 if(videoId&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(videoId)){
   // URL pendek lama dapat masuk sebagai ?id=slug; perlakukan sebagai slug.
   videoSlug=videoId;videoId=null;
 }
 try{
   // Use the authenticated Supabase client for both UUID and slug lookups. This preserves
   // the signed-in JWT for member-only videos without granting broad SELECT access to videos.
   if (!window.supabase?.createClient) throw new Error('Library Supabase gagal dimuat.');
   const db = window.jsvideySupabaseClient || window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
     auth: { persistSession: true, autoRefreshToken: true, storageKey: 'sb-ordvxiydkxbtahjpseph-auth-token' }
   });
   const rpcName = videoSlug ? 'get_public_embed_video_by_slug' : 'get_public_embed_video';
   const rpcArgs = videoSlug ? { p_slug: videoSlug } : { p_video_id: videoId };
   const { data, error } = await db.rpc(rpcName, rpcArgs);
   if (error) throw new Error(error.message || 'Lookup video gagal. Pastikan SQL lookup video sudah diterapkan.');
   const record = Array.isArray(data) ? data[0] : data;
   if(!record?.video_url||record.status!=='published'){
     const access=await db.rpc('jsvidey_video_access_status',{p_video_id:videoId||null,p_slug:videoSlug||null});
     const info=Array.isArray(access.data)?access.data[0]:access.data;
     if(info&&!info.allowed){
       const premium=String(info.audience||'').toLowerCase()==='premium';
       const message=premium?'Video Khusus Premium, Silahkan Upgrade Status Akun.':'Video Khusus VIP & Premium, Silahkan Upgrade Status Akun.';
       if(state){state.hidden=false;state.classList.add('error');state.innerHTML='<strong>'+message+'</strong><p><a class="btn btn-light" href="vip.html">Upgrade</a></p>';}
       const status=$('statusText');if(status)status.textContent=message;
     }else fail('Video tidak ditemukan, belum dipublikasikan, atau link belum tersimpan.');
     return;
   }
   videoId=record.id;
   window.__jsvideyVideoId=record.id;
   window.__jsvideyVideoSlug=record.slug||videoSlug||null;
   window.dispatchEvent(new CustomEvent('jsvidey:video-ready',{detail:{id:record.id,slug:record.slug||videoSlug||null}}));
   window.__jsvideyShareUrl=window.__jsvideyVideoSlug ? location.origin+'/v/'+encodeURIComponent(window.__jsvideyVideoSlug) : location.origin+'/watch.html?id='+encodeURIComponent(record.id);
   showEmbed(record.video_url,record.title);
   // Count a view through a database function; never allow the browser to write raw view rows.
   db.rpc('jsvidey_record_video_view',{p_video_id:record.id}).then(({error})=>{if(error)console.warn('View count not recorded:',error.message)});
 }catch(e){
   console.error('Embed lookup failed:',e);
   const detail=e?.name==='AbortError'?'Permintaan ke Supabase melewati batas waktu 12 detik.':(e?.message||String(e));
   fail('Gagal memuat link embed: '+detail+' Coba muat ulang halaman.');
 }
})();
