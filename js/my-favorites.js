const SUPABASE_URL='https://ordvxiydkxbtahjpseph.supabase.co';
const SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yZHZ4aXlka3hidGFoanBzZXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2MDM3MjMsImV4cCI6MjEwODE3OTcyM30.PCruI7EeLyagV_PMyCd57s3N9oYcL41k-fEgwE8G60E';
(async()=>{
 const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{storageKey:'sb-ordvxiydkxbtahjpseph-auth-token',persistSession:true,autoRefreshToken:true}});
 const msg=document.getElementById('favoritesMessage'),grid=document.getElementById('favoritesGrid');
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 async function load(){
   const {data:{user},error:authError}=await db.auth.getUser();
   if(authError||!user){location.replace('login.html?next='+encodeURIComponent('my-favorites.html'));return}
   msg.textContent='Memuat favorit…';
   const {data:favorites,error}=await db.from('video_favorites').select('video_id,created_at').eq('user_id',user.id).order('created_at',{ascending:false});
   if(error)throw error;
   if(!favorites?.length){grid.innerHTML='<div class="fav-empty"><i class="fa-regular fa-bookmark"></i><h2>Belum ada video favorit</h2><p>Buka video lalu tekan tombol Favorit untuk menyimpannya di sini.</p><a href="categories.html">Jelajahi video</a></div>';msg.textContent='0 video tersimpan';return}
   const ids=favorites.map(x=>x.video_id);
   const {data:videos,error:videoError}=await db.from('videos').select('id,title,video_url,status').in('id',ids).eq('status','published');
   if(videoError)throw videoError;
   const byId=new Map((videos||[]).map(v=>[v.id,v]));
   const ordered=ids.map(id=>byId.get(id)).filter(Boolean);
   if(!ordered.length){grid.innerHTML='<div class="fav-empty">Video favorit tidak tersedia lagi.</div>';msg.textContent='Tidak ada video yang bisa ditampilkan';return}
   grid.innerHTML=ordered.map(v=>`<article class="fav-card" data-video-id="${esc(v.id)}"><a href="watch.html?id=${encodeURIComponent(v.id)}"><div class="fav-thumb"><i class="fa-solid fa-circle-play"></i></div><div class="fav-copy"><h2>${esc(v.title||'Video tanpa judul')}</h2></div></a><div class="fav-copy fav-card-actions"><a href="watch.html?id=${encodeURIComponent(v.id)}">Tonton <i class="fa-solid fa-arrow-right"></i></a><button class="fav-remove" type="button" data-remove="${esc(v.id)}">Hapus</button></div></article>`).join('');
   msg.textContent=`${ordered.length} video favorit`;
   grid.querySelectorAll('[data-remove]').forEach(btn=>btn.addEventListener('click',async()=>{btn.disabled=true;const id=btn.dataset.remove;const {error}=await db.from('video_favorites').delete().eq('user_id',user.id).eq('video_id',id);if(error){msg.textContent='Gagal menghapus favorit. Coba lagi.';btn.disabled=false;return}btn.closest('.fav-card')?.remove();const remaining=grid.querySelectorAll('.fav-card').length;msg.textContent=`${remaining} video favorit`;if(!remaining)load()}));
 }
 try{await load()}catch(e){console.error(e);msg.textContent='Favorit belum dapat dimuat. Pastikan SQL sql/jsvidey-social-database.sql sudah dijalankan di Supabase.';grid.innerHTML=''}
})();
