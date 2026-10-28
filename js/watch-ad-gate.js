/* Jsvidey Watch gate: guest prompt at 10s / 25% / 25s; logged-in users are exempt. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const modal = $('watchAdGate');
  if (!modal) return;
  const title = $('watchAdGateTitle'), message = $('watchAdGateMessage');
  const nowBtn = $('watchAdNow'), login = $('watchAdLogin');
  const upgrade = $('watchAdUpgrade'), close = $('watchAdClose');
  const loading = $('watchAdGateLoading'), footnote = $('watchAdGateFootnote');
  const slot = $('adsterraWatchSlot');
  const url = 'https://ordvxiydkxbtahjpseph.supabase.co';
  const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
  // Use the site's public anon key; keep this aligned with the other page scripts.
  const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhbGciOiJIUzI1NiIsInR5cCI6MTc5MjYwMzcyMywiZXhwIjoyMTA4MTc5NzIzfQ.PCruI7EeLyagV_PMyCd57s3N9oYcL41k-fEgwE8G60E';
  const nextUrl = location.pathname + location.search;
  login.href = '/login.html?next=' + encodeURIComponent(nextUrl);
  let signedIn = false, authChecked = false, pendingPlayback = null, gateShown = false, busy = false, finished = false;
  let player = $('player'), iframe = $('embedPlayer'), frame = $('embedFrame');
  let activeKind = '', activeUrl = '', timer = null, playbackTimer = null, timeHandler = null;
  let savedTime = 0, wasPlaying = false, iframeWasVisible = false;
  function hide() { modal.hidden = true; document.body.style.overflow = ''; }
  function pauseAtGate() {
    player = $('player'); iframe = $('embedPlayer'); frame = $('embedFrame');
    wasPlaying = !!(player && !player.hidden && !player.paused);
    savedTime = player && !player.hidden ? Number(player.currentTime || 0) : 0;
    if (player && !player.hidden) { try { player.pause(); } catch (_) {} }
    iframeWasVisible = !!(frame && !frame.hidden);
    // Cross-origin embeds cannot be paused/read from JS; unload it while the modal is open.
    if (iframeWasVisible && iframe) iframe.src = 'about:blank';
  }
  function resumeAfterAd(restart) {
    player = $('player'); iframe = $('embedPlayer'); frame = $('embedFrame');
    if (activeKind === 'video' && player && !player.hidden) {
      try { player.currentTime = restart ? 0 : savedTime; } catch (_) {}
      if (wasPlaying || restart) player.play().catch(() => {});
    } else if (iframeWasVisible && iframe && frame) {
      iframe.src = activeUrl; // Cross-origin embeds resume from the beginning.
      frame.hidden = false;
    }
    wasPlaying = false; iframeWasVisible = false;
  }
  function showGate() {
    if (signedIn || gateShown || finished || busy) return;
    gateShown = true;
    pauseAtGate();
    title.textContent = 'Lanjut menonton?';
    message.textContent = 'Tonton iklan untuk melanjutkan menonton, atau login untuk melanjutkan tanpa iklan.';
    nowBtn.hidden = false; login.hidden = false; upgrade.hidden = true; close.hidden = false;
    close.textContent = 'Ulangi Video';
    nowBtn.disabled = false; loading.hidden = true;
    footnote.textContent = 'Notifikasi muncul setelah 10 detik, atau saat mencapai 25% durasi / 25 detik.';
    modal.hidden = false; document.body.style.overflow = 'hidden';
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
  nowBtn.addEventListener('click', () => {
    if (busy || signedIn || finished) return;
    busy = true; nowBtn.disabled = true; loading.hidden = false;
    loading.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Memproses, tunggu 2 detik…';
    loadAdsterra();
    setTimeout(() => {
      busy = false; gateShown = true;
      hide();
      resumeAfterAd(false);
    }, 2000);
  });
  close.addEventListener('click', () => {
    if (timer) clearTimeout(timer);
    if (playbackTimer) clearTimeout(playbackTimer);
    hide();
    gateShown = false;
    resumeAfterAd(true);
    attachPlaybackGate();
  });
  upgrade.addEventListener('click', () => { finished = true; });
  modal.addEventListener('click', e => { if (e.target === modal) { /* require an explicit choice */ } });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) e.preventDefault(); });

  function attachPlaybackGate() {
    if (signedIn || finished || gateShown) return;
    if (timer) clearTimeout(timer);
    if (playbackTimer) clearTimeout(playbackTimer);
    // The 10-second gate applies even when an embed does not expose playback progress.
    timer = setTimeout(showGate, 10000);
    player = $('player');
    if (player) {
      if (timeHandler) {
        player.removeEventListener('timeupdate', timeHandler);
        player.removeEventListener('loadedmetadata', timeHandler);
      }
      timeHandler = () => {
        if (signedIn || gateShown || finished || player.hidden || !Number.isFinite(player.duration)) return;
        if (player.currentTime >= 25 || (player.duration > 0 && player.currentTime >= player.duration * 0.25)) showGate();
      };
      player.addEventListener('timeupdate', timeHandler);
      player.addEventListener('loadedmetadata', timeHandler);
    }
    // Cross-origin iframes cannot expose duration/time; 25 seconds is the safe fallback.
    playbackTimer = setTimeout(showGate, 25000);
  }
  window.addEventListener('jsvidey:player-started', e => {
    pendingPlayback = e.detail || {};
    activeKind = pendingPlayback.kind || 'embed';
    activeUrl = pendingPlayback.url || window.__sourceVideoUrl || '';
    gateShown = false;
    if (authChecked && !signedIn) attachPlaybackGate();
  });
  (async () => {
    try {
      if (window.supabase?.createClient) {
        const db = window.jsvideySupabaseClient || window.supabase.createClient(url, anonKey, {
          auth: { persistSession: true, autoRefreshToken: true, storageKey: 'sb-ordvxiydkxbtahjpseph-auth-token' }
        });
        const { data } = await db.auth.getSession();
        signedIn = Boolean(data?.session?.user);
      }
    } catch (_) {}
    authChecked = true;
    if (pendingPlayback && !signedIn) attachPlaybackGate();
    // No ad modal for logged-in users. This prompt is informational only.
    if (signedIn) {
      timer = setTimeout(() => {
        if (finished) return;
        title.textContent = 'Upgrade Akun untuk Menonton Tanpa Iklan';
        message.textContent = 'Nikmati pengalaman menonton tanpa iklan dengan meningkatkan akunmu.';
        nowBtn.hidden = true; login.hidden = true; close.hidden = true; upgrade.hidden = false;
        footnote.textContent = 'Pengingat upgrade ditampilkan satu kali pada halaman Watch.';
        modal.hidden = false; document.body.style.overflow = 'hidden';
      }, 15000);
    }
  })();
})();
