/* Jsvidey Watch Adsterra gate. Ad code is loaded only after a deliberate Watch Now click. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const modal = $('watchAdGate');
  if (!modal) return;
  const title = $('watchAdGateTitle');
  const message = $('watchAdGateMessage');
  const nowBtn = $('watchAdNow');
  const login = $('watchAdLogin');
  const upgrade = $('watchAdUpgrade');
  const close = $('watchAdClose');
  const loading = $('watchAdGateLoading');
  const footnote = $('watchAdGateFootnote');
  const slot = $('adsterraWatchSlot');
  const url = 'https://ordvxiydkxbtahjpseph.supabase.co';
  const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yZHZ4aXlka3hidGFoanBzZXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2MDM3MjMsImV4cCI6MjEwODE3OTcyM30.PCruI7EeLyagV_PMyCd57s3N9oYcL41k-fEgwE8G60E';
  let attempts = 0, timer = null, busy = false, userSignedIn = false, finished = false;
  const nextUrl = location.pathname + location.search;
  const loginUrl = '/login.html?next=' + encodeURIComponent(nextUrl);
  login.href = loginUrl;
  function show() {
    if (finished) return;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function hide() {
    modal.hidden = true;
    document.body.style.overflow = '';
  }
  function setMode(mode) {
    nowBtn.hidden = mode !== 'ad';
    login.hidden = mode !== 'login';
    upgrade.hidden = mode !== 'upgrade';
    close.hidden = mode === 'login';
    loading.hidden = true;
    if (mode === 'ad') {
      title.textContent = 'Lanjut nonton iklan dulu';
      message.textContent = 'Bantu dukung Jsvidey dengan membuka iklan singkat sebelum menonton.';
      footnote.textContent = `Iklan ${attempts + 1} dari 3 untuk pengunjung yang belum login.`;
    } else if (mode === 'login') {
      title.textContent = 'Lanjut menonton tanpa iklan berikutnya';
      message.textContent = 'Kamu sudah menyelesaikan 3 kesempatan iklan. Masuk atau daftar untuk melanjutkan.';
      login.textContent = 'Lanjut tanpa iklan · Masuk Sekarang';
      footnote.textContent = 'Setelah masuk, kamu bisa melanjutkan pengalaman menonton.';
    } else {
      title.textContent = 'Upgrade Akun untuk Menonton Tanpa Iklan';
      message.textContent = 'Tingkatkan akunmu untuk menikmati pengalaman menonton yang lebih nyaman.';
      upgrade.textContent = 'Upgrade Akun';
      footnote.textContent = 'Pengingat ini hanya muncul satu kali pada halaman Watch ini.';
    }
  }
  function loadAdsterra() {
    if (!slot) return;
    slot.replaceChildren();
    const container = document.createElement('div');
    container.id = 'container-9d5f79baa8e59d6c69ccbbb496662e1b';
    container.style.cssText = 'width:100%;max-width:100%;min-height:0;overflow:hidden;';
    slot.appendChild(container);
    const script = document.createElement('script');
    script.async = true;
    script.setAttribute('data-cfasync', 'false');
    script.src = 'https://brijmohan.org/21/9d5f79baa8e59d6c69ccbbb496662e1b';
    slot.appendChild(script);
  }
  function scheduleNext() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      if (attempts < 3) {
        setMode('ad');
      } else {
        setMode('login');
      }
      show();
    }, 10000);
  }
  nowBtn.addEventListener('click', () => {
    if (busy || finished) return;
    busy = true;
    nowBtn.disabled = true;
    loading.hidden = false;
    loading.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Memproses, tunggu 2 detik…';
    loadAdsterra();
    setTimeout(() => {
      attempts += 1;
      busy = false;
      nowBtn.disabled = false;
      hide();
      scheduleNext();
    }, 2000);
  });
  close.addEventListener('click', () => {
    finished = true;
    if (timer) clearTimeout(timer);
    hide();
  });
  modal.addEventListener('click', e => {
    if (e.target === modal && !login.hidden) return;
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !modal.hidden && !login.hidden) e.preventDefault();
  });
  upgrade.addEventListener('click', () => { finished = true; });
  (async () => {
    try {
      if (window.supabase?.createClient) {
        const db = window.supabase.createClient(url, key, {
          auth: { persistSession: true, autoRefreshToken: true, storageKey: 'sb-ordvxiydkxbtahjpseph-auth-token' }
        });
        const { data } = await db.auth.getSession();
        userSignedIn = Boolean(data?.session?.user);
      }
    } catch (_) {}
    if (userSignedIn) {
      timer = setTimeout(() => {
        if (finished) return;
        setMode('upgrade');
        show();
      }, 15000);
    } else {
      timer = setTimeout(() => {
        if (finished) return;
        setMode('ad');
        show();
      }, 900);
    }
  })();
})();
