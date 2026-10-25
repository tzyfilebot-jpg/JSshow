(() => {
  'use strict';
  const URL='https://ordvxiydkxbtahjpseph.supabase.co';
  const KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yZHZ4aXlka3hidGFoanBzZXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2MDM3MjMsImV4cCI6MjEwODE3OTcyM30.PCruI7EeLyagV_PMyCd57s3N9oYcL41k-fEgwE8G60E';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const $=id=>document.getElementById(id);
  const init=async()=>{
    if(!window.supabase?.createClient)return;
    let db=window.jsvideySupabaseClient;
    if(!db) db=window.jsvideySupabaseClient=window.supabase.createClient(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,storageKey:'sb-ordvxiydkxbtahjpseph-auth-token'}});
    let user=null;try{user=(await db.auth.getUser()).data?.user||null}catch(_){}
    if(!user||document.getElementById('jsvSupportWidget'))return;
    const wrap=document.createElement('aside');wrap.id='jsvSupportWidget';wrap.className='jsv-support-widget';
    wrap.innerHTML=`<button class="jsv-support-fab" id="jsvSupportToggle" type="button" aria-expanded="false"><span class="jsv-support-fab-logo"><i class="fa-solid fa-headset"></i><i class="fa-solid fa-circle"></i></span><span class="jsv-support-fab-copy"><b>Butuh bantuan?</b><small>Chat dengan tim support</small></span><i class="fa-solid fa-chevron-up jsv-support-fab-chevron"></i></button>
      <section class="jsv-support-menu" id="jsvSupportMenu" hidden><header class="jsv-support-brand"><span class="jsv-support-brand-logo"><i class="fa-solid fa-headset"></i></span><span class="jsv-support-brand-copy"><strong>Tele / Support Center</strong><small><i class="fa-solid fa-circle"></i> Tim bantuan siap membantu</small></span><button id="jsvSupportClose" type="button" aria-label="Tutup"><i class="fa-solid fa-xmark"></i></button></header><p class="jsv-support-intro">Pilih layanan yang kamu butuhkan. Tim kami siap membantu.</p>
      <nav class="jsv-support-links">
        <button id="jsvSupportOpenChat" class="jsv-support-link jsv-support-link-primary" type="button"><span class="jsv-support-link-icon"><i class="fa-solid fa-comments"></i></span><span class="jsv-support-link-copy"><strong>Chat Admin</strong><small>Kirim pertanyaan langsung ke tim support</small></span><i class="fa-solid fa-chevron-right jsv-support-link-arrow"></i></button>
        <a class="jsv-support-link" href="https://t.me/+DqdGHeiPZA9mYTQx" target="_blank" rel="noopener noreferrer"><span class="jsv-support-link-icon telegram"><i class="fa-brands fa-telegram"></i></span><span class="jsv-support-link-copy"><strong>Grup Komunitas</strong><small>Diskusi dan bantuan bersama member</small></span><i class="fa-solid fa-arrow-up-right-from-square jsv-support-link-arrow"></i></a>
        <a class="jsv-support-link" href="https://t.me/+JUGpWnRLT8ljNGZk" target="_blank" rel="noopener noreferrer"><span class="jsv-support-link-icon channel"><i class="fa-solid fa-bullhorn"></i></span><span class="jsv-support-link-copy"><strong>Channel Oxcie</strong><small>Info terbaru dan pengumuman</small></span><i class="fa-solid fa-arrow-up-right-from-square jsv-support-link-arrow"></i></a>
      </nav>
      <div class="jsv-support-chat" id="jsvSupportChat" hidden><div class="jsv-support-messages" id="jsvSupportMessages" aria-live="polite"><p class="muted">Memuat percakapan…</p></div>
      <form id="jsvSupportForm"><textarea id="jsvSupportText" maxlength="1500" rows="2" placeholder="Tulis pesan untuk admin…"></textarea><label class="jsv-support-attach"> <i class="fa-regular fa-image"></i> Kirim gambar <input id="jsvSupportImage" type="file" accept="image/png,image/jpeg,image/webp,image/gif"></label><button type="submit" id="jsvSupportSend">Kirim</button><small id="jsvSupportStatus" role="status"></small></form></div></section>`;
    document.body.appendChild(wrap);
    const menu=$('jsvSupportMenu'),chat=$('jsvSupportChat'),messages=$('jsvSupportMessages'),status=$('jsvSupportStatus');
    $('jsvSupportToggle').onclick=()=>{menu.hidden=!menu.hidden;$('jsvSupportToggle').setAttribute('aria-expanded',String(!menu.hidden));wrap.classList.toggle('is-open',!menu.hidden);};
    $('jsvSupportClose').onclick=()=>{menu.hidden=true;$('jsvSupportToggle').setAttribute('aria-expanded','false');wrap.classList.remove('is-open')};
    $('jsvSupportOpenChat').onclick=()=>{chat.hidden=!chat.hidden;if(!chat.hidden)loadMessages()};
    async function loadMessages(){
      const {data,error}=await db.from('jsvidey_support_messages').select('id,user_id,message,status,created_at,sender_role,attachment_url,attachment_name').eq('user_id',user.id).order('created_at',{ascending:true}).limit(200);
      if(error){messages.innerHTML='<p class="muted">Chat belum siap. Admin perlu menjalankan migrasi SQL support.</p>';status.textContent=error.message;return}
      messages.innerHTML=(data||[]).length?(data||[]).map(m=>`<article class="jsv-chat-bubble ${m.sender_role==='admin'?'admin':'member'}"><small>${m.sender_role==='admin'?'Admin':'Anda'} · ${esc(new Date(m.created_at).toLocaleString())}</small>${m.message?`<p>${esc(m.message)}</p>`:''}${m.attachment_url?`<a href="${esc(m.attachment_url)}" target="_blank" rel="noopener"><img src="${esc(m.attachment_url)}" alt="${esc(m.attachment_name||'Lampiran gambar')}" loading="lazy"></a>`:''}</article>`).join(''):'<p class="muted">Belum ada pesan. Kirim pertanyaan untuk memulai chat.</p>';
      messages.scrollTop=messages.scrollHeight;
    }
    $('jsvSupportForm').onsubmit=async e=>{
      e.preventDefault();const btn=$('jsvSupportSend'),text=$('jsvSupportText').value.trim(),file=$('jsvSupportImage').files?.[0];
      if(!text&&!file){status.textContent='Tulis pesan atau pilih gambar.';return}
      if(file&&(!/^image\/(jpeg|png|webp|gif)$/.test(file.type)||file.size>5*1024*1024)){status.textContent='Gambar harus JPG/PNG/WEBP/GIF maksimal 5 MB.';return}
      btn.disabled=true;status.textContent='Mengirim…';
      try{
        let attachment_url=null,attachment_name=null;
        if(file){const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';const path=`${user.id}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
          const {error:upErr}=await db.storage.from('jsvidey-support-attachments').upload(path,file,{upsert:false,contentType:file.type});if(upErr)throw upErr;
          attachment_url=db.storage.from('jsvidey-support-attachments').getPublicUrl(path).data.publicUrl;attachment_name=file.name;
        }
        const {error}=await db.from('jsvidey_support_messages').insert({user_id:user.id,message:text||(file?'Gambar terlampir':''),sender_role:'member',attachment_url,attachment_name,status:'open'});
        if(error)throw error;$('jsvSupportText').value='';$('jsvSupportImage').value='';status.textContent='Pesan terkirim.';await loadMessages();
      }catch(err){status.textContent='Gagal mengirim: '+(err.message||'Periksa migrasi SQL dan Storage.')}
      finally{btn.disabled=false}
    };
    loadMessages();setInterval(()=>{if(!menu.hidden&&!chat.hidden)loadMessages()},8000);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>init().catch(()=>{}),{once:true});else init().catch(()=>{});
})();