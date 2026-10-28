/* JSShow Watch monetization and guest ad gate.
   Ad network scripts are loaded only into visible slots. Popunder is initialized once per page/session
   rather than repeatedly re-injecting the same provider script every few seconds. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const SUPABASE_URL = 'https://ordvxiydkxbtahjpseph.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhbGciOiJIUzI1NiIsInJlZiI6Im9yZHZ4aXlka3hidGFoanBzZXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2MDM3MjMsImV4cCI6MjEwODE3OTcyM30.PCruI7EeLyagV_PMyCd57s3N9oYcL41k-fEgwE8G60E';
  const SOCIAL_SRC = 'https://brijmohan.org/14/57202f289afd48d4d1ed5e246ce84208';
  const POPUNDER_SRC = 'https://ahuramazda.org/1/ac71832b0a31a9127f2edee0b96828bb';
  const modal = $('watchAdGate'), screen = $('watchAdScreen');
  if (!modal || !screen) return;
  const title = $('watchAdGateTitle'), message = $('watchAdGateMessage');
  const nowBtn = $('watchAdNow'), login = $('watchAdLogin'), upgrade = $('watchAdUpgrade');
  const closeBtn = $('watchAdClose'), loading = $('watchAdGateLoading');
  const screenSlot = $('watchAdScreenSlot'), screenClose = $('watchAdScreenClose');
  let db = null, user = null, plan = 'free', adsAllowed = true, authReady = false;
  let player = $('player'), iframe = $('embedPlayer'), frame = $('embedFrame');
  let activeKind = '', activeUrl = '', savedTime = 0, wasPlaying = false, iframeWasVisible = false;
  let adCount = 0, busy = false, promptOpen = false, screenOpen = false, finished = false;
  let cycleTimer = null, promptTimer = null, playbackStarted = false;
  const nextUrl = location.pathname + location.search;
  login.href = '/login.html?next=' + encodeURIComponent(nextUrl);

  function hidePrompt() { modal.hidden = true; document.body.style.overflow = ''; promptOpen = false; }
  function pauseVideo() {
    player = $('player'); iframe = $('embedPlayer'); frame = $('embedFrame');
    wasPlaying = !!(player && !player.hidden && !player.paused);
    savedTime = player && !player.hidden ? Number(player.currentTime || 0) : 0;
    if (player && !player.hidden) { try { player.pause(); } catch (_) {} }
    iframeWasVisible = !!(frame && !frame.hidden);
    if (iframeWasVisible && iframe) iframe.src = 'about:blank';
  }
  function resumeVideo(restart = false) {
    player = $('player'); iframe = $('embedPlayer'); frame = $('embedFrame');
    if (activeKind === 'video' && player && !player.hidden) {
      try { player.currentTime = restart ? 0 : savedTime; } catch (_) {}
      if (wasPlaying || restart) player.play().catch(() => {});
    } else if (iframeWasVisible && iframe && frame) {
      iframe.src = activeUrl;
      frame.hidden = false;
    }
    wasPlaying = false; iframeWasVisible = false;
  }
  function addScript(src, id) {
    if (id && document.getElementById(id)) return Promise.resolve();
    return new Promise(resolve => {
      const s = document.createElement('script');
      if (id) s.id = id;
      s.async = true; s.setAttribute('data-cfasync', 'false'); s.src = src;
      s.onload = () => resolve(); s.onerror = () => resolve();
      setTimeout(resolve, 2500);
      document.body.appendChild(s);
    });
  }
  function loadAdUnit(slot, key, width, height) {
    if (!slot || slot.dataset.adLoaded === '1') return Promise.resolve();
    slot.dataset.adLoaded = '1';
    slot.replaceChildren();
    slot.style.setProperty('--ad-width', width + 'px');
    slot.style.setProperty('--ad-height', height + 'px');
    const options = document.createElement('script');
    options.text = `window.atOptions = ${JSON.stringify({key, format:'iframe', height, width, params:{}})};`;
    slot.appendChild(options);
    return new Promise(resolve => {
      const s = document.createElement('script');
      s.async = true; s.setAttribute('data-cfasync','false');
      s.src = 'https://brijmohan.org/22/' + key;
      s.onload = () => resolve(); s.onerror = () => resolve();
      setTimeout(resolve, 2500);
      slot.appendChild(s);
    });
  }
  async function loadBannerAds() {
    // Top and bottom 728x90 leaderboard units.
    await loadAdUnit($('watchAdAbovePlayer'), '3141a4f24ed6a3e4353abd22e9d1ee2d', 728, 90);
    await loadAdUnit($('watchAdBelowPlayer'), '3141a4f24ed6a3e4353abd22e9d1ee2d', 728, 90);
    // Inline related-video placements; use the 300x250 unit once and the 320x50 unit once.
    await loadAdUnit($('relatedAdTop'), '8121f37c9d72c5a783b49a164290ed39', 300, 250);
    await loadAdUnit($('relatedAdMiddle'), '395e8278d34b195fc638caf9be3c095a', 320, 50);
  }
  async function loadFullscreenAd() {
    if (!screenSlot) return;
    screenSlot.replaceChildren();
    screenSlot.style.setProperty('--ad-width','160px');
    screenSlot.style.setProperty('--ad-height','600px');
    const options = document.createElement('script');
    options.text = `window.atOptions = ${JSON.stringify({key:'3e098c5e726febcf4069731a84e69010',format:'iframe',height:600,width:160,params:{}})};`;
    screenSlot.appendChild(options);
    await new Promise(resolve => {
      const s = document.createElement('script');
      s.async = true; s.setAttribute('data-cfasync','false');
      s.src = 'https://brijmohan.org/22/3e098c5e726febcf4069731a84e69010';
      s.onload = () => resolve(); s.onerror = () => resolve();
      screenSlot.appendChild(s);
      setTimeout(resolve, 2500);
    });
  }
  function showPrompt() {
    if (!adsAllowed || finished || promptOpen || screenOpen) return;
    if (cycleTimer) clearTimeout(cycleTimer);
    pauseVideo();
    title.textContent = 'Tonton iklan dahulu atau login';
    message.textContent = 'Untuk melanjutkan menonton, pilih Watch Now atau login ke akunmu.';
    nowBtn.hidden = false; login.hidden = false; upgrade.hidden = true;
    closeBtn.hidden = true; loading.hidden = true; nowBtn.disabled = false;
    modal.hidden = false; promptOpen = true; document.body.style.overflow = 'hidden';
  }
  async function showScreenAd() {
    if (!adsAllowed || finished || screenOpen || promptOpen) return;
    if (cycleTimer) clearTimeout(cycleTimer);
    pauseVideo();
    screenOpen = true; screen.hidden = false; document.body.style.overflow = 'hidden';
    await loadFullscreenAd();
  }
  function closeScreenAd() {
    if (!screenOpen) return;
    screen.hidden = true; screenOpen = false; document.body.style.overflow = '';
    if (screenSlot) screenSlot.replaceChildren();
    adCount++;
    resumeVideo(false);
    if (adCount >= 3) showPrompt();
    else cycleTimer = setTimeout(showScreenAd, 10000);
  }
  screenClose.addEventListener('click', closeScreenAd);
  nowBtn.addEventListener('click', async () => {
    if (busy || !adsAllowed || finished) return;
    busy = true; nowBtn.disabled = true; loading.hidden = false;
    loading.textContent = 'Menyiapkan iklan…';
    // This popunder unit is intentionally loaded once per page visit; repeatedly
    // re-injecting it every 5 seconds can create invalid impressions/popups.
    await addScript(POPUNDER_SRC, 'jsv-watch-popunder-once');
    hidePrompt();
    resumeVideo(false);
    busy = false; nowBtn.disabled = false; loading.hidden = true;
    promptTimer = setTimeout(showPrompt, 15000);
  });
  closeBtn.addEventListener('click', () => { hidePrompt(); resumeVideo(true); cycleTimer = setTimeout(showScreenAd, 10000); });
  upgrade.addEventListener('click', () => { finished = true; });
  modal.addEventListener('click', e => { if (e.target === modal) e.preventDefault(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && (!modal.hidden || !screen.hidden)) e.preventDefault();
  });

  function attachGuestCycle() {
    if (!authReady || !adsAllowed || finished) return;
    if (cycleTimer) clearTimeout(cycleTimer);
    if (promptTimer) clearTimeout(promptTimer);
    cycleTimer = setTimeout(showScreenAd, 10000);
    // Guest ad sequence is time-based: first overlay after 10 seconds, then every 10 seconds.
  }
  function activePlan(profile) {
    const p = String(profile?.plan || 'free').toLowerCase();
    const expires = profile?.plan_expires_at ? Date.parse(profile.plan_expires_at) : null;
    const active = !Number.isFinite(expires) || expires === null || expires > Date.now();
    return active && ['vip','premium','pro'].includes(p);
  }
  async function resolveUserAndAds() {
    try {
      if (window.supabase?.createClient) {
        db = window.jsvideySupabaseClient || (window.jsvideySupabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: { persistSession:true, autoRefreshToken:true, storageKey:'sb-ordvxiydkxbtahjpseph-auth-token' }
        }));
        const {data} = await db.auth.getSession();
        user = data?.session?.user || null;
        let profile = null;
        if (user) {
          try {
            const result = await db.from('profiles').select('plan,plan_expires_at').eq('id',user.id).maybeSingle();
            profile = result?.data || null;
          } catch (_) {}
        }
        const paid = activePlan(profile);
        plan = paid ? String(profile?.plan || '').toLowerCase() : 'free';
        adsAllowed = !paid;
      }
    } catch (_) { user = null; plan = 'free'; adsAllowed = true; }
    authReady = true;
    if (adsAllowed) await loadBannerAds();
    if (user && adsAllowed) {
      // Social bar appears twice for logged-in free accounts as requested.
      await addScript(SOCIAL_SRC, 'jsv-watch-socialbar-free-1');
      await addScript(SOCIAL_SRC, 'jsv-watch-socialbar-free-2');
      // Start provider popunder once after page initialization, not by script-spamming every 5 seconds.
      setTimeout(() => addScript(POPUNDER_SRC, 'jsv-watch-popunder-free-once'), 5000);
      const ticker = $('watchUpgradeTicker');
      if (ticker) ticker.hidden = false;
    }
    // VIP/Premium accounts do not load any Watch-page ads.
  }
  window.addEventListener('jsvidey:player-started', e => {
    const d = e.detail || {};
    activeKind = d.kind || 'embed'; activeUrl = d.url || window.__sourceVideoUrl || '';
    playbackStarted = true;
    if (authReady && !user) attachGuestCycle();
  });
  resolveUserAndAds().then(() => {
    if (!user) {
      const ticker = $('watchUpgradeTicker');
      if (ticker) ticker.hidden = true;
      if (playbackStarted) attachGuestCycle();
    }
  });
})();
