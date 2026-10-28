const SUPABASE_URL='https://ordvxiydkxbtahjpseph.supabase.co';
const SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yZHZ4aXlka3hidGFoanBzZXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2MDM3MjMsImV4cCI6MjEwODE3OTcyM30.PCruI7EeLyagV_PMyCd57s3N9oYcL41k-fEgwE8G60E';
(async()=>{
 const grid=document.getElementById('videoGrid'); if(!grid)return;
 const msg=document.getElementById('catalogMessage');
 const params=new URLSearchParams(location.search),rawTerm=(params.get('q')||'').trim(),term=rawTerm.toLowerCase(),page=document.body.dataset.page||'',category=(params.get('category')||'').trim();
 let isVip=false,isPremium=false,isLoggedIn=false;
 const tags=['Trending','Komedi','Musik','Gaming','Olahraga','Hiburan','Edukasi','Teknologi','Lifestyle','18+'];
 const normalizeThumbnail=raw=>{
   const value=String(raw||'').trim();if(!value)return '';
   try{const u=new URL(value);if(!/^https?:$/.test(u.protocol))return '';
     const host=u.hostname.toLowerCase();
     if(host==='drive.google.com'||host==='docs.google.com'||host==='drive.usercontent.google.com'){
       const id=(u.pathname.match(/\/file\/d\/([^/]+)/)||[])[1]||u.searchParams.get('id');
       if(id)return 'https://drive.google.com/thumbnail?id='+encodeURIComponent(id)+'&sz=w1200';
     }
     return value;
   }catch(_){return ''}
 };
 const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function tier(v){
   const a=String(v.audience||v.access_level||v.membership||'').toLowerCase();
   if(a==='premium'||a==='pro'||/^premium\b/.test(a)||/^server\s*premium/i.test(String(v.category||'')))return 'premium';
   if(a==='vip'||/^vip\b/.test(a)||/^server\s*vip/i.test(String(v.category||'')))return 'vip';
   if(a==='members'||a==='basic')return 'basic';
   return 'public';
 }
 function card(v,i){
   const title=escapeHTML(v.title||'Video tanpa judul'), id=encodeURIComponent(v.id), link=v.slug?('v/'+encodeURIComponent(v.slug)):('watch.html?id='+id);
   const cat=v.category||tags[i%tags.length], hue=[345,18,270,195,32,145][i%6];
   const date=v.created_at?new Date(v.created_at):null;
   const when=date&&!isNaN(date)?new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'short',year:'numeric'}).format(date):'Video pilihan';
   const thumbUrl=normalizeThumbnail(v.thumbnail_url||v.thumbnail||v.thumbnailUrl);
   const thumb=thumbUrl?`<img src="${escapeHTML(thumbUrl)}" alt="Thumbnail ${title}" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='https://placehold.co/640x360/111827/e5e7eb?text=JSSHOW+VIDEO'">`:`<img src="https://placehold.co/640x360/111827/e5e7eb?text=JSSHOW+VIDEO" alt="Thumbnail belum tersedia" loading="lazy">`;
   const t=tier(v),premiumOnly=t==='premium',vipOnly=t==='vip',locked=(vipOnly&&!isVip)||(premiumOnly&&!isPremium)||(t==='basic'&&!isLoggedIn);
   const destination=locked?(premiumOnly?'vip.html?plan=premium':'vip.html?plan=vip'):link;
   const tierLabel=premiumOnly?'PREMIUM':vipOnly?'VIP':t==='basic'?'MEMBER':'BASIC';
   const counts=v._social||{like_count:0,comment_count:0,share_count:0};
   return `<a class="video-card ${t==='vip'||premiumOnly?'vip-video-card ':''}${page==='top-10-videos'?'ranked-video-card':''}" data-tier="${t}" ${page==='top-10-videos'?`data-rank="${i+1}"`:''} href="${destination}" aria-label="${locked?'Upgrade '+tierLabel+': ':'Tonton '}${title}"><div class="video-thumb" style="background:linear-gradient(135deg,hsl(${hue} 48% 22%),#24222f 65%,hsl(${(hue+45)%360} 40% 18%));position:relative">${thumb}<span class="video-badge">${escapeHTML(cat)}</span><span class="thumb-play"><i class="fa-solid ${locked?'fa-lock':'fa-play'}"></i></span><span class="video-duration">${tierLabel}</span></div><div class="video-details"><div class="video-title">${title}</div><div class="video-meta"><span><i class="fa-regular fa-clock"></i> ${when}</span><span>${locked?'Upgrade '+tierLabel:'Putar'}</span><span class="video-view-count" title="Total tayangan"><i class="fa-regular fa-eye"></i> ${Number(v._viewCount??v.view_count??0).toLocaleString('id-ID')} View</span></div><div class="video-social-counts" aria-label="Statistik video"><span title="Like"><i class="fa-regular fa-thumbs-up"></i> ${Number(counts.like_count||0)} Like</span><span title="Komentar"><i class="fa-regular fa-comment"></i> ${Number(counts.comment_count||0)} Komentar</span><span title="Bagikan"><i class="fa-solid fa-share-nodes"></i> ${Number(counts.share_count||0)} Share</span></div></div></a>`;
 }
 try{
   if(!window.supabase?.createClient)throw new Error('Library katalog belum dimuat.');
   const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);try{const {data:{user}}=await db.auth.getUser();if(user){isLoggedIn=true;const p=await db.from('profiles').select('plan,plan_expires_at').eq('id',user.id).maybeSingle();const plan=String(p.data?.plan||'basic').toLowerCase();const active=!p.data?.plan_expires_at||new Date(p.data.plan_expires_at)>new Date();isVip=active&&['vip','premium','pro'].includes(plan);isPremium=active&&['premium','pro'].includes(plan)}}catch(_){}
   let videos=[];
   if(page==='top-10-videos'){
     const top=await db.rpc('jsvidey_top_videos',{p_limit:10});
     if(top.error)throw top.error;
     videos=(top.data||[]).map(v=>({...v,_viewCount:Number(v.view_count)||0}));
   }else{
     const result=await db.rpc('jsvidey_catalog_videos');
     if(result.error)throw result.error;
     videos=result.data||[];
   }
   // Load total views for every video card; aggregate only, never expose viewer identities.
   try{
     const ids=videos.map(v=>v.id).filter(Boolean);
     if(ids.length){
       const views=await db.rpc('jsvidey_get_video_view_counts',{p_video_ids:ids});
       if(!views.error){
         const map=new Map((views.data||[]).map(v=>[String(v.video_id),Number(v.view_count)||0]));
         videos=videos.map(v=>({...v,_viewCount:map.has(String(v.id))?map.get(String(v.id)):Number(v._viewCount??v.view_count)||0}));
       } else {
         videos=videos.map(v=>({...v,_viewCount:Number(v._viewCount??v.view_count)||0}));
       }
     }
   }catch(_){videos=videos.map(v=>({...v,_viewCount:Number(v._viewCount??v.view_count)||0}));}
   // Load aggregate counts without exposing user identities. Cards still render if counts RPC is not installed yet.
   try{
     const ids=videos.map(v=>v.id).filter(Boolean);
     if(ids.length){
       const counts=await db.rpc('jsvidey_get_video_social_counts', {p_video_ids:ids});
       if(!counts.error){
         const map=new Map((counts.data||[]).map(c=>[String(c.video_id),c]));
         videos=videos.map(v=>({...v,_social:map.get(String(v.id))||{like_count:0,comment_count:0,share_count:0}}));
       }
     }
   }catch(_){}
   if(page==='search' && !term){
     grid.innerHTML='<div class="empty-card search-empty-card"><i class="fa-solid fa-magnifying-glass"></i><h3>Mulai pencarian</h3><p>Ketik judul video atau nama kategori pada kolom pencarian di atas.</p></div>';
     if(msg)msg.textContent='Masukkan kata kunci untuk melihat hasil pencarian.';
     const heading=document.getElementById('categoryHeading');if(heading)heading.textContent='Cari video';
     const summary=document.getElementById('searchSummary');if(summary)summary.textContent='Hasil akan ditampilkan setelah kamu mencari.';
     const input=document.getElementById('catalogSearchInput');if(input)input.value=rawTerm;
     return;
   }
   // Keep locked VIP/Premium cards visible so users can see the tier and upgrade path.
   if(term)videos=videos.filter(v=>(v.title||'').toLowerCase().includes(term)||(v.category||'').toLowerCase().includes(term));
   if(page==='categories'||page==='home'){
     const categoryNames=[...new Set((videos||[]).map(v=>String(v.category||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'id'));
     const nav=document.querySelector('.category-filter-list')||document.querySelector('.category-strip');
     if(nav){
       const allLink='<a class="category-chip active" href="categories.html"><i class="fa-solid fa-layer-group"></i> Semua kategori</a>'+(page==='home'?'<a class="category-chip" href="top-10-videos.html"><i class="fa-solid fa-chart-line"></i> Top 10</a>':'');
       const icons={'trending':'fa-fire','komedi':'fa-face-laugh','musik':'fa-music','gaming':'fa-gamepad','olahraga':'fa-futbol','hiburan':'fa-clapperboard','edukasi':'fa-graduation-cap','teknologi':'fa-microchip','18+':'fa-shield-halved'};
       nav.innerHTML=allLink+categoryNames.map(name=>{const icon=icons[name.toLowerCase()]||'fa-tag';return `<a class="category-chip" href="categories.html?category=${encodeURIComponent(name)}"><i class="fa-solid ${icon}"></i> ${escapeHTML(name)}</a>`}).join('');
       nav.querySelectorAll('.category-chip').forEach(a=>{const u=new URL(a.href,location.origin);a.classList.toggle('active',(u.searchParams.get('category')||'').toLowerCase()===category.toLowerCase());});
     }
   }
   if(category && !['Semua','Semuanya','Terbaru','Populer'].includes(category) && page==='categories')videos=videos.filter(v=>(v.category||'').toLowerCase()===category.toLowerCase() || (category==='Trending' && String(v.tags||'').toLowerCase().includes('trending')));
   if(category==='Terbaru')videos.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
   if(page!=='top-10-videos' && category!=='Terbaru'){videos.sort((a,b)=>{const rank=v=>{const t=tier(v);return t==='vip'||t==='premium'?0:t==='basic'?1:2};return rank(a)-rank(b)||new Date(b.created_at)-new Date(a.created_at)})}
   if(page==='top-10-videos')videos=videos.slice(0,10);
   grid.innerHTML=videos.length?videos.map(card).join(''):`<div class="empty-card"><i class="fa-regular fa-circle-play"></i><h3>Belum ada video yang cocok</h3><p>Coba kata kunci atau kategori lain.</p></div>`;
   if(msg)msg.textContent=page==='top-10-videos'?`${videos.length} dari maksimal 10 video teratas berdasarkan jumlah tayangan di database.`:page==='search'?`${videos.length} hasil untuk “${rawTerm}”.`:category?`Kategori: ${category} · ${videos.length} video`:`${videos.length} video tersedia`;
   const heading=document.getElementById('categoryHeading');
   if(heading){if(page==='search')heading.textContent=`Hasil untuk “${rawTerm}”`;else if(page==='categories')heading.textContent=category||'Semua video';}
   const summary=document.getElementById('searchSummary');if(summary&&page==='search')summary.textContent=`Menampilkan video yang cocok dengan kata kunci “${rawTerm}”.`;
   const catSummary=document.getElementById('categorySummary');if(catSummary&&page==='categories')catSummary.textContent=category?`Video dalam kategori ${category}.`:'Semua video yang tersedia di katalog.';
   if(page==='search'){const input=document.getElementById('catalogSearchInput');if(input)input.value=rawTerm;}
   if(page==='categories'){document.querySelectorAll('.category-filter-list .category-chip').forEach(a=>{const url=new URL(a.href,location.origin);const value=url.searchParams.get('category')||'';a.classList.toggle('active',value.toLowerCase()===category.toLowerCase());});}
 }catch(e){
   grid.innerHTML='<div class="empty-card"><i class="fa-solid fa-circle-exclamation"></i><h3>Katalog belum dapat dimuat</h3><p>Periksa koneksi Supabase, status video, dan kebijakan akses publik.</p></div>';
   if(msg)msg.textContent='Detail: '+(e.message||'Gagal memuat video');
 }
})();
