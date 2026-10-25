/* Admin-only per-page diagnostic monitor. Logs stay in this browser; no visitor telemetry is uploaded. */
(() => {
  'use strict';
  const LOG_KEY = 'jsvidey_admin_bug_logs_v1';
  const MAX_LOGS = 200;
  const BUFFER_LIMIT = 80;
  const buffer = [];
  let active = false;
  let pageKey = '';
  let ui = null;
  let diagnosticDb = null;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const safe = value => String(value ?? '')
    .replace(/Bearer\s+[\w.-]+/gi, 'Bearer [REDACTED]')
    .replace(/eyJ[\w.-]{20,}/g, '[TOKEN REDACTED]')
    .replace(/(access_token|refresh_token|apikey|api_key|authorization|password|secret)=([^&\s]+)/gi, '$1=[REDACTED]')
    .slice(0, 1400);
  const safeUrl = value => {
    try { const u = new URL(value, location.href); return u.origin + u.pathname + (u.search ? '?[query hidden]' : ''); }
    catch (_) { return ''; }
  };
  function currentPageKey() {
    const path = location.pathname.replace(/\/+$/, '') || '/';
    if (/\/v\/[^/]+$/i.test(path) || /\/watch(?:\.html)?$/i.test(path)) return 'watch';
    const bodyPage = document.body?.dataset?.page;
    if (bodyPage) {
      if (bodyPage === 'home') return 'index';
      if (bodyPage === 'member-dashboard') return 'dashboard';
      const category = new URLSearchParams(location.search).get('category');
      if (bodyPage === 'categories' && category) return 'category:' + category;
      return bodyPage;
    }
    return (path.split('/').filter(Boolean).pop() || 'index').replace(/\.html?$/i, '') || 'index';
  }
  function getStored() {
    try { const value = JSON.parse(localStorage.getItem(LOG_KEY) || '[]'); return Array.isArray(value) ? value : []; }
    catch (_) { return []; }
  }
  function save(entry) {
    if (!active) { buffer.push(entry); if (buffer.length > BUFFER_LIMIT) buffer.shift(); return; }
    const rows = getStored();
    rows.push(entry);
    try { localStorage.setItem(LOG_KEY, JSON.stringify(rows.slice(-MAX_LOGS))); } catch (_) {}
    if (diagnosticDb) {
      diagnosticDb.from('jsvidey_admin_bug_logs').insert({page:entry.page||'unknown',level:['ERROR','WARN','INFO'].includes(entry.level)?entry.level:'ERROR',message:String(entry.message||'').slice(0,1400),source:entry.source||null,line:Number(entry.line)||null,column_no:Number(entry.column)||null}).then(()=>{}).catch(()=>{});
    }
    render();
  }
  function add(level, message, source = '', line = '', column = '') {
    save({
      time: new Date().toISOString(),
      page: pageKey || currentPageKey(),
      level,
      message: safe(message),
      source: source ? safeUrl(source) : '',
      line: line || '',
      column: column || ''
    });
  }

  // Capture early, before the page's application scripts execute.
  window.addEventListener('error', event => {
    if (event instanceof ErrorEvent) {
      add('ERROR', event.message || event.error?.message || 'JavaScript error', event.filename, event.lineno, event.colno);
    } else {
      const target = event.target;
      const source = target?.src || target?.href || '';
      if (source) add('ERROR', 'Resource gagal dimuat: ' + safeUrl(source), source);
    }
  }, true);
  window.addEventListener('unhandledrejection', event => {
    const reason = event.reason;
    add('ERROR', 'Promise tidak tertangani: ' + (reason?.stack || reason?.message || reason || 'alasan tidak tersedia'));
  });

  function ensureStyles() {
    if (document.getElementById('jsvAdminBugStyle')) return;
    const link = document.createElement('link');
    link.id = 'jsvAdminBugStyle';
    link.rel = 'stylesheet';
    link.href = '/css/admin-bug-monitor.css?v=20261025-admin-bug-monitor-v1';
    document.head.appendChild(link);
  }
  function createUI() {
    if (ui || !document.body) return;
    ensureStyles();
    const wrap = document.createElement('aside');
    wrap.id = 'jsvAdminBugReader';
    wrap.className = 'jsv-admin-bug-reader';
    wrap.innerHTML = `<button type="button" class="jsv-admin-bug-toggle" id="jsvAdminBugToggle" aria-expanded="false"><span aria-hidden="true">⚕</span> Bug Reader Admin <b id="jsvAdminBugCount">0</b></button>
      <section class="jsv-admin-bug-panel" id="jsvAdminBugPanel" hidden>
        <header><div><strong>Diagnostik halaman</strong><small id="jsvAdminBugPage"></small></div><button type="button" id="jsvAdminBugClose" aria-label="Tutup">×</button></header>
        <p class="jsv-admin-bug-note">Hanya tampil untuk administrator. Log disimpan di browser ini, bukan dikirim ke server.</p>
        <div id="jsvAdminBugStatus" class="jsv-admin-bug-status"></div>
        <div id="jsvAdminBugList" class="jsv-admin-bug-list"></div>
        <footer><button type="button" id="jsvAdminBugCopy">Salin laporan</button><button type="button" id="jsvAdminBugClear">Bersihkan log</button></footer>
      </section>`;
    document.body.appendChild(wrap);
    ui = wrap;
    const toggle = wrap.querySelector('#jsvAdminBugToggle');
    const panel = wrap.querySelector('#jsvAdminBugPanel');
    toggle.addEventListener('click', () => { panel.hidden = !panel.hidden; toggle.setAttribute('aria-expanded', String(!panel.hidden)); });
    wrap.querySelector('#jsvAdminBugClose').addEventListener('click', () => { panel.hidden = true; toggle.setAttribute('aria-expanded', 'false'); });
    wrap.querySelector('#jsvAdminBugCopy').addEventListener('click', async () => {
      const rows = getStored().filter(row => row.page === pageKey);
      const report = JSON.stringify({ page: pageKey, capturedAt: new Date().toISOString(), logs: rows }, null, 2);
      try { await navigator.clipboard.writeText(report); setStatus('Laporan halaman berhasil disalin.'); }
      catch (_) { setStatus('Clipboard tidak tersedia. Lihat laporan dari panel admin.'); }
    });
    wrap.querySelector('#jsvAdminBugClear').addEventListener('click', () => {
      const rows = getStored().filter(row => row.page !== pageKey);
      try { localStorage.setItem(LOG_KEY, JSON.stringify(rows)); } catch (_) {}
      render();
      setStatus('Log halaman ini dibersihkan.');
    });
    render();
  }
  function setStatus(text) { const node = ui?.querySelector('#jsvAdminBugStatus'); if (node) node.textContent = text; }
  function render() {
    if (!ui) return;
    const rows = getStored().filter(row => row.page === pageKey).slice(-80).reverse();
    const errors = rows.filter(row => row.level === 'ERROR').length;
    const count = ui.querySelector('#jsvAdminBugCount');
    if (count) count.textContent = String(errors);
    const page = ui.querySelector('#jsvAdminBugPage');
    if (page) page.textContent = pageKey;
    const list = ui.querySelector('#jsvAdminBugList');
    if (list) list.innerHTML = rows.length ? rows.map(row => `<article class="jsv-admin-bug-entry ${row.level === 'ERROR' ? 'is-error' : row.level === 'WARN' ? 'is-warn' : ''}"><div><b>${esc(row.level)}</b><time>${esc(row.time)}</time></div><pre>${esc(row.message)}</pre>${row.source ? `<small>${esc(row.source)}${row.line ? ':'+esc(row.line) : ''}${row.column ? ':'+esc(row.column) : ''}</small>` : ''}</article>`).join('') : '<p class="jsv-admin-bug-empty">Belum ada error yang tertangkap pada halaman ini.</p>';
  }
  async function loadSupabase() {
    if (window.supabase?.createClient) return true;
    return new Promise(resolve => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      script.onload = () => resolve(!!window.supabase?.createClient);
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });
  }
  async function init() {
    pageKey = currentPageKey();
    if (!await loadSupabase()) return;
    const url = 'https://ordvxiydkxbtahjpseph.supabase.co';
    const anon = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yZHZ4aXlka3hidGFoanBzZXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2MDM3MjMsImV4cCI6MjEwODE3OTcyM30.PCruI7EeLyagV_PMyCd57s3N9oYcL41k-fEgwE8G60E";
    let db = window.jsvideySupabaseClient;
    if (!db) {
      db = window.supabase.createClient(url, anon, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'sb-ordvxiydkxbtahjpseph-auth-token' } });
      window.jsvideySupabaseClient = db;
    }
    try {
      const auth = await db.auth.getUser();
      if (auth.error || !auth.data?.user) return;
      const admin = await db.rpc('jsvidey_is_admin');
      if (admin.error || admin.data !== true) return;
      const result = await db.rpc('jsvidey_public_platform_status');
      if (result.error || !result.data) return;
      const controls = result.data.page_controls || {};
      const rule = controls[pageKey] || (pageKey.startsWith('category:') ? controls.categories : null);
      if (!rule?.bug_reader_enabled) return;
      diagnosticDb = db;
      active = true;
      createUI();
      const buffered = buffer.splice(0);
      if (buffered.length) {
        const rows = getStored().concat(buffered);
        try { localStorage.setItem(LOG_KEY, JSON.stringify(rows.slice(-MAX_LOGS))); } catch (_) {}
        for (const entry of buffered) diagnosticDb.from('jsvidey_admin_bug_logs').insert({page:entry.page||pageKey,level:entry.level||'ERROR',message:String(entry.message||'').slice(0,1400),source:entry.source||null,line:Number(entry.line)||null,column_no:Number(entry.column)||null}).then(()=>{}).catch(()=>{});
      }
      render();
      setStatus('Pemantauan aktif. Error yang terjadi akan dicatat pada laporan lokal.');
    } catch (_) {
      // Diagnostic tooling must never interfere with the page it observes.
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { init(); }, { once: true });
  else init();
})();
