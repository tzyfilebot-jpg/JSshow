const SUPABASE_URL='https://ordvxiydkxbtahjpseph.supabase.co';
const SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yZHZ4aXlka3hidGFoanBzZXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2MDM3MjMsImV4cCI6MjEwODE3OTcyM30.PCruI7EeLyagV_PMyCd57s3N9oYcL41k-fEgwE8G60E';
(async()=>{
 const grid=document.getElementById('videoGrid'); if(!grid)return;
 const msg=document.getElementById('catalogMessage');
 const params=new URLSearchParams(location.search),term=(params.get('q')||'').trim().toLowerCase(),category=(document.body.dataset.page==='top-10-videos'?'Top 10 videos':(params.get('category')||'').trim());
 const tags=['Trending','Komedi','Musik','Gaming','Olahraga','Hiburan','Edukasi','Teknologi','Lifestyle','18+'];
 const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function card(v,i){
   const title=escapeHTML(v.title||'Video tanpa judul'), id=encodeURIComponent(v.id), link=v.slug?('v/'+encodeURIComponent(v.slug)):('watch.html?id='+id);
   const cat=tags[i%tags.length], hue=[345,18,270,195,32,145][i%6];
   const date=v.created_at?new Date(v.created_at):null;
   const when=date&&!isNaN(date)?new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'short',year:'numeric'}).format(date):'Video pilihan';
   return `<a class="video-card" href="${v.slug?''+link:link}" aria-label="Tonton ${title}"><div class="video-thumb" style="background:linear-gradient(135deg,hsl(${hue} 48% 22%),#24222f 65%,hsl(${(hue+45)%360} 40% 18%))"><span class="video-badge">${cat}</span><span class="thumb-play"><i class="fa-solid fa-play"></i></span><span class="video-duration">VIDEO</span></div><div class="video-details"><div class="video-title">${title}</div><div class="video-meta"><span><i class="fa-regular fa-clock"></i>${when}</span><span><i class="fa-solid fa-circle-play"></i>Putar</span></div></div></a>`;
 }
 try{
   if(!window.supabase?.createClient)throw new Error('Library katalog belum dimuat.');
   const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
   let result=await db.from('videos').select('id,slug,title,video_url,created_at,status,category,audience').eq('status','published').order('created_at',{ascending:false}).limit(60);
   if(result.error && /slug|category|column|audience/i.test(result.error.message||'')) result=await db.from('videos').select('id,slug,title,video_url,created_at,status,category').eq('status','published').order('created_at',{ascending:false}).limit(60);
   if(result.error && /slug|category|column/i.test(result.error.message||'')) result=await db.from('videos').select('id,title,video_url,created_at,status,category').eq('status','published').order('created_at',{ascending:false}).limit(60);
   if(result.error && /category|column/i.test(result.error.message||'')) result=await db.from('videos').select('id,title,video_url,created_at,status').eq('status','published').order('created_at',{ascending:false}).limit(60);
   if(result.error)throw result.error;
   let videos=result.data||[];
   if(term)videos=videos.filter(v=>(v.title||'').toLowerCase().includes(term)||(v.category||'').toLowerCase().includes(term));
   if(category && !['Semua','Terbaru','Populer'].includes(category))videos=videos.filter(v=>(v.category||'').toLowerCase()===category.toLowerCase() || (category==='Trending' && (!v.category || v.category==='Trending')));
   if(category==='Terbaru')videos.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
   if(document.body.dataset.page==='top-10-videos')videos=videos.slice(0,10);
   grid.innerHTML=videos.length?videos.map(card).join(''):`<div class="empty-card"><i class="fa-regular fa-circle-play"></i><h3>Belum ada video yang cocok</h3><p>Coba kata kunci atau kategori lain.</p></div>`;
   if(msg)msg.textContent=document.body.dataset.page==='top-10-videos'?`${videos.length} dari maksimal 10 video ditampilkan (berdasarkan kategori Top 10 videos).`:term?`Hasil pencarian untuk “${params.get('q')}”`:category?`Kategori: ${category}`:`${videos.length} video tersedia`;
 }catch(e){
   grid.innerHTML='<div class="empty-card"><i class="fa-solid fa-circle-exclamation"></i><h3>Katalog belum dapat dimuat</h3><p>Periksa koneksi Supabase, status video, dan kebijakan akses publik.</p></div>';
   if(msg)msg.textContent='Detail: '+(e.message||'Gagal memuat video');
 }
})();