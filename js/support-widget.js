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
    wrap.innerHTML=`<button class="jsv-support-fab" id="jsvSupportToggle" type="button" aria-expanded="false"><i class="fa-regular fa-comments"></i><span>Chat</span></button>
      <section class="jsv-support-menu" id="jsvSupportMenu" hidden><header><strong>Hubungi kami</strong><button id="jsvSupportClose" type="button" aria-label="Tutup">×</button></header>
      <nav class="jsv-support-links"><button id="jsvSupportOpenChat" type="button"><i class="fa-solid fa-headset"></i> Support</button><a href="https://t.me/+DqdGHeiPZA9mYTQx" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-telegram"></i><span>Gabung Group</span></a><a href="https://t.me/+JUGpWnRLT8ljNGZk" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-telegram"></i><span>Join Channel Oxcie</span></a></nav>
      <div class="jsv-support-chat" id="jsvSupportChat" hidden><div class="jsv-support-messages" id="jsvSupportMessages" aria-live="polite"><p class="muted">Memuat percakapan…</p></div>
      <form id="jsvSupportForm"><textarea id="jsvSupportText" maxlength="1500" rows="2" placeholder="Tulis pesan untuk admin…"></textarea><label class="jsv-support-attach"> <i class="fa-regular fa-image"></i> Kirim gambar <input id="jsvSupportImage" type="file" accept="image/png,image/jpeg,image/webp,image/gif"></label><button type="submit" id="jsvSupportSend">Kirim</button><small id="jsvSupportStatus" role="status"></small></form></div></section>`;
    document.body.appendChild(wrap);
    const menu=$('jsvSupportMenu'),chat=$('jsvSupportChat'),messages=$('jsvSupportMessages'),status=$('jsvSupportStatus');
    $('jsvSupportToggle').onclick=()=>{menu.hidden=!menu.hidden;$('jsvSupportToggle').setAttribute('aria-expanded',String(!menu.hidden));};
    $('jsvSupportClose').onclick=()=>{menu.hidden=true;$('jsvSupportToggle').setAttribute('aria-expanded','false')};
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