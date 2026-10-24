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
   const {data:catalog,error:videoError}=await db.rpc('jsvidey_catalog_videos');
   if(videoError)throw videoError;
   const byId=new Map((catalog||[]).map(v=>[String(v.id),v]));
   const ordered=ids.map(id=>byId.get(String(id))).filter(Boolean);
   if(!ordered.length){grid.innerHTML='<div class="fav-empty">Video favorit tidak tersedia lagi.</div>';msg.textContent='Tidak ada video yang bisa ditampilkan';return}
   const profile=await db.from('profiles').select('plan,plan_expires_at').eq('id',user.id).maybeSingle();
   const plan=String(profile.data?.plan||'basic').toLowerCase(),active=!profile.data?.plan_expires_at||new Date(profile.data.plan_expires_at)>new Date();
   const isVip=active&&['vip','premium','pro'].includes(plan),isPremium=active&&['premium','pro'].includes(plan);
   const counts=await db.rpc('jsvidey_get_video_social_counts',{p_video_ids:ordered.map(v=>v.id)});
   const countMap=new Map((counts.data||[]).map(c=>[String(c.video_id),c]));
   grid.innerHTML=ordered.map(v=>{const tier=String(v.audience||'public').toLowerCase(),premium=tier==='premium'||/^server premium/i.test(v.category||''),vip=tier==='vip'||(/^server/i.test(v.category||'')&&!premium),locked=(premium&&!isPremium)||(vip&&!isVip),target=locked?(premium?'vip.html?plan=premium':'vip.html?plan=vip'):(v.slug?'v/'+encodeURIComponent(v.slug):'watch.html?id='+encodeURIComponent(v.id)),c=countMap.get(String(v.id))||{};return `<article class="fav-card" data-video-id="${esc(v.id)}"><a href="${target}"><div class="fav-thumb"><i class="fa-solid ${locked?'fa-lock':'fa-circle-play'}"></i></div><div class="fav-copy"><h2>${esc(v.title||'Video tanpa judul')}</h2><span class="fav-tier">${premium?'PREMIUM':vip?'VIP':'BASIC'}${locked?' · Upgrade':''}</span><div class="video-social-counts"><span><i class="fa-regular fa-thumbs-up"></i> ${Number(c.like_count||0)}</span><span><i class="fa-regular fa-comment"></i> ${Number(c.comment_count||0)}</span><span><i class="fa-solid fa-share-nodes"></i> ${Number(c.share_count||0)}</span></div></div></a><div class="fav-copy fav-card-actions"><a href="${target}">${locked?'Upgrade':'Tonton'} <i class="fa-solid fa-arrow-right"></i></a><button class="fav-remove" type="button" data-remove="${esc(v.id)}">Hapus</button></div></article>`}).join('');
   msg.textContent=`${ordered.length} video favorit`;
   grid.querySelectorAll('[data-remove]').forEach(btn=>btn.addEventListener('click',async()=>{btn.disabled=true;const id=btn.dataset.remove;const {error}=await db.from('video_favorites').delete().eq('user_id',user.id).eq('video_id',id);if(error){msg.textContent='Gagal menghapus favorit. Coba lagi.';btn.disabled=false;return}btn.closest('.fav-card')?.remove();const remaining=grid.querySelectorAll('.fav-card').length;msg.textContent=`${remaining} video favorit`;if(!remaining)load()}));
 }
 try{await load()}catch(e){console.error(e);msg.textContent='Favorit belum dapat dimuat. Pastikan SQL sql/jsvidey-social-database.sql sudah dijalankan di Supabase.';grid.innerHTML=''}
})();
