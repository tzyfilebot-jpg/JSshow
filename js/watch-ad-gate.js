/* JSSHOW Watch monetization.
   Guest sequence: full-screen Adsterra unit every 10 seconds; after 3 dismissals,
   offer Watch Now or Login. Watch Now opens the supplied destination and the prompt
   returns after 15 seconds. Logged-in free users get ads + upgrade ticker; paid users
   have no Watch-page ads. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const SUPABASE_URL = 'https://ordvxiydkxbtahjpseph.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhbGciOiJIUzI1NiIsInJlZiI6Im9yZHZ4aXlka3hidGFoanBzZXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2MDM3MjMsImV4cCI6MjEwODE3OTcyM30.PCruI7EeLyagV_PMyCd57s3N9oYcL41k-fEgwE8G60E';
  const SOCIAL_SRC = 'https://brijmohan.org/14/57202f289afd48d4d1ed5e246ce84208';
  const POPUNDER_SRC = 'https://ahuramazda.org/1/ac71832b0a31a9127f2edee0b96828bb';
  const GATE_AD_SRC = 'https://brijmohan.org/21/9d5f79baa8e59d6c69ccbbb496662e1b';
  const WATCH_URL = 'https://asiaso.org/4/ccdc2f004ac67e05a3202365083f8a96';
  const modal = $('watchAdGate'), screen = $('watchAdScreen');
  if (!modal || !screen) return;
  const title = $('watchAdGateTitle'), message = $('watchAdGateMessage');
  const nowBtn = $('watchAdNow'), login = $('watchAdLogin'), upgrade = $('watchAdUpgrade');
  const closeBtn = $('watchAdClose'), loading = $('watchAdGateLoading');
  const screenSlot = $('watchAdScreenSlot'), screenClose = $('watchAdScreenClose');
  const ticker = $('watchUpgradeTicker');
  let db = null, user = null, plan = 'free', adsAllowed = true, authReady = false;
  let player = $('player'), iframe = $('embedPlayer'), frame = $('embedFrame');
  let activeUrl = '', savedTime = 0, wasPlaying = false, iframeWasVisible = false;
  let adCount = 0, busy = false, promptOpen = false, screenOpen = false;
  let cycleTimer = null, promptTimer = null, playbackStarted = false, freeInterstitialTimer = null;
  const nextUrl = location.pathname + location.search;
  if (login) login.href = '/login.html?next=' + encodeURIComponent(nextUrl);

  function stopTimer(name) {
    if (name === 'cycle' && cycleTimer) clearTimeout(cycleTimer);
    if (name === 'prompt' && promptTimer) clearTimeout(promptTimer);
    if (name === 'free' && freeInterstitialTimer) clearTimeout(freeInterstitialTimer);
    if (name === 'cycle') cycleTimer = null;
    if (name === 'prompt') promptTimer = null;
    if (name === 'free') freeInterstitialTimer = null;
  }
  function hidePrompt() {
    modal.hidden = true;
    document.body.style.overflow = '';
    promptOpen = false;
  }
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
    if (player && !player.hidden) {
      try { player.currentTime = restart ? 0 : savedTime; } catch (_) {}
      if (wasPlaying || restart) player.play().catch(() => {});
    } else if (iframeWasVisible && iframe && frame) {
      iframe.src = activeUrl || window.__sourceVideoUrl || '';
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
      setTimeout(resolve, 3000);
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
      setTimeout(resolve, 3000);
      slot.appendChild(s);
    });
  }
  async function loadBannerAds() {
    await loadAdUnit($('watchAdAbovePlayer'), '3141a4f24ed6a3e4353abd22e9d1ee2d', 728, 90);
    await loadAdUnit($('watchAdBelowPlayer'), '3141a4f24ed6a3e4353abd22e9d1ee2d', 728, 90);
    await loadAdUnit($('relatedAdTop'), '8121f37c9d72c5a783b49a164290ed39', 300, 250);
    await loadAdUnit($('relatedAdMiddle'), '395e8278d34b195fc638caf9be3c095a', 320, 50);
  }
  function loadFullscreenAd() {
    if (!screenSlot) return;
    screenSlot.replaceChildren();
    screenSlot.style.cssText = 'width:100%;height:100%;max-width:none;display:block;overflow:auto;background:transparent;';
    const container = document.createElement('div');
    container.id = 'container-9d5f79baa8e59d6c69ccbbb496662e1b';
    container.style.cssText = 'width:100%;min-height:250px;display:flex;align-items:center;justify-content:center;';
    screenSlot.appendChild(container);
    const script = document.createElement('script');
    script.async = true; script.setAttribute('data-cfasync','false'); script.src = GATE_AD_SRC;
    screenSlot.appendChild(script);
  }
  function showPrompt() {
    if (!adsAllowed || user || promptOpen || screenOpen) return;
    stopTimer('cycle');
    pauseVideo();
    title.textContent = 'Tonton iklan dahulu atau login';
    message.textContent = 'Pilih Watch Now untuk membuka iklan, atau login untuk melanjutkan menonton.';
    nowBtn.hidden = false; login.hidden = false; upgrade.hidden = true;
    closeBtn.hidden = true; loading.hidden = true; nowBtn.disabled = false;
    modal.hidden = false; promptOpen = true; document.body.style.overflow = 'hidden';
  }
  function showScreenAd() {
    if (!adsAllowed || user || screenOpen || promptOpen) return;
    stopTimer('cycle');
    pauseVideo();
    screenOpen = true; screen.hidden = false; document.body.style.overflow = 'hidden';
    loadFullscreenAd();
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
  if (screenClose) screenClose.addEventListener('click', closeScreenAd);
  if (nowBtn) nowBtn.addEventListener('click', () => {
    if (busy || !adsAllowed || user) return;
    // Open directly from the click so mobile browsers do not block the destination.
    window.open(WATCH_URL, '_blank', 'noopener,noreferrer');
    hidePrompt();
    resumeVideo(false);
    stopTimer('prompt');
    promptTimer = setTimeout(showPrompt, 15000);
  });
  if (closeBtn) closeBtn.addEventListener('click', () => { hidePrompt(); resumeVideo(true); cycleTimer = setTimeout(showScreenAd, 10000); });
  if (upgrade) upgrade.addEventListener('click', () => { stopTimer('cycle'); stopTimer('prompt'); });
  if (modal) modal.addEventListener('click', e => { if (e.target === modal) e.preventDefault(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && (!modal.hidden || !screen.hidden)) e.preventDefault();
  });

  function attachGuestCycle() {
    if (!authReady || !adsAllowed || user) return;
    stopTimer('cycle'); stopTimer('prompt');
    cycleTimer = setTimeout(showScreenAd, 10000);
  }
  function scheduleFreeInterstitial() {
    stopTimer('free');
    if (!authReady || !user || !adsAllowed || !playbackStarted) return;
    freeInterstitialTimer = setTimeout(() => {
      if (!adsAllowed || !user || document.visibilityState === 'hidden') {
        scheduleFreeInterstitial(); return;
      }
      screenOpen = true; screen.hidden = false; document.body.style.overflow = 'hidden';
      pauseVideo(); loadFullscreenAd();
      // Free members dismiss this ad with the small X; next one is scheduled 15s later.
    }, 15000);
  }
  function activePlan(profile) {
    const p = String(profile?.plan || 'free').toLowerCase();
    const expires = profile?.plan_expires_at ? Date.parse(profile.plan_expires_at) : null;
    const active = expires === null || !Number.isFinite(expires) || expires > Date.now();
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
      // Load two separate social-bar instances for free logged-in members.
      await addScript(SOCIAL_SRC, 'jsv-watch-socialbar-free-1');
      await addScript(SOCIAL_SRC, 'jsv-watch-socialbar-free-2');
      // Popunder providers generally initialize on script load; reinjecting every 5s can
      // create uncontrolled popup loops, so initialize once and leave frequency to provider settings.
      setTimeout(() => addScript(POPUNDER_SRC, 'jsv-watch-popunder-free-once'), 5000);
      if (ticker) ticker.hidden = false;
    } else if (ticker) ticker.hidden = true;
    if (user && !adsAllowed) {
      if (ticker) ticker.hidden = true;
      hidePrompt(); screen.hidden = true; screenOpen = false;
      stopTimer('cycle'); stopTimer('prompt'); stopTimer('free');
    }
    if (!user && playbackStarted) attachGuestCycle();
  }
  window.addEventListener('jsvidey:player-started', e => {
    const d = e.detail || {};
    activeUrl = d.url || window.__sourceVideoUrl || '';
    playbackStarted = true;
    if (!authReady) return;
    if (!user && adsAllowed) attachGuestCycle();
    else if (user && adsAllowed) scheduleFreeInterstitial();
  });
  // Free-account interstitials repeat every 15 seconds after each close.
  if (screenClose) {
    screenClose.addEventListener('click', () => {
      if (user && adsAllowed) {
        stopTimer('free');
        scheduleFreeInterstitial();
      }
    });
  }
  resolveUserAndAds().then(() => {
    if (user && adsAllowed && playbackStarted) scheduleFreeInterstitial();
    if (!user && playbackStarted) attachGuestCycle();
  });
})();