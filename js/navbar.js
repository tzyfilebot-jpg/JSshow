(()=>{
 const mount=document.getElementById('navbarMount'); if(!mount)return;
 const page=document.body.dataset.page||'';
 // Public pages stay accessible without an account. Only account-specific pages require auth.
 const protectedPages=new Set(['dashboard','settings','my-favorites','download']);
 const URL='https://ordvxiydkxbtahjpseph.supabase.co',KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yZHZ4aXlka3hidGFoanBzZXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2MDM3MjMsImV4cCI6MjEwODE3OTcyM30.PCruI7EeLyagV_PMyCd57s3N9oYcL41k-fEgwE8G60E';
 const client=()=>{if(!window.supabase?.createClient)return null;if(window.jsvideySupabaseClient)return window.jsvideySupabaseClient;window.jsvideySupabaseClient=window.supabase.createClient(URL,KEY,{auth:{storageKey:'sb-ordvxiydkxbtahjpseph-auth-token',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});return window.jsvideySupabaseClient};
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const categories=[['Top 10 videos','Top 10 videos'],['Viral Tiktok','Viral Tiktok'],['Viral','Viral'],['Local Indo','Local Indo'],['Brazzers','Brazzers'],['Jav','Jav'],['Tante','Tante'],['Brutal','Brutal']];
 let sideOpen=false,profileOpen=false;
 mount.innerHTML=`<header class="site-navbar"><div class="nav-inner">
 <button class="nav-menu-toggle" id="navMenuToggle" aria-label="Buka menu" hidden><i class="fa-solid fa-bars"></i></button>
 <a class="brand" href="index.html"><span>Jsvidey</span></a>
 <form class="nav-search" action="search.html" hidden><i class="fa-solid fa-magnifying-glass"></i><input name="q" placeholder="Cari video…" aria-label="Cari video"><button aria-label="Cari"><i class="fa-solid fa-arrow-right"></i></button></form>
 <div class="nav-actions" id="navActions"><a class="nav-login" href="/login.html">Masuk</a><a class="nav-register" href="/register.html">Daftar</a></div>
 <div class="profile-wrap" id="profileWrap" hidden><button class="profile-toggle" id="profileToggle" aria-label="Buka profil"><i class="fa-solid fa-user"></i><i class="fa-solid fa-chevron-down"></i></button><div class="profile-dropdown" id="profileDropdown" hidden><button id="languageToggle"><i class="fa-solid fa-language"></i> Bahasa: Indonesia</button><a href="settings.html"><i class="fa-solid fa-gear"></i> Pengaturan</a><button id="navLogout"><i class="fa-solid fa-right-from-bracket"></i> Keluar</button></div></div>
 </div></header>
 <div class="menu-scrim" id="menuScrim" hidden></div><aside class="side-drawer" id="sideDrawer" aria-label="Menu navigasi" aria-hidden="true"><div class="drawer-head"><b>Jsvidey</b><button id="drawerClose" aria-label="Tutup menu"><i class="fa-solid fa-xmark"></i></button></div><a class="drawer-link" href="index.html"><i class="fa-solid fa-house"></i> Beranda</a><div id="drawerGuestLinks"><a class="drawer-link" href="/login.html"><i class="fa-solid fa-right-to-bracket"></i> Masuk</a><a class="drawer-link" href="/register.html"><i class="fa-solid fa-user-plus"></i> Daftar</a></div><div id="drawerMemberLinks" hidden><a class="drawer-link" href="dashboard.html"><i class="fa-solid fa-gauge-high"></i> Dashboard</a><a class="drawer-link" href="my-favorites.html"><i class="fa-solid fa-heart"></i> My Favorit</a><a class="drawer-link" href="top-10-videos.html"><i class="fa-solid fa-chart-line"></i> Top 10 Video</a><div class="drawer-label">KATEGORI</div><div id="drawerCategories">${categories.map(([label,val])=>`<a class="drawer-link" href="${val==='Top 10 videos'?'top-10-videos.html':'categories.html?category='+encodeURIComponent(val)}"><i class="fa-solid fa-play"></i> ${esc(label)}</a>`).join('')}</div><div class="drawer-divider"></div><div class="drawer-label">SERVER</div><div id="drawerServers">${['Server1','Server2','Server3'].map(v=>`<a class="drawer-link" href="categories.html?category=${encodeURIComponent(v)}"><i class="fa-solid fa-server"></i> ${v}</a>`).join('')}</div></div></aside>`;
 const toggleDrawer=open=>{sideOpen=open;const d=document.getElementById('sideDrawer'),scrim=document.getElementById('menuScrim');d.classList.toggle('open',open);d.setAttribute('aria-hidden',String(!open));scrim.hidden=!open;document.body.classList.toggle('drawer-open',open)};
 document.getElementById('navMenuToggle').onclick=()=>toggleDrawer(!sideOpen);document.getElementById('drawerClose').onclick=()=>toggleDrawer(false);document.getElementById('menuScrim').onclick=()=>toggleDrawer(false);
 document.getElementById('profileToggle').onclick=()=>{profileOpen=!profileOpen;document.getElementById('profileDropdown').hidden=!profileOpen};
 document.getElementById('languageToggle').onclick=()=>{const next=(localStorage.getItem('jsvidey-language')||'id')==='id'?'en':'id';localStorage.setItem('jsvidey-language',next);document.getElementById('languageToggle').innerHTML=`<i class="fa-solid fa-language"></i> Bahasa: ${next==='id'?'Indonesia':'English'}`;document.dispatchEvent(new CustomEvent('jsvidey:language-change',{detail:{lang:next}}))};
 document.getElementById('navLogout').onclick=async()=>{try{await client()?.auth.signOut()}catch(e){console.warn(e)}try{localStorage.removeItem('jsvidey-session')}catch(e){}location.href='index.html'};
 let db=client();
 async function init(){
  let user=null;try{const {data}=await db.auth.getUser();user=data?.user||null}catch(e){}
  const actions=document.getElementById('navActions'),profile=document.getElementById('profileWrap');
  if(!user && protectedPages.has(document.body.dataset.page)){location.replace('/login.html?next='+encodeURIComponent(location.pathname.split('/').pop()+location.search));return}
  // Jangan alihkan otomatis dari login/register hanya karena sesi terdeteksi.
  // Ini mencegah loop saat cache sesi browser dan sesi Supabase belum sinkron.
  
  const menuToggle=document.getElementById('navMenuToggle');
  const searchForm=mount.querySelector('.nav-search');
  const guestLinks=document.getElementById('drawerGuestLinks');
  const memberLinks=document.getElementById('drawerMemberLinks');
  if(user){
    actions.innerHTML='<a class="nav-home" href="index.html"><i class="fa-solid fa-house"></i> Beranda</a><a class="nav-home" href="dashboard.html"><i class="fa-solid fa-gauge-high"></i> Dashboard</a>'; 
    profile.hidden=false; menuToggle.hidden=false; searchForm.hidden=false;
    guestLinks.hidden=true; memberLinks.hidden=false;
    document.querySelectorAll('.join-banner').forEach(el=>el.hidden=true);
    document.querySelectorAll('body[data-page="home"] .category-strip').forEach(el=>el.hidden=false);
  } else {
    profile.hidden=true; menuToggle.hidden=true; searchForm.hidden=true;
    actions.innerHTML='<a class="nav-login" href="/login.html">Masuk</a><a class="nav-register" href="/register.html">Daftar</a>';
    guestLinks.hidden=false; memberLinks.hidden=true;
    document.querySelectorAll('.join-banner').forEach(el=>el.hidden=false);
    document.querySelectorAll('body[data-page="home"] .category-strip').forEach(el=>el.hidden=true);
  }
  const search=new URLSearchParams(location.search).get('q');const inp=mount.querySelector('.nav-search input');if(search&&inp)inp.value=search;
  if(user) try{const {data,error}=await db.from('jsvidey_nav_menu').select('id,label,slug,menu_type,sort_order').eq('is_active',true).order('sort_order');if(!error&&Array.isArray(data)){const cats=data.filter(x=>x.menu_type!=='server'),servers=data.filter(x=>x.menu_type==='server');const render=(items,type)=>items.map(x=>`<a class="drawer-link" href="categories.html?category=${encodeURIComponent(x.slug||x.label)}"><i class="fa-solid ${type==='server'?'fa-server':'fa-play'}"></i> ${esc(x.label)}</a>`).join('');document.getElementById('drawerCategories').innerHTML=render(cats,'category');document.getElementById('drawerServers').innerHTML=render(servers,'server')}}
  catch(e){}
 }
 if(db)init();else {const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';s.onload=()=>{const c=client();if(c){db=c;window.jsvideyNavClient=c;init()}};document.head.appendChild(s)}
})();