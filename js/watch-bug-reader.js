(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const toggle = $('watchBugToggle'), panel = $('watchBugPanel');
  const logsEl = $('watchBugLogs'), checksEl = $('watchBugChecks');
  const badge = $('watchBugBadge'), countEl = $('watchBugLogCount');
  if (!toggle || !panel || !logsEl || !checksEl) return;

  const logs = [];
  const checks = new Map();
  const maxLogs = 100;
  const safeText = value => String(value ?? '').replace(/(?:Bearer\s+)[\w.-]+/gi, 'Bearer [REDACTED]')
    .replace(/eyJ[\w.-]{20,}/g, '[TOKEN REDACTED]')
    .replace(/(access_token|refresh_token|apikey|api_key|authorization)=([^&\s]+)/gi, '$1=[REDACTED]')
    .slice(0, 900);
  const safeUrl = value => {
    try {
      const u = new URL(value, location.href);
      u.searchParams.forEach((v,k) => {
        if (/token|key|auth|secret|password/i.test(k)) u.searchParams.set(k, '[REDACTED]');
      });
      return u.origin + u.pathname + (u.search ? '?[query hidden]' : '');
    } catch (_) { return '[URL tidak tersedia]'; }
  };
  function renderChecks() {
    checksEl.replaceChildren();
    const rows = [
      ['Video', $('videoTitle')?.textContent?.trim() || 'Belum ada judul'],
      ['Player', $('embedFrame') && !$('embedFrame').hidden ? 'Embed tampil' : ($('player') && !$('player').hidden ? 'Video tampil' : ($('state')?.textContent?.trim() || 'Menunggu'))],
      ['Komentar', $('commentList')?.textContent?.trim() || 'Belum ada status'],
      ['Video lainnya', $('relatedVideoGrid')?.textContent?.trim() || 'Belum ada status'],
      ['Interaksi', $('socialNotice')?.textContent?.trim() || 'Belum ada pesan error']
    ];
    rows.forEach(([name,value]) => {
      const text = String(value).replace(/\s+/g,' ').trim().slice(0,150);
      const lower = text.toLowerCase();
      const bad = /gagal|error|tidak ditemukan|tidak valid|failed|denied|permission|timeout|memuat komentar|memuat video lainnya|memuat media|memuat video/i.test(lower);
      const ok = /berhasil|siap|loaded|dipublikasikan|komentar \(\d+\)/i.test(lower);
      const row = document.createElement('div');
      row.className = 'watch-bug-check';
      const dot = document.createElement('span'); dot.className = 'watch-bug-dot ' + (bad ? 'is-bad' : ok ? 'is-ok' : 'is-wait');
      const label = document.createElement('strong'); label.textContent = name;
      const val = document.createElement('span'); val.textContent = text || 'Menunggu…';
      row.append(dot,label,val); checksEl.append(row);
      checks.set(name, {value:text || 'Menunggu…', status:bad ? 'Perlu diperiksa' : ok ? 'Terlihat normal' : 'Belum pasti'});
    });
  }
  function renderLogs() {
    logsEl.replaceChildren();
    if (!logs.length) {
      const li = document.createElement('li'); li.className='watch-bug-empty'; li.textContent='Belum ada error yang tertangkap.';
      logsEl.append(li);
    } else {
      logs.slice().reverse().forEach(item => {
        const li = document.createElement('li'); li.className='watch-bug-log ' + (item.level === 'error' ? 'is-error' : item.level === 'warn' ? 'is-warn' : '');
        const meta = document.createElement('div'); meta.className='watch-bug-log-meta'; meta.textContent = item.time + ' · ' + item.source;
        const msg = document.createElement('pre'); msg.textContent = item.message;
        li.append(meta,msg); logsEl.append(li);
      });
    }
    badge.textContent = String(logs.filter(x => x.level === 'error').length);
    countEl.textContent = logs.length + ' catatan';
  }
  function addLog(level, source, message) {
    logs.push({time:new Date().toLocaleTimeString(),level,source:safeText(source),message:safeText(message)});
    if (logs.length > maxLogs) logs.splice(0, logs.length-maxLogs);
    renderLogs();
  }
  function updateAll(){renderChecks();}
  toggle.addEventListener('click', () => {
    const opening = panel.hidden;
    panel.hidden = !opening;
    toggle.setAttribute('aria-expanded', String(opening));
    if (opening) updateAll();
  });
  $('watchBugClose')?.addEventListener('click', () => {panel.hidden=true;toggle.setAttribute('aria-expanded','false');});
  $('watchBugClear')?.addEventListener('click', () => {logs.length=0;renderLogs();addLog('info','Bug Reader','Log dibersihkan. Pemantauan tetap aktif.');});
  $('watchBugCopy')?.addEventListener('click', async () => {
    updateAll();
    const report = [
      'JSvidey Watch Bug Reader',
      'Waktu: ' + new Date().toISOString(),
      'Halaman: ' + location.origin + location.pathname + (location.search ? '?[query hidden]' : ''),
      '',
      'STATUS:',
      ...Array.from(checks.entries()).map(([k,v]) => `- ${k}: ${v.status} — ${v.value}`),
      '',
      'LOG:',
      ...(logs.length ? logs.map(x=>`[${x.time}] [${x.level.toUpperCase()}] ${x.source}: ${x.message}`) : ['Belum ada log error yang tertangkap.'])
    ].join('\n');
    try {
      await navigator.clipboard.writeText(report);
      addLog('info','Bug Reader','Laporan disalin ke clipboard.');
    } catch (_) {
      const area=document.createElement('textarea'); area.value=report; area.style.position='fixed';area.style.opacity='0';document.body.append(area);area.select();
      let copied=false;try{copied=document.execCommand('copy');}catch(__){}
      area.remove();addLog(copied?'info':'warn','Bug Reader',copied?'Laporan disalin ke clipboard.':'Clipboard diblokir browser. Buka log lalu salin manual.');
    }
  });

  window.addEventListener('error', event => {
    const where = event.filename ? safeUrl(event.filename) + (event.lineno ? ':'+event.lineno+ (event.colno ? ':'+event.colno : '') : '') : 'window';
    addLog('error','JavaScript',`${event.message || 'Error tidak diketahui'} — ${where}`);
  });
  window.addEventListener('unhandledrejection', event => {
    const reason = event.reason;
    addLog('error','Promise tidak tertangani',reason?.stack || reason?.message || reason || 'Alasan tidak tersedia');
  });
  window.addEventListener('error', event => {
    const target = event.target;
    if (target && target !== window && (target.src || target.href)) {
      addLog('error','Aset gagal dimuat',`${target.tagName || 'resource'}: ${safeUrl(target.src || target.href)}`);
    }
  }, true);

  // Capture network failures without recording request headers, bodies, or credentials.
  if (typeof window.fetch === 'function') {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const requestUrl = typeof args[0] === 'string' ? args[0] : args[0]?.url;
      try {
        const response = await originalFetch(...args);
        if (!response.ok) addLog('error','HTTP '+response.status,`${safeUrl(requestUrl || '')} — ${response.statusText || 'Request gagal'}`);
        return response;
      } catch (error) {
        addLog('error','Fetch / jaringan',`${safeUrl(requestUrl || '')} — ${error?.message || error}`);
        throw error;
      }
    };
  }

  // Log button interactions and refresh the visible status snapshot.
  ['likeVideoButton','commentJumpButton','shareVideoButton','favoriteVideoButton','commentForm'].forEach(id => {
    const el=$(id); if (!el) return;
    el.addEventListener(id==='commentForm'?'submit':'click', () => {
      addLog('info','Interaksi pengguna',`Aksi ${id} ditekan.`);
      setTimeout(updateAll, 250);
    }, true);
  });
  const observer = new MutationObserver(() => {
    if (!panel.hidden) updateAll();
  });
  ['state','statusText','socialNotice','commentList','relatedVideoGrid','videoTitle'].forEach(id => {
    const el=$(id); if (el) observer.observe(el,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['hidden','class','data-kind']});
  });
  addLog('info','Bug Reader','Pemantauan halaman Watch aktif. Buka panel setelah error muncul, lalu pilih Salin laporan.');
  updateAll();
})();
