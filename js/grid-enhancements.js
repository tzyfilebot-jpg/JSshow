/* JSSHOW: 12 videos/page, in-grid Adsterra/promo placements every four videos. */
(()=>{
 const URL='https://ordvxiydkxbtahjpseph.supabase.co',KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yZHZ4aXlka3hidGFoanBzZXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2MDM3MjMsImV4cCI6MjEwODE3OTcyM30.PCruI7EeLyagV_PMyCd57s3N9oYcL41k-fEgwE8G60E';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const page=()=>{let p=document.body?.dataset?.page||location.pathname.split('/').pop().replace('.html','');if(p==='')p='index';const c=new URLSearchParams(location.search).get('category');return p==='categories'&&c?'category:'+c:p};
 function runCode(target,raw){if(!target||!raw)return;const doc=new DOMParser().parseFromString(String(raw),'text/html');for(const n of [...doc.body.childNodes]){if(n.nodeType===3&&!n.textContent.trim())continue;if(n.nodeName==='SCRIPT'){const s=document.createElement('script');[...n.attributes].forEach(a=>s.setAttribute(a.name,a.value));s.text=n.textContent||'';target.appendChild(s)}else if(n.nodeName==='IFRAME'){const src=n.getAttribute('src');if(src&&/^https:\/\//i.test(src)){const f=document.createElement('iframe');f.src=src;f.width=n.getAttribute('width')||'100%';f.height=n.getAttribute('height')||'250';f.loading='lazy';f.title='Advertisement';f.referrerPolicy='strict-origin-when-cross-origin';target.appendChild(f)}}else if(['DIV','A','IMG','INS','SPAN','P','STYLE'].includes(n.nodeName))target.appendChild(document.importNode(n,true))}}
 function style(){if(document.getElementById('jsv-grid-enhance-css'))return;const s=document.createElement('style');s.id='jsv-grid-enhance-css';s.textContent='.jsv-grid-ad{grid-column:1/-1;min-width:0;width:100%;box-sizing:border-box;margin:8px 0;padding:10px;border:1px solid var(--line,#263247);border-radius:14px;background:var(--surface,#101827);text-align:center;overflow:hidden}.jsv-grid-ad-label{font:10px/1.5 system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#98a5b9;margin-bottom:6px}.jsv-grid-ad-code{display:flex;justify-content:center;max-width:100%;overflow:hidden}.jsv-grid-promo{display:block;grid-column:1/-1;border-radius:14px;overflow:hidden;border:1px solid var(--line,#263247);background:var(--surface,#101827);text-decoration:none;color:inherit;margin:8px 0}.jsv-grid-promo img{display:block;width:100%;max-height:190px;object-fit:cover}.jsv-grid-promo span{display:block;padding:8px 12px;font-size:13px}.jsv-pagination{grid-column:1/-1;display:flex;justify-content:center;align-items:center;gap:7px;flex-wrap:wrap;padding:20px 0}.jsv-page-btn{border:1px solid var(--line,#334155);background:var(--surface,#101827);color:inherit;border-radius:10px;min-width:38px;height:38px;padding:0 11px;font:600 13px system-ui;cursor:pointer}.jsv-page-btn[aria-current=page]{background:#6558f5;color:#fff;border-color:#6558f5}.jsv-page-btn:disabled{opacity:.4;cursor:not-allowed}';document.head.appendChild(s)}
 async function config(){try{if(!window.supabase?.createClient)return {};const db=window.jsvideySupabaseClient||window.supabase.createClient(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,storageKey:'sb-ordvxiydkxbtahjpseph-auth-token'}});const r=await db.rpc('jsvidey_public_platform_status');const c=r?.data||{};const controls=c.page_controls||{};const p=page();const match=Object.keys(controls).find(k=>k.toLowerCase()===p.toLowerCase());return {global:c,rule:controls[match]||(p.startsWith('category:')?controls.categories:null)||null}}catch(_){return {}}}
 function initGrid(grid,cfg){if(!grid||grid.dataset.jsvEnhanced==='1')return;const collect=()=>[...grid.children].filter(el=>el.matches('.video-card,[data-video-card]'));let tries=0;const timer=setInterval(()=>{tries++;const cards=collect();if(!cards.length&&tries<35)return;clearInterval(timer);if(!cards.length)return;grid.dataset.jsvEnhanced='1';style();const all=cards.slice();let current=1;const pageSize=12;const rule=cfg.rule||{};const global=cfg.global||{};const adsOn=rule.ads_enabled===true&&!!rule.ad_code;const promoOn=rule.promo_enabled===true&&!!(rule.promo_image_url||rule.promo_text);const adCode=adsOn?rule.ad_code:(global.ads_enabled&&global.ad_guest_enabled!==false?global.ad_top_code:'');const promoImg=(rule.promo_enabled?rule.promo_image_url:global.promo_image_url)||'';const promoUrl=(rule.promo_enabled?rule.promo_url:global.promo_url)||'';const promoText=(rule.promo_enabled?rule.promo_text:global.promo_text)||'';const usePromo=promoOn||(!rule.promo_enabled&&global.promo_enabled&&promoImg);
 const makeAd=()=>{if(!adCode)return null;const box=document.createElement('div');box.className='jsv-grid-ad';box.innerHTML='<div class="jsv-grid-ad-label">Advertisement</div><div class="jsv-grid-ad-code"></div>';runCode(box.querySelector('.jsv-grid-ad-code'),adCode);return box};
 const makePromo=()=>{if(!usePromo||!promoImg)return null;let u;try{u=new URL(promoImg);if(u.protocol!=='https:')return null}catch(_){return null}let link='';try{const x=new URL(promoUrl);if(x.protocol==='https:')link=x.href}catch(_){}const a=document.createElement(link?'a':'div');a.className='jsv-grid-promo';if(link){a.href=link;a.target='_blank';a.rel='noopener noreferrer'}const im=document.createElement('img');im.src=u.href;im.alt='Promosi';im.loading='lazy';a.appendChild(im);if(promoText){const span=document.createElement('span');span.textContent=promoText;a.appendChild(span)}return a};
 const pager=document.createElement('nav');
 pager.className='jsv-pagination';
 pager.setAttribute('aria-label','Navigasi halaman video');
 function render(){
  grid.replaceChildren();
  const total=Math.max(1,Math.ceil(all.length/pageSize));
  current=Math.min(current,total);
  const shown=all.slice((current-1)*pageSize,current*pageSize);
  shown.forEach((card,i)=>{
   grid.appendChild(card);
   if([6,8].includes(i+1) && i<shown.length-1){
    const placement=(i+1)===6?makeAd():makePromo();
    const fallback=(i+1)===6?makePromo():makeAd();
    if(placement) grid.appendChild(placement); else if(fallback) grid.appendChild(fallback);
   }
  });
  pager.replaceChildren();
  if(total>1){
   const prev=document.createElement('button');
   prev.className='jsv-page-btn'; prev.textContent='‹'; prev.disabled=current===1;
   prev.setAttribute('aria-label','Halaman sebelumnya');
   prev.onclick=()=>{current--;render();grid.scrollIntoView({behavior:'smooth',block:'start'});};
   pager.appendChild(prev);
   for(let n=1;n<=total;n++){
    if(total>7 && n>2 && n<total-1 && Math.abs(n-current)>1){
     if(n===3 || n===total-2){const dots=document.createElement('span');dots.textContent='…';dots.style.padding='0 4px';pager.appendChild(dots);}
     continue;
    }
    const b=document.createElement('button'); b.className='jsv-page-btn'; b.textContent=String(n);
    b.setAttribute('aria-current',n===current?'page':'false');
    b.onclick=()=>{current=n;render();grid.scrollIntoView({behavior:'smooth',block:'start'});};
    pager.appendChild(b);
   }
   const next=document.createElement('button');
   next.className='jsv-page-btn'; next.textContent='›'; next.disabled=current===total;
   next.setAttribute('aria-label','Halaman berikutnya');
   next.onclick=()=>{current++;render();grid.scrollIntoView({behavior:'smooth',block:'start'});};
   pager.appendChild(next);
   pager.setAttribute('aria-label',`Halaman ${current} dari ${total}`);
  }
  if(total>1) grid.appendChild(pager);
 }
 render();},180)}
 async function start(){const cfg=await config();const grids=[...document.querySelectorAll('#videoGrid,#dashboardVideoGrid,#favoriteGrid,#favoritesGrid,#myDownloadsGrid,#downloadsGrid,.video-grid')];grids.forEach(g=>initGrid(g,cfg));const mo=new MutationObserver(()=>{for(const g of document.querySelectorAll('#videoGrid,#dashboardVideoGrid,#favoriteGrid,#favoritesGrid,#myDownloadsGrid,#downloadsGrid,.video-grid'))if(g.dataset.jsvEnhanced!=='1')initGrid(g,cfg)});mo.observe(document.body,{childList:true,subtree:true});}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
