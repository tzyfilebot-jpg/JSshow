const SUPABASE_URL='https://ordvxiydkxbtahjpseph.supabase.co';
const SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yZHZ4aXlka3hidGFoanBzZXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2MDM3MjMsImV4cCI6MjEwODE3OTcyM30.PCruI7EeLyagV_PMyCd57s3N9oYcL41k-fEgwE8G60E';
(async()=>{
 const $=id=>document.getElementById(id);
 const params=new URLSearchParams(location.search);
 let videoId=params.get('id'),videoSlug=params.get('slug');
 if(!videoSlug&&!videoId){const parts=location.pathname.split('/').filter(Boolean);if(parts.length===1&&!parts[0].includes('.'))videoSlug=decodeURIComponent(parts[0]);}
 const notice=msg=>{const el=$('socialNotice');if(el)el.textContent=msg};
 if((!videoId&&!videoSlug)||!window.supabase?.createClient){notice('Link video atau koneksi database tidak tersedia.');return}
 const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
 try{
   if(!videoSlug && videoId){const {data,error}=await db.from('videos').select('id,slug').eq('id',videoId).eq('status','published').maybeSingle();if(error)throw error;if(data){videoId=data.id;videoSlug=data.slug||data.id;}}
   else if(videoSlug){const {data,error}=await db.from('videos').select('id,slug').eq('slug',videoSlug).eq('status','published').maybeSingle();if(error)throw error;if(!data)throw new Error('Video tidak ditemukan');videoId=data.id;videoSlug=data.slug||videoSlug;}
 }catch(e){console.error('Video link lookup failed',e);notice('Link pendek belum tersedia. Jalankan sql/jsvidey_short_links.sql di Supabase.');return}
 window.__jsvideyVideoId=videoId;window.__jsvideyVideoSlug=videoSlug;window.__jsvideyShareUrl=location.origin+'/'+encodeURIComponent(videoSlug||videoId);
 const downloadPageButton=$('downloadPageButton');if(downloadPageButton)downloadPageButton.href='download.html?id='+encodeURIComponent(videoId);
 let visitorId;
 try{visitorId=localStorage.getItem('jsvidey-visitor-id');if(!visitorId){visitorId=crypto.randomUUID();localStorage.setItem('jsvidey-visitor-id',visitorId)}}catch(_){visitorId=crypto.randomUUID()}
 let liked=false,likeCount=0,favorited=false,currentUser=null;
 const renderLikes=()=>{$('likeCount').textContent=String(likeCount);$('likeVideoButton').classList.toggle('liked',liked)};
 async function loadLikes(){
   const [countRes,mineRes]=await Promise.all([
    db.from('video_likes').select('id',{count:'exact',head:true}).eq('video_id',videoId),
    db.from('video_likes').select('id').eq('video_id',videoId).eq('visitor_id',visitorId).maybeSingle()
   ]);
   if(countRes.error||mineRes.error)throw countRes.error||mineRes.error;
   likeCount=countRes.count||0;liked=!!mineRes.data;renderLikes();
 }
 async function loadComments(){
   const {data,error}=await db.from('video_comments').select('id,display_name,body,created_at').eq('video_id',videoId).order('created_at',{ascending:false}).limit(100);
   if(error)throw error;
   $('commentCount').textContent=String(data.length);
   const list=$('commentList');list.replaceChildren();
   if(!data.length){list.innerHTML='<p class="empty-comments"><i class="fa-regular fa-comment-dots"></i> Belum ada komentar. Jadilah yang pertama!</p>';return}
   for(const c of data){const article=document.createElement('article');article.className='comment-item';const meta=document.createElement('div');meta.className='comment-meta';meta.textContent=(c.display_name||'Pengunjung')+' • '+new Date(c.created_at).toLocaleString('id-ID');const p=document.createElement('p');p.textContent=c.body;article.append(meta,p);list.append(article)}
 }
 const favoriteButton=$('favoriteVideoButton');
 async function loadFavorite(){
   const {data:{user},error:authError}=await db.auth.getUser();
   if(authError)throw authError;
   currentUser=user||null;
   if(!currentUser){favorited=false;renderFavorite();return}
   const {data,error}=await db.from('video_favorites').select('video_id').eq('user_id',currentUser.id).eq('video_id',videoId).maybeSingle();
   if(error)throw error;
   favorited=!!data;renderFavorite();
 }
 function renderFavorite(){
   if(!favoriteButton)return;
   favoriteButton.classList.toggle('favorited',favorited);
   favoriteButton.setAttribute('aria-pressed',String(favorited));
   favoriteButton.innerHTML=favorited?'<i class="fa-solid fa-bookmark"></i><span>Favorit</span>':'<i class="fa-regular fa-bookmark"></i><span>Favorit</span>';
 }
 favoriteButton?.addEventListener('click',async()=>{
   favoriteButton.disabled=true;
   try{
     const {data:{user},error:authError}=await db.auth.getUser();
     if(authError)throw authError;
     if(!user){location.href='login.html?next='+encodeURIComponent('watch.html?id='+videoId);return}
     if(favorited){
       const {error}=await db.from('video_favorites').delete().eq('user_id',user.id).eq('video_id',videoId);
       if(error)throw error;
       favorited=false;notice('Video dihapus dari My Favorit.');
     }else{
       const {error}=await db.from('video_favorites').insert({user_id:user.id,video_id:videoId});
       if(error&&error.code!=='23505')throw error;
       favorited=true;notice('Video ditambahkan ke My Favorit.');
     }
     renderFavorite();
   }catch(e){notice('Favorit gagal disimpan. Jalankan sql/jsvidey-social-database.sql versi terbaru di Supabase.');console.error(e)}
   finally{favoriteButton.disabled=false}
 });
 $('likeVideoButton').addEventListener('click',async()=>{
  $('likeVideoButton').disabled=true;
  try{
   if(liked){const {error}=await db.from('video_likes').delete().eq('video_id',videoId).eq('visitor_id',visitorId);if(error)throw error;liked=false;likeCount=Math.max(0,likeCount-1)}
   else{const {error}=await db.from('video_likes').insert({video_id:videoId,visitor_id:visitorId});if(error&&error.code!=='23505')throw error;if(!error)likeCount++;liked=true}
   renderLikes();notice(liked?'Video disukai.':'Like dibatalkan.');
  }catch(e){notice('Like gagal disimpan. Jalankan SQL database sosial di Supabase.');console.error(e)}finally{$('likeVideoButton').disabled=false}
 });
 $('commentJumpButton').addEventListener('click',()=>{$('commentsSection').scrollIntoView({behavior:'smooth'});$('commentInput').focus()});
 $('shareVideoButton').addEventListener('click',async()=>{try{const shareUrl=window.__jsvideyShareUrl||location.href;if(navigator.share)await navigator.share({title:document.title,url:shareUrl});else{await navigator.clipboard.writeText(shareUrl);notice('Link video berhasil disalin: '+shareUrl)}}catch(e){if(e.name!=='AbortError')try{await navigator.clipboard.writeText(window.__jsvideyShareUrl||location.href);notice('Link video berhasil disalin.')}catch(_){notice('Tidak dapat membagikan link. Salin alamat ini: '+(window.__jsvideyShareUrl||location.href))}}});
 $('commentForm').addEventListener('submit',async e=>{e.preventDefault();const body=$('commentInput').value.trim(),display_name=$('commentName').value.trim()||(currentUser?.email||'Member').split('@')[0];if(!body)return;const btn=e.submitter; if(btn)btn.disabled=true;try{const {data:{user},error:authError}=await db.auth.getUser();if(authError)throw authError;if(!user){location.href='login.html?next='+encodeURIComponent('watch.html?id='+videoId);return}const {error}=await db.from('video_comments').insert({video_id:videoId,visitor_id:user.id,display_name,body});if(error)throw error;$('commentInput').value='';notice('Komentar tersimpan di database.');await loadComments()}catch(err){notice('Komentar gagal disimpan. Pastikan SQL database sosial sudah dijalankan.');console.error(err)}finally{if(btn)btn.disabled=false}});
 Promise.all([loadLikes(),loadComments(),loadFavorite()]).catch(e=>{notice('Database interaksi belum aktif. Jalankan sql/jsvidey-social-database.sql di Supabase.');console.error(e)});
})();
