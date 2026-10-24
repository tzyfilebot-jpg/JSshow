/* JSSHOW Adsterra layout: user-provided placements, responsive side rails and inline slots. */
(()=>{
 'use strict';
 const AD={
  auto:`<script data-cfasync="false" src="https://ahuramazda.org/1/ac71832b0a31a9127f2edee0b96828bb"></script>`,
  banner468:`<script>atOptions={'key':'528c236a5ad834091be42f12f7b37020','format':'iframe','height':60,'width':468,'params':{}};</script><script src="https://brijmohan.org/22/528c236a5ad834091be42f12f7b37020"></script>`,
  rect300:`<script>atOptions={'key':'8121f37c9d72c5a783b49a164290ed39','format':'iframe','height':250,'width':300,'params':{}};</script><script src="https://brijmohan.org/22/8121f37c9d72c5a783b49a164290ed39"></script>`,
  mobile320:`<script>atOptions={'key':'395e8278d34b195fc638caf9be3c095a','format':'iframe','height':50,'width':320,'params':{}};</script><script src="https://brijmohan.org/22/395e8278d34b195fc638caf9be3c095a"></script>`,
  banner728:`<script>atOptions={'key':'3141a4f24ed6a3e4353abd22e9d1ee2d','format':'iframe','height':90,'width':728,'params':{}};</script><script src="https://brijmohan.org/22/3141a4f24ed6a3e4353abd22e9d1ee2d"></script>`,
  side160x300:`<script>atOptions={'key':'876fd0d10f22e22c48c8143e11d59f62','format':'iframe','height':300,'width':160,'params':{}};</script><script src="https://brijmohan.org/22/876fd0d10f22e22c48c8143e11d59f62"></script>`,
  side160x600:`<script>atOptions={'key':'3e098c5e726febcf4069731a84e69010','format':'iframe','height':600,'width':160,'params':{}};</script><script src="https://brijmohan.org/22/3e098c5e726febcf4069731a84e69010"></script>`,
  container:`<script async="async" data-cfasync="false" src="https://brijmohan.org/21/9d5f79baa8e59d6c69ccbbb496662e1b"></script><div id="container-9d5f79baa8e59d6c69ccbbb496662e1b"></div>`,
  inline:`<script data-cfasync="false" src="https://brijmohan.org/14/57202f289afd48d4d1ed5e246ce84208"></script>`
 };
 const DIRECT='https://asiaso.org/4/ccdc2f004ac67e05a3202365083f8a96';
 const $=(s,r=document)=>r.querySelector(s);
 function inject(target,raw){
  if(!target||!raw||target.dataset.adLoaded==='1')return;target.dataset.adLoaded='1';
  // Keep each display placement in its own document so Adsterra's global atOptions
  // cannot be overwritten by another placement on the same page.
  const mW=String(raw).match(/[\'\"]width[\'\"]\s*:\s*(\d+)/i),mH=String(raw).match(/[\'\"]height[\'\"]\s*:\s*(\d+)/i);
  const width=Number(mW?.[1])||300,height=Number(mH?.[1])||250;
  const frame=document.createElement('iframe');frame.title='Advertisement';frame.loading='lazy';frame.width=String(width);frame.height=String(height);frame.style.cssText='display:block;border:0;max-width:100%;margin:0 auto;';frame.setAttribute('sandbox','allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox');
  frame.srcdoc='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;padding:0;width:100%;min-height:0;overflow:hidden}body{display:flex;justify-content:center;align-items:flex-start}iframe{max-width:100%}</style></head><body>'+String(raw)+'</body></html>';
  target.appendChild(frame);
 }
 function injectAuto(){if(document.getElementById('jsv-ad-auto-script'))return;const s=document.createElement('script');s.id='jsv-ad-auto-script';s.setAttribute('data-cfasync','false');s.src='https://ahuramazda.org/1/ac71832b0a31a9127f2edee0b96828bb';document.body.appendChild(s)}
 function styles(){if($('#jsv-ad-layout-style'))return;const s=document.createElement('style');s.id='jsv-ad-layout-style';s.textContent=`
 .jsv-ad-layout-slot{box-sizing:border-box;min-width:0;max-width:100%;margin:12px auto;text-align:center;overflow:hidden;position:relative;z-index:2}
 .jsv-ad-layout-slot .jsv-ad-caption{font:10px/1.4 system-ui,sans-serif;color:#8c95a8;letter-spacing:.1em;text-transform:uppercase;margin:0 0 5px}
 .jsv-ad-layout-code{display:flex;align-items:center;justify-content:center;max-width:100%;min-width:0;overflow:hidden}
 .jsv-ad-layout-code iframe{max-width:100%;border:0}
 #jsv-ad-top{width:100%;min-height:0;padding:8px 0}
 #jsv-ad-left,#jsv-ad-right{position:fixed;top:50%;transform:translateY(-50%);width:160px;min-height:100px;margin:0;z-index:40;background:transparent;overflow:hidden;text-align:center}
 #jsv-ad-left{left:4px}#jsv-ad-right{right:4px}
 #jsv-ad-left .jsv-ad-layout-code,#jsv-ad-right .jsv-ad-layout-code{width:160px;min-height:100px}
 .jsv-inline-ad{grid-column:1/-1;width:100%;padding:8px 0;margin:12px 0;border:0;border-radius:0;background:transparent}
 .jsv-inline-ad .jsv-ad-layout-code{width:100%}
 .jsv-direct-promo{grid-column:1/-1;display:flex;align-items:center;justify-content:center;gap:10px;min-height:46px;margin:10px 0;padding:10px 14px;border:1px solid var(--line,#334155);border-radius:10px;text-decoration:none;color:inherit;background:var(--surface,#101827);font:600 13px system-ui,sans-serif}
 .jsv-direct-promo span{opacity:.72;font-weight:400}
 @media(min-width:761px){body{padding-left:168px!important;padding-right:168px!important;box-sizing:border-box}}
 @media(min-width:1500px){#jsv-ad-left{left:max(4px,calc((100vw - 1500px)/2))}#jsv-ad-right{right:max(4px,calc((100vw - 1500px)/2))}}
 @media(max-width:760px){#jsv-ad-left{display:none}#jsv-ad-right{top:46%;right:0;transform:translateY(-50%);width:160px;max-height:300px}#jsv-ad-right .jsv-ad-rail-label{display:none}#jsv-ad-right .jsv-ad-layout-code{width:160px;max-height:300px}#jsv-ad-right .jsv-ad-layout-code iframe{max-height:300px}body{padding-right:160px!important;box-sizing:border-box}#navbarMount,body>main,body>#footerMount{max-width:100%;min-width:0}#jsv-ad-top .jsv-ad-320{display:flex}#jsv-ad-top .jsv-ad-layout-code{max-width:100%}.jsv-ad-layout-slot{max-width:100%}}
 @media(max-width:380px){body{padding-right:150px!important}#jsv-ad-right{width:150px}#jsv-ad-right .jsv-ad-layout-code{width:150px}}
 `;document.head.appendChild(s)}
 function slot(id,cls,label,raw){let el=document.getElementById(id);if(!el){el=document.createElement('aside');el.id=id;el.className='jsv-ad-layout-slot '+(cls||'');el.setAttribute('aria-label','Advertisement');if(label){const cap=document.createElement('div');cap.className='jsv-ad-caption '+(id==='jsv-ad-left'||id==='jsv-ad-right'?'jsv-ad-rail-label':'');cap.textContent=label;el.appendChild(cap)}const code=document.createElement('div');code.className='jsv-ad-layout-code';el.appendChild(code);(id==='jsv-ad-top'?document.querySelector('main')?.parentNode?.insertBefore(el,document.querySelector('main'))||document.body.prepend(el):document.body.appendChild(el));inject(code,raw)}return el}
 function setupRails(){slot('jsv-ad-left','jsv-ad-rail','Advertisement',AD.side160x600);slot('jsv-ad-right','jsv-ad-rail','Advertisement',AD.side160x300)}
 function setupTop(){let top=$('#jsv-ad-top');if(!top){top=document.createElement('aside');top.id='jsv-ad-top';top.className='jsv-ad-layout-slot';top.setAttribute('aria-label','Advertisement');const cap=document.createElement('div');cap.className='jsv-ad-caption';cap.textContent='Advertisement';top.appendChild(cap);const spec=window.innerWidth>760?['jsv-ad-728',AD.banner728]:window.innerWidth>480?['jsv-ad-468',AD.banner468]:['jsv-ad-320',AD.mobile320];const code=document.createElement('div');code.className='jsv-ad-layout-code '+spec[0];top.appendChild(code);inject(code,spec[1]);const main=$('main');if(main?.parentNode)main.parentNode.insertBefore(top,main);else document.body.prepend(top)}}
 function makeInline(id,label,raw){const el=document.createElement('div');el.id=id;el.className='jsv-ad-layout-slot jsv-inline-ad';const cap=document.createElement('div');cap.className='jsv-ad-caption';cap.textContent=label;el.appendChild(cap);const code=document.createElement('div');code.className='jsv-ad-layout-code';el.appendChild(code);inject(code,raw);return el}
 function addDirectPromo(grid,afterCard){if(grid.querySelector('#jsv-direct-promo'))return;const a=document.createElement('a');a.id='jsv-direct-promo';a.className='jsv-direct-promo';a.href=DIRECT;a.target='_blank';a.rel='sponsored noopener noreferrer';a.innerHTML='<strong>Promosi</strong><span>Konten promosi · buka di tab baru</span>';afterCard.insertAdjacentElement('afterend',a)}
 const gridsSelector='#videoGrid,#dashboardVideoGrid,#favoriteGrid,#favoritesGrid,#myDownloadsGrid,#downloadsGrid,.video-grid,.fav-grid,.dl-grid';
 function placeGridAds(grid){if(!grid||!grid.isConnected)return;const cards=[...grid.children].filter(el=>el.matches('.video-card,[data-video-card],.fav-card,.dl-card'));if(!cards.length)return;
  const plans=[{n:4,id:'jsv-ad-inline-container',label:'Advertisement',raw:AD.container},{n:8,id:'jsv-ad-inline-300',label:'Advertisement',raw:AD.rect300},{n:12,id:'jsv-ad-inline-14',label:'Advertisement',raw:AD.inline}];
  plans.forEach(p=>{const target=cards[p.n-1];if(!target)return;let existing=document.getElementById(p.id);if(existing&&existing.parentElement!==grid){existing.remove();existing=null}if(!existing){existing=makeInline(p.id,p.label,p.raw);target.insertAdjacentElement('afterend',existing)}});
  const promoTarget=cards[Math.min(9,cards.length)-1];if(promoTarget)addDirectPromo(grid,promoTarget);
  
 }
 function run(){styles();setupTop();setupRails();const runAuto=()=>injectAuto();runAuto();
  const process=()=>document.querySelectorAll(gridsSelector).forEach(placeGridAds);process();
  const player=$('.player-card');if(player&&!$('#jsv-watch-inline-300')){const a=makeInline('jsv-watch-inline-300','Advertisement',AD.rect300);player.insertAdjacentElement('afterend',a)}
  const vip=$('.vip-page');if(vip&&!$('#jsv-vip-inline-300')){const a=makeInline('jsv-vip-inline-300','Advertisement',AD.rect300);vip.appendChild(a)}
  const observer=new MutationObserver(()=>{process();if(!document.getElementById('jsv-ad-auto-script'))runAuto()});observer.observe(document.body,{childList:true,subtree:true});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
})();
