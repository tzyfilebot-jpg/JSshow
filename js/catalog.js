const SUPABASE_URL='https://ordvxiydkxbtahjpseph.supabase.co';
const SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yZHZ4aXlka3hidGFoanBzZXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2MDM3MjMsImV4cCI6MjEwODE3OTcyM30.PCruI7EeLyagV_PMyCd57s3N9oYcL41k-fEgwE8G60E';
(async()=>{
 const grid=document.getElementById('videoGrid'); if(!grid)return;
 const msg=document.getElementById('catalogMessage');
 const params=new URLSearchParams(location.search),rawTerm=(params.get('q')||'').trim(),term=rawTerm.toLowerCase(),page=document.body.dataset.page||'',category=(params.get('category')||'').trim();
 let isVip=false,isPremium=false,isLoggedIn=false;
 const tags=['Trending','Komedi','Musik','Gaming','Olahraga','Hiburan','Edukasi','Teknologi','Lifestyle','18+'];
 const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function card(v,i){
   const title=escapeHTML(v.title||'Video tanpa judul'), id=encodeURIComponent(v.id), link=v.slug?('v/'+encodeURIComponent(v.slug)):('watch.html?id='+id);
   const cat=v.category||tags[i%tags.length], hue=[345,18,270,195,32,145][i%6];
   const date=v.created_at?new Date(v.created_at):null;
   const when=date&&!isNaN(date)?new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'short',year:'numeric'}).format(date):'Video pilihan';
   const thumb=v.thumbnail_url?`<img src="${escapeHTML(v.thumbnail_url)}" alt="Thumbnail ${title}" loading="lazy" onerror="this.style.display='none'">`:"";const vip=v.audience==='vip'||v.audience==='premium'||/^server/i.test(v.category||'');const premiumOnly=v.audience==='premium';const locked=vip&&(!isVip||(premiumOnly&&!isPremium));return `<a class="video-card ${vip?'vip-video-card ':''}${page==='top-10-videos'?'ranked-video-card':''}" data-tier="${vip?'vip':'basic'}" ${page==='top-10-videos'?`data-rank="${i+1}"`:''} href="${link}" aria-label="${vip&&!isVip?'Akses VIP: ':'Tonton '}${title}"><div class="video-thumb" style="background:linear-gradient(135deg,hsl(${hue} 48% 22%),#24222f 65%,hsl(${(hue+45)%360} 40% 18%));position:relative">${thumb}<span class="video-badge">${escapeHTML(cat)}</span><span class="thumb-play"><i class="fa-solid ${locked?'fa-lock':'fa-play'}"></i></span><span class="video-duration">${locked?(premiumOnly?'PREMIUM':'VIP'):'VIDEO'}</span></div><div class="video-details"><div class="video-title">${title}</div><div class="video-meta"><span><i class="fa-regular fa-clock"></i>${when}</span><span>${locked?(premiumOnly?'PREMIUM':'VIP'):'Putar'}</span>${document.body.dataset.page==='top-10-videos'?`<span>${Number(v._viewCount||0)} tayangan</span>`:''}</div></div></a>`;
 }
 try{
   if(!window.supabase?.createClient)throw new Error('Library katalog belum dimuat.');
   const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);try{const {data:{user}}=await db.auth.getUser();if(user){isLoggedIn=true;const p=await db.from('profiles').select('plan,plan_expires_at').eq('id',user.id).maybeSingle();const plan=String(p.data?.plan||'basic').toLowerCase();const active=!p.data?.plan_expires_at||new Date(p.data.plan_expires_at)>new Date();isVip=active&&['vip','premium','pro'].includes(plan);isPremium=['premium','pro'].includes(plan)}}catch(_){}
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
   if(page==='search' && !term){
     grid.innerHTML='<div class="empty-card search-empty-card"><i class="fa-solid fa-magnifying-glass"></i><h3>Mulai pencarian</h3><p>Ketik judul video atau nama kategori pada kolom pencarian di atas.</p></div>';
     if(msg)msg.textContent='Masukkan kata kunci untuk melihat hasil pencarian.';
     const heading=document.getElementById('categoryHeading');if(heading)heading.textContent='Cari video';
     const summary=document.getElementById('searchSummary');if(summary)summary.textContent='Hasil akan ditampilkan setelah kamu mencari.';
     const input=document.getElementById('catalogSearchInput');if(input)input.value=rawTerm;
     return;
   }
   // Apply membership visibility before rendering or building category chips.
   // Public/free content is visible to everyone; VIP can view VIP content; Premium can view both VIP and Premium content.
   const tier=v=>{const a=String(v.audience||v.access_level||v.membership||'').toLowerCase();if(a==='premium'||a==='pro'||/^premium\b/.test(a))return 'premium';if(a==='vip'||/^vip\b/.test(a)||/^server\s*vip/i.test(String(v.category||'')))return 'vip';if(/^server\s*premium/i.test(String(v.category||'')))return 'premium';if(a==='members'||a==='basic')return 'basic';return 'public'};
   videos=videos.filter(v=>{const t=tier(v);return t==='public'||(t==='basic'&&isLoggedIn)||(t==='vip'&&isVip)||(t==='premium'&&isPremium)});
   if(term)videos=videos.filter(v=>(v.title||'').toLowerCase().includes(term)||(v.category||'').toLowerCase().includes(term));
   if(category && (params.get('type')==='server'||/^server/i.test(category)) && !isVip){
     grid.innerHTML='<div class="empty-card"><i class="fa-solid fa-lock"></i><h3>Halaman terkunci</h3><p>Upgrade Akun Terlebih Dahulu</p><strong>JSSHOW MEMBERSHIP</strong><p>Buka akses VIP<br> Nikmati akses ke server VIP dan koleksi khusus.</p><a class="btn btn-light" href="vip.html">Lanjut Upgrade VIP</a></div>';
     if(msg)msg.textContent='Server ini hanya tersedia untuk akun VIP atau Premium.';return;
   }
   if(page==='categories'){
     const categoryNames=[...new Set((videos||[]).map(v=>String(v.category||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'id'));
     const nav=document.querySelector('.category-filter-list');
     if(nav){
       const allLink='<a class="category-chip" href="categories.html"><i class="fa-solid fa-layer-group"></i> Semua kategori</a>';
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
