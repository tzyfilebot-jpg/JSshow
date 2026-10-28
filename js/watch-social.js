const SUPABASE_URL = 'https://ordvxiydkxbtahjpseph.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yZHZ4aXlka3hidGFoanBzZXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2MDM3MjMsImV4cCI6MjEwODE3OTcyM30.PCruI7EeLyagV_PMyCd57s3N9oYcL41k-fEgwE8G60E';

(() => {
  const $ = id => document.getElementById(id);
  const withTimeout = (promise, ms = 12000, message = 'Permintaan ke Supabase terlalu lama.') =>
    Promise.race([
      Promise.resolve(promise),
      new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms))
    ]);
  let loginRedirectTimer = null;
  function loginNextUrl() {
    if (videoSlug) return '/v/' + encodeURIComponent(videoSlug);
    if (videoId) return '/watch.html?id=' + encodeURIComponent(videoId);
    return location.pathname + location.search;
  }
  async function requireLogin(actionLabel) {
    try {
      // getSession safely returns an empty session for visitors. getUser() can
      // surface "Auth session missing" on a perfectly normal logged-out visit.
      const { data, error } = await withTimeout(
        db.auth.getSession(), 8000, 'Pemeriksaan status login terlalu lama. Periksa koneksi lalu coba lagi.'
      );
      if (error) throw error;
      const user = data?.session?.user || null;
      if (user) {
        currentUser = user;
        return user;
      }
      notice('Untuk ' + actionLabel + ', silakan login atau daftar terlebih dahulu.', 'info', 'fa-right-to-bracket');
      if (loginRedirectTimer) clearTimeout(loginRedirectTimer);
      loginRedirectTimer = setTimeout(() => {
        location.href = '/login.html?next=' + encodeURIComponent(loginNextUrl());
      }, 1400);
      return null;
    } catch (error) {
      notice('Status login gagal diperiksa: ' + (error?.message || 'koneksi Supabase bermasalah') + '.', 'error');
      return null;
    }
  }
  let noticeTimer = null;
  const notice = (message, kind = 'info', iconName = '') => {
    const el = $('socialNotice');
    if (!el) return;
    const lower = String(message || '').toLowerCase();
    const icon = iconName || (lower.includes('bagikan') || lower.includes('link video') ? 'fa-share-nodes' :
      lower.includes('komentar') ? 'fa-comment-dots' : lower.includes('favorit') ? 'fa-bookmark' :
      lower.includes('like') || lower.includes('disukai') ? 'fa-heart' :
      lower.includes('login') || lower.includes('daftar') ? 'fa-right-to-bracket' : 'fa-circle-check');
    el.replaceChildren();
    const glyph = document.createElement('span'); glyph.className = 'social-toast-icon';
    glyph.innerHTML = '<i class="fa-solid '+icon+'" aria-hidden="true"></i>';
    const copy = document.createElement('span'); copy.className = 'social-toast-copy';
    const text = document.createElement('span'); text.className = 'social-toast-message'; text.textContent = message;
    copy.append(text);
    const urlMatch = String(message || '').match(/https?:\/\/[^\s]+/);
    if (urlMatch && (lower.includes('bagikan') || lower.includes('link'))) {
      const link = document.createElement('a'); link.className = 'social-toast-link'; link.href = urlMatch[0]; link.textContent = urlMatch[0]; link.target = '_blank'; link.rel = 'noopener noreferrer'; copy.append(link);
    }
    el.append(glyph, copy);
    el.dataset.kind = kind; el.classList.add('is-visible');
    el.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    if (noticeTimer) clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => el.classList.remove('is-visible'), 3000);
  };
  const params = new URLSearchParams(location.search);
  let videoId = params.get('id');
  let videoSlug = params.get('slug');
  if (!videoSlug && !videoId) {
    const parts = location.pathname.split('/').filter(Boolean);
    if (parts.length === 1 && !parts[0].includes('.')) {
      try { videoSlug = decodeURIComponent(parts[0]); } catch (_) { videoSlug = parts[0]; }
    }
  }
  // Older links sometimes pass a slug through ?id=.
  if (videoId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(videoId)) {
    videoSlug = videoSlug || videoId;
    videoId = null;
  }

  const likeButton = $('likeVideoButton');
  const commentJumpButton = $('commentJumpButton');
  const shareButton = $('shareVideoButton');
  const shareCount = $('shareCount');
  const favoriteButton = $('favoriteVideoButton');
  const commentForm = $('commentForm');
  const commentInput = $('commentInput');
  const commentName = $('commentName');
  const commentList = $('commentList');
  const commentsSection = $('commentsSection');
  const relatedVideosButton = $('relatedVideosButton');
  let videoReady = false;

  function normalizeThumbnailUrl(raw) {
    const value = String(raw || '').trim(); if (!value) return '';
    try {
      const u = new URL(value, location.origin);
      const host = u.hostname.toLowerCase().replace(/^www\./, '');
      if (host === 'drive.google.com' || host === 'docs.google.com') {
        const id = (u.pathname.match(/\/file\/d\/([^/]+)/) || [])[1] || u.searchParams.get('id');
        if (id) return 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(id) + '&sz=w1200';
      }
      return u.href;
    } catch (_) { return ''; }
  }
  const downloadPageButton = $('downloadPageButton');
  const commentSubmitButton = commentForm?.querySelector('[type="submit"]');
  // A dash means the count could not be loaded; do not misrepresent an RPC failure as zero.
  for (const id of ['likeCount', 'commentCount', 'shareCount']) {
    const counter = $(id);
    if (counter) counter.textContent = '…';
  }
  // Keep controls responsive while lookup/database work is pending. Clicks now
  // produce an explicit notice instead of appearing to do nothing.
  if (likeButton) likeButton.disabled = false;
  if (favoriteButton) favoriteButton.disabled = false;
  if (commentSubmitButton) commentSubmitButton.disabled = false;

  function setCommentMessage(message, kind = 'info') {
    if (!commentList) return;
    commentList.replaceChildren();
    const item = document.createElement('p');
    item.className = kind === 'error' ? 'empty-comments comment-load-error' : 'empty-comments';
    item.textContent = message;
    commentList.append(item);
  }
  function setRelatedMessage(message, kind = 'error') {
    const grid = $('relatedVideoGrid');
    if (!grid) return;
    grid.replaceChildren();
    const item = document.createElement('p');
    item.className = kind === 'error' ? 'related-loading related-error' : 'related-loading';
    item.textContent = message;
    grid.append(item);
  }

  setTimeout(() => {
    if (commentList?.querySelector('.empty-comments')?.textContent?.includes('Memuat komentar')) {
      setCommentMessage('Komentar belum selesai dimuat. Periksa koneksi Supabase dan fungsi lookup video, lalu muat ulang.', 'error');
    }
    const grid = $('relatedVideoGrid');
    if (grid?.querySelector('.related-loading')?.textContent?.includes('Memuat video lainnya')) {
      setRelatedMessage('Video lainnya belum selesai dimuat. Periksa RPC jsvidey_catalog_videos di Supabase.', 'error');
    }
  }, 16000);
  downloadPageButton?.addEventListener('click', event => {
    // watch.js resolves the canonical video first. Reuse its result so a separate
    // social RPC failure cannot leave the Download anchor permanently blocked.
    if (!videoReady && window.__jsvideyVideoId) {
      videoId = window.__jsvideyVideoId;
      videoSlug = window.__jsvideyVideoSlug || videoSlug;
      videoReady = true;
      downloadPageButton.href = '/download.html?id=' + encodeURIComponent(videoId);
    }
    if (!videoReady) {
      event.preventDefault();
      notice('Tautan download sedang disiapkan. Tunggu sebentar lalu tekan lagi.');
    }
  });

  // These actions are local/browser actions and must remain responsive even if Supabase fails.
  commentJumpButton?.addEventListener('click', () => {
    notice('Komentar — tulis pendapatmu lalu tekan Kirim komentar.', 'info', 'fa-comment-dots');
    commentsSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    commentInput?.focus({ preventScroll: true });
  });
  relatedVideosButton?.addEventListener('click', () => {
    notice('Video lainnya — pilih video lain untuk ditonton.', 'info', 'fa-clapperboard');
    $('relatedVideosSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  shareButton?.addEventListener('click', async () => {
    const shareUrl = window.__jsvideyShareUrl || (videoSlug ? location.origin + '/v/' + encodeURIComponent(videoSlug) : (videoId ? location.origin + '/watch.html?id=' + encodeURIComponent(videoId) : location.href));
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        notice('Link siap dibagikan: ' + shareUrl, 'success', 'fa-share-nodes');
        recordShareEvent();
        return;
      }
      throw new Error('Clipboard API tidak tersedia');
    } catch (_) {
      // Fallback for browsers without Clipboard API / non-secure contexts.
      try {
        const field = document.createElement('textarea');
        field.value = shareUrl;
        field.setAttribute('readonly', '');
        field.style.position = 'fixed';
        field.style.left = '-9999px';
        document.body.append(field);
        field.select();
        field.setSelectionRange(0, field.value.length);
        const copied = document.execCommand('copy');
        field.remove();
        if (copied) { notice('Link siap dibagikan: ' + shareUrl, 'success', 'fa-share-nodes'); recordShareEvent(); }
        else notice('Link belum dapat disalin otomatis. Salin link ini: ' + shareUrl, 'error');
      } catch (_) {
        notice('Link belum dapat disalin otomatis. Salin link ini: ' + shareUrl, 'error');
      }
    }
  });

  if (!window.jsvideySupabaseClient && !window.supabase?.createClient) {
    const message = 'Koneksi database belum tersedia. Muat ulang halaman; jika tetap gagal, periksa pemuatan library Supabase.';
    notice(message, 'error');
    setCommentMessage('Komentar gagal dimuat. ' + message, 'error');
    setRelatedMessage('Video lainnya gagal dimuat. ' + message, 'error');
    for (const id of ['likeCount', 'commentCount', 'shareCount']) {
      const counter = $(id);
      if (counter) counter.textContent = '—';
    }
    likeButton?.addEventListener('click', () => notice('Like belum tersedia karena koneksi database gagal dimuat.', 'error'));
    favoriteButton?.addEventListener('click', () => notice('Favorit belum tersedia karena koneksi database gagal dimuat.', 'error'));
    commentForm?.addEventListener('submit', e => { e.preventDefault(); notice('Komentar belum dapat dikirim karena koneksi database gagal dimuat.', 'error'); });
    return;
  }

  const db = window.jsvideySupabaseClient || window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'sb-ordvxiydkxbtahjpseph-auth-token' }
  });

  async function recordShareEvent() {
    if (!videoId && window.__jsvideyVideoId) videoId = window.__jsvideyVideoId;
    if (!videoId) {
      try { await resolveVideo(); } catch (error) {
        console.warn('Cannot resolve video ID for share counter:', error);
        if (shareCount) shareCount.title = 'Link berhasil dibagikan, tetapi ID video belum tersedia untuk menghitung Bagikan.';
        return;
      }
    }
    if (!videoId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(videoId)) return;
    try {
      const { data, error } = await withTimeout(
        db.rpc('jsvidey_record_video_share', { p_video_id: videoId }),
        10000, 'Pencatatan Bagikan terlalu lama.'
      );
      if (error) throw error;
      if (shareCount && data != null) shareCount.textContent = String(data);
    } catch (error) {
      console.warn('Share count was not saved:', error);
      if (shareCount) shareCount.title = 'Link dibagikan, tetapi jumlah bagikan gagal disimpan.';
    }
  }

  async function loadSocialCounts() {
    if (!videoId && window.__jsvideyVideoId) videoId = window.__jsvideyVideoId;
    if (!videoId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(videoId)) return;
    try {
      const { data, error } = await withTimeout(
        db.rpc('jsvidey_get_video_social_counts', { p_video_ids: [videoId] }),
        12000, 'Statistik interaksi terlalu lama dimuat.'
      );
      if (error) throw error;
      if (!Array.isArray(data) || !data.length) throw new Error('RPC statistik tidak mengembalikan data video ini.');
      const row = data[0];
      const comments = $('commentCount');
      if (comments) comments.textContent = String(Number(row.comment_count ?? 0));
      if (shareCount) shareCount.textContent = String(Number(row.share_count ?? 0));
      const likes = $('likeCount');
      if (likes) likes.textContent = String(Number(row.like_count ?? 0));
    } catch (error) {
      console.error('Social count RPC failed:', error);
      if (shareCount && shareCount.textContent === '…') shareCount.textContent = '—';
      // Like and comment counts are also loaded through their own endpoints.
      if (shareCount) shareCount.title = 'Jumlah bagikan belum tersedia. Periksa migrasi js videy social di Supabase.';
    }
  }
  loadSocialCounts();
  // Load the public catalog independently: a broken embed lookup must not leave
  // the related-video placeholder spinning forever.
  loadRelatedVideos();
  window.addEventListener('jsvidey:video-ready', event => {
    if (event.detail?.id) videoId = event.detail.id;
    if (event.detail?.slug) videoSlug = event.detail.slug;
    loadSocialCounts();
    loadRelatedVideos();
  });
  let liked = false;
  let likeCount = 0;
  let favorited = false;
  let currentUser = null;
  let videoLoadError = null;

  function renderLikes() {
    const count = $('likeCount');
    if (count) count.textContent = String(likeCount);
    if (likeButton) {
      likeButton.classList.toggle('liked', liked);
      likeButton.setAttribute('aria-pressed', String(liked));
    }
  }
  function renderFavorite() {
    if (!favoriteButton) return;
    favoriteButton.classList.toggle('favorited', favorited);
    favoriteButton.setAttribute('aria-pressed', String(favorited));
    favoriteButton.innerHTML = favorited
      ? '<i class="fa-solid fa-bookmark"></i><span>Favorit</span>'
      : '<i class="fa-regular fa-bookmark"></i><span>Favorit</span>';
  }
  async function requireVideo() {
    if (videoReady) return;
    if (videoLoadError) throw videoLoadError;
    throw new Error('Data video masih dimuat. Coba lagi sebentar.');
  }
  async function resolveVideo() {
    if (window.__jsvideyVideoId) {
      videoId = window.__jsvideyVideoId;
      videoSlug = window.__jsvideyVideoSlug || videoSlug;
      window.__jsvideyShareUrl = window.__jsvideyShareUrl || (videoSlug ? location.origin + '/v/' + encodeURIComponent(videoSlug) : location.origin + '/watch.html?id=' + encodeURIComponent(videoId));
      if (downloadPageButton) downloadPageButton.href = '/download.html?id=' + encodeURIComponent(videoId);
      videoReady = true;
      return;
    }
    if (!videoSlug && !videoId) throw new Error('Link video tidak ditemukan.');
    const rpcName = videoSlug ? 'get_public_embed_video_by_slug' : 'get_public_embed_video';
    const args = videoSlug ? { p_slug: videoSlug } : { p_video_id: videoId };
    const { data, error } = await withTimeout(
      db.rpc(rpcName, args), 12000,
      'Pencarian video melewati batas 12 detik. Periksa fungsi ' + rpcName + ' di Supabase.'
    );
    if (error) throw new Error(error.message || 'Lookup video gagal. Pastikan SQL lookup video sudah diterapkan.');
    const record = Array.isArray(data) ? data[0] : data;
    if (!record?.id || record.status !== 'published') {
      throw new Error('Video tidak ditemukan, belum dipublikasikan, atau memerlukan login.');
    }
    videoId = record.id;
    videoSlug = record.slug || videoSlug || null;
    window.__jsvideyVideoId = videoId;
    window.__jsvideyVideoSlug = videoSlug;
    window.__jsvideyShareUrl = videoSlug
      ? location.origin + '/v/' + encodeURIComponent(videoSlug)
      : location.origin + '/watch.html?id=' + encodeURIComponent(videoId);
    if (downloadPageButton) downloadPageButton.href = '/download.html?id=' + encodeURIComponent(videoId);
    videoReady = true;
  }

  window.addEventListener('jsvidey:video-ready', event => {
    const id = event.detail?.id;
    if (!id) return;
    videoId = id;
    videoSlug = event.detail?.slug || videoSlug;
    videoReady = true;
    if (downloadPageButton) downloadPageButton.href = '/download.html?id=' + encodeURIComponent(videoId);
    if (likeButton) likeButton.disabled = false;
    if (favoriteButton) favoriteButton.disabled = false;
    if (commentSubmitButton) commentSubmitButton.disabled = false;
  });

  async function loadLikes() {
    const { data: authData, error: authError } = await withTimeout(
      db.auth.getUser(), 8000, 'Pemeriksaan login terlalu lama.'
    );
    if (authError) throw authError;
    currentUser = authData?.user || null;
    const { data, error } = await withTimeout(
      db.rpc('get_video_like_state', { p_video_id: videoId }),
      12000, 'Statistik Like terlalu lama dimuat.'
    );
    if (error) throw error;
    const state = Array.isArray(data) ? data[0] : data;
    likeCount = Number(state?.like_count || 0);
    liked = Boolean(currentUser && state?.liked);
    renderLikes();
  }

  async function loadComments() {
    const request = db.from('video_comments')
      .select('id,display_name,body,created_at')
      .eq('video_id', videoId)
      .order('created_at', { ascending: false })
      .limit(100);
    const { data, error } = await withTimeout(
      request, 12000, 'Permintaan komentar terlalu lama. Periksa koneksi dan kebijakan akses Supabase.'
    );
    if (error) throw error;
    const rows = data || [];
    const count = $('commentCount');
    if (count) count.textContent = String(rows.length);
    if (!commentList) return;
    commentList.replaceChildren();
    if (!rows.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-comments';
      empty.textContent = 'Belum ada komentar. Jadilah yang pertama!';
      commentList.append(empty);
      return;
    }
    for (const comment of rows) {
      const article = document.createElement('article');
      article.className = 'comment-item';
      const meta = document.createElement('div');
      meta.className = 'comment-meta';
      const date = comment.created_at ? new Date(comment.created_at).toLocaleString('id-ID') : '';
      meta.textContent = (comment.display_name || 'Pengunjung') + (date ? ' • ' + date : '');
      const body = document.createElement('p');
      body.textContent = comment.body || '';
      article.append(meta, body);
      commentList.append(article);
    }
  }

  async function loadFavorite() {
    const { data, error } = await db.auth.getUser();
    if (error) throw error;
    currentUser = data?.user || null;
    if (!currentUser) {
      favorited = false;
      renderFavorite();
      return;
    }
    const result = await withTimeout(db.from('video_favorites').select('video_id')
      .eq('user_id', currentUser.id).eq('video_id', videoId).maybeSingle(),
      12000, 'Status Favorit terlalu lama dimuat.');
    if (result.error) throw result.error;
    favorited = Boolean(result.data);
    renderFavorite();
  }

  likeButton?.addEventListener('click', async () => {
    likeButton.disabled = true;
    try {
      const user = await requireLogin('memberi Like');
      if (!user) return;
      await requireVideo();
      const nextLiked = !liked;
      const { data, error } = await withTimeout(db.rpc('set_video_like', {
        p_video_id: videoId,
        p_liked: nextLiked
      }), 12000, 'Permintaan Like terlalu lama.');
      if (error) throw error;
      const state = Array.isArray(data) ? data[0] : data;
      if (!state || typeof state.liked !== 'boolean') {
        throw new Error('Respons RPC Like tidak sesuai. Pastikan migrasi sosial terbaru sudah diterapkan.');
      }
      likeCount = Number(state.like_count || 0);
      liked = state.liked;
      renderLikes();
      notice(liked ? 'Video disukai.' : 'Like dibatalkan.');
    } catch (error) {
      notice(error?.message ? 'Like gagal: ' + error.message : 'Like gagal. Periksa login dan pengaturan database.', 'error');
      console.error('Like action failed:', error);
    } finally {
      likeButton.disabled = false;
    }
  });

  favoriteButton?.addEventListener('click', async () => {
    favoriteButton.disabled = true;
    try {
      const user = await requireLogin('menyimpan video ke Favorit');
      if (!user) return;
      await requireVideo();
      if (favorited) {
        const { error } = await withTimeout(db.from('video_favorites').delete().eq('user_id', user.id).eq('video_id', videoId), 12000, 'Penghapusan Favorit terlalu lama.');
        if (error) throw error;
        favorited = false;
        notice('Video dihapus dari Favorit.', 'success', 'fa-bookmark');
      } else {
        const { error } = await withTimeout(db.from('video_favorites').insert({ user_id: user.id, video_id: videoId }), 12000, 'Penyimpanan Favorit terlalu lama.');
        if (error && error.code !== '23505') throw error;
        favorited = true;
        notice('Video ditambahkan ke Favorit.', 'success', 'fa-bookmark');
      }
      renderFavorite();
    } catch (error) {
      notice(error?.message ? 'Favorit gagal: ' + error.message : 'Favorit gagal. Periksa login dan pengaturan database.', 'error');
      console.error('Favorite action failed:', error);
    } finally {
      favoriteButton.disabled = false;
    }
  });

  commentForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const body = commentInput?.value.trim() || '';
    const displayName = commentName?.value.trim() || (currentUser?.email || 'Member').split('@')[0];
    if (!body) {
      commentInput?.focus();
      return;
    }
    const submitButton = event.submitter || commentForm.querySelector('[type="submit"]');
    if (submitButton) submitButton.disabled = true;
    try {
      const user = await requireLogin('mengirim komentar');
      if (!user) return;
      await requireVideo();
      const { error } = await withTimeout(db.from('video_comments').insert({
        video_id: videoId,
        visitor_id: user.id,
        display_name: displayName.slice(0, 40) || 'Member',
        body: body.slice(0, 1000)
      }), 12000, 'Pengiriman komentar terlalu lama.');
      if (error) throw error;
      commentInput.value = '';
      notice('Komentar berhasil dikirim.', 'success', 'fa-comment-dots');
      await loadComments();
    } catch (error) {
      notice('Komentar gagal: ' + (error?.message || 'Periksa login, tabel video_comments, dan izin Supabase.'), 'error');
      console.error('Comment submit failed:', error);
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });


  function safeText(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  async function loadVideoMetrics() {
    const set = (id, value) => { const el = $(id); if (el) el.textContent = Number(value || 0).toLocaleString('id-ID'); };
    if (!videoId) return;
    const id = videoId;
    const [viewsResult, socialResult] = await Promise.allSettled([
      withTimeout(db.rpc('jsvidey_get_video_view_counts', { p_video_ids: [id] }), 10000, 'Total view terlalu lama dimuat.'),
      withTimeout(db.rpc('jsvidey_get_video_social_counts', { p_video_ids: [id] }), 10000, 'Statistik sosial terlalu lama dimuat.')
    ]);
    if (viewsResult.status === 'fulfilled' && !viewsResult.value.error) {
      const row = (viewsResult.value.data || []).find(v => String(v.video_id) === String(id));
      set('watchTotalViews', row?.view_count || 0);
    } else { const el = $('watchTotalViews'); if (el) el.textContent = '—'; }
    if (socialResult.status === 'fulfilled' && !socialResult.value.error) {
      const row = (socialResult.value.data || []).find(v => String(v.video_id) === String(id)) || {};
      set('watchTotalLikes', row.like_count);
      set('watchTotalComments', row.comment_count);
      set('watchTotalShares', row.share_count);
    } else {
      ['watchTotalLikes','watchTotalComments','watchTotalShares'].forEach(id => { const el=$(id); if(el)el.textContent='—'; });
    }
  }

  async function loadRelatedVideos() {
    const grid = $('relatedVideoGrid');
    if (!grid) return;
    try {
      const { data, error } = await withTimeout(
        db.rpc('jsvidey_catalog_videos'), 12000,
        'Katalog video melewati batas 12 detik. Pastikan RPC jsvidey_catalog_videos tersedia di Supabase.'
      );
      if (error) throw error;
      const rows = (data || []).filter(row =>
        String(row.id) !== String(videoId) && (!videoSlug || row.slug !== videoSlug)
      );
      if (!rows.length) {
        grid.innerHTML = '<p class="related-loading">Belum ada video lainnya.</p>';
        return;
      }
      const pageSize = 12;
      let currentPage = 1;
      const totalPages = Math.ceil(rows.length / pageSize);
      async function renderPage(page) {
        currentPage = Math.max(1, Math.min(totalPages, page));
        const start = (currentPage - 1) * pageSize;
        const pageRows = rows.slice(start, start + pageSize);
        const ids = pageRows.map(row => row.id).filter(Boolean);
        let socialMap = new Map(), viewMap = new Map();
        grid.replaceChildren();
        const cards = [];
        for (const row of pageRows) {
          const href = row.slug ? '/v/' + encodeURIComponent(row.slug) : '/watch.html?id=' + encodeURIComponent(row.id);
          const card = document.createElement('a');
          card.className = 'related-card'; card.href = href;
          const thumb = document.createElement('div'); thumb.className = 'related-thumb';
          const thumbnailUrl = normalizeThumbnailUrl(row.thumbnail_url || row.thumbnail || row.thumbnailUrl || row.thumbnail_url_public || '');
          if (thumbnailUrl) {
            const img = document.createElement('img'); img.src = thumbnailUrl;
            img.alt = row.title ? 'Thumbnail ' + row.title : 'Thumbnail video'; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer';
            img.onerror = () => { img.remove(); if (!thumb.querySelector('.related-placeholder')) thumb.innerHTML = '<span class="related-placeholder"><i class="fa-solid fa-circle-play"></i></span>'; };
            thumb.append(img);
          } else thumb.innerHTML = '<span class="related-placeholder"><i class="fa-solid fa-circle-play"></i></span>';
          const copy = document.createElement('div'); copy.className = 'related-copy';
          const title = document.createElement('div'); title.className = 'related-title'; title.textContent = row.title || 'Video tanpa judul';
          const stats = document.createElement('div'); stats.className = 'related-stats';
          [['view','View'],['like','Like'],['comment','Komentar'],['share','Share']].forEach(([key,label]) => {
            const span = document.createElement('span'); span.dataset.stat = key;
            const icons = {view:'fa-eye',like:'fa-heart',comment:'fa-comment',share:'fa-share-nodes'};
            const icon = document.createElement('i'); icon.className = 'fa-solid ' + icons[key]; icon.setAttribute('aria-hidden','true');
            span.append(icon, document.createTextNode(' … ' + label)); stats.append(span);
          });
          copy.append(title, stats); card.append(thumb, copy); grid.append(card); cards.push(card);
        }
        try {
          const [social, views] = await Promise.all([
            withTimeout(db.rpc('jsvidey_get_video_social_counts', { p_video_ids: ids }), 10000, 'Statistik sosial terlalu lama dimuat.'),
            withTimeout(db.rpc('jsvidey_get_video_view_counts', { p_video_ids: ids }), 10000, 'Total view terlalu lama dimuat.')
          ]);
          if (!social.error) socialMap = new Map((social.data || []).map(row => [String(row.video_id), row]));
          if (!views.error) viewMap = new Map((views.data || []).map(row => [String(row.video_id), Number(row.view_count || 0)]));
        } catch (err) { console.warn('Related video counters unavailable:', err); }
        pageRows.forEach((row, index) => {
          const card = cards[index]; if (!card) return;
          const social = socialMap.get(String(row.id)) || {};
          const stats = card.querySelectorAll('[data-stat]');
          stats.forEach(el => {
            const key = el.dataset.stat;
            const count = key === 'view' ? viewMap.get(String(row.id)) : key === 'like' ? social.like_count : key === 'comment' ? social.comment_count : social.share_count;
            const label = key === 'view' ? 'View' : key === 'like' ? 'Like' : key === 'comment' ? 'Komentar' : 'Share';
            const icon = el.querySelector('i');
            el.replaceChildren(icon, document.createTextNode(' ' + Number(count || 0).toLocaleString('id-ID') + ' ' + label));
          });
        });
        if (totalPages > 1) {
          const nav = document.createElement('nav'); nav.className = 'related-pagination'; nav.setAttribute('aria-label','Halaman video lainnya');
          const prev = document.createElement('button'); prev.type='button'; prev.className='related-page-btn'; prev.textContent='‹'; prev.disabled=currentPage===1; prev.setAttribute('aria-label','Halaman sebelumnya'); prev.addEventListener('click',()=>{renderPage(currentPage-1);$('relatedVideosSection')?.scrollIntoView({behavior:'smooth',block:'start'});}); nav.append(prev);
          const maxButtons = 5;
          let from = Math.max(1, currentPage - Math.floor(maxButtons/2));
          let to = Math.min(totalPages, from + maxButtons - 1); from = Math.max(1, to - maxButtons + 1);
          for(let n=from;n<=to;n++){const b=document.createElement('button');b.type='button';b.className='related-page-btn';b.textContent=String(n);if(n===currentPage)b.setAttribute('aria-current','page');b.addEventListener('click',()=>{renderPage(n);$('relatedVideosSection')?.scrollIntoView({behavior:'smooth',block:'start'});});nav.append(b);}
          const next = document.createElement('button'); next.type='button'; next.className='related-page-btn'; next.textContent='›'; next.disabled=currentPage===totalPages; next.setAttribute('aria-label','Halaman berikutnya'); next.addEventListener('click',()=>{renderPage(currentPage+1);$('relatedVideosSection')?.scrollIntoView({behavior:'smooth',block:'start'});}); nav.append(next);
          const label = document.createElement('span'); label.className='related-loading'; label.textContent=`Halaman ${currentPage} dari ${totalPages}`; nav.append(label); grid.append(nav);
        }
      }
      await renderPage(1);
    } catch (error) {
      console.error('Related videos failed to load:', error);
      const detail = error?.message || 'Periksa migrasi SQL katalog dan izin akses Supabase.';
      grid.innerHTML = '<p class="related-loading related-error">Video lainnya gagal dimuat. ' + safeText(detail) + '</p>';
    }
  }

  (async () => {
    try {
      await resolveVideo();
      if (likeButton) likeButton.disabled = false;
      if (favoriteButton) favoriteButton.disabled = false;
      if (commentSubmitButton) commentSubmitButton.disabled = false;
      const results = await Promise.allSettled([loadLikes(), loadComments(), loadFavorite(), loadVideoMetrics()]);
      const failed = results.filter(result => result.status === 'rejected');
      if (failed.length) {
        console.error('Some social features could not initialize:', failed.map(result => result.reason));
        const commentFailure = results[1];
        if (results[0]?.status === 'rejected') {
          const counter = $('likeCount');
          if (counter && counter.textContent === '…') counter.textContent = '—';
        }
        if (commentFailure?.status === 'rejected') {
          const counter = $('commentCount');
          if (counter && counter.textContent === '…') counter.textContent = '—';
          setCommentMessage('Komentar gagal dimuat. ' + (commentFailure.reason?.message || 'Periksa izin tabel video_comments dan koneksi Supabase.'), 'error');
        }
        notice('Sebagian interaksi belum aktif. Periksa migrasi SQL sosial dan kebijakan akses Supabase.', 'error');
      }
    } catch (error) {
      videoLoadError = error;
      loadRelatedVideos();
      console.error('Social video lookup failed:', error);
      const detail = error?.message || 'Interaksi video gagal dimuat.';
      notice(detail, 'error');
      setCommentMessage('Komentar belum dapat dimuat: ' + detail, 'error');
      setRelatedMessage('Video lainnya belum dapat dimuat. ' + detail, 'error');
      if (window.__jsvideyVideoId) {
        videoId = window.__jsvideyVideoId;
        videoSlug = window.__jsvideyVideoSlug || videoSlug;
        videoReady = true;
        if (likeButton) likeButton.disabled = false;
        if (favoriteButton) favoriteButton.disabled = false;
        if (commentSubmitButton) commentSubmitButton.disabled = false;
      } else {
        // Keep controls clickable so they can explain what failed instead of silently doing nothing.
        if (likeButton) likeButton.disabled = false;
        if (favoriteButton) favoriteButton.disabled = false;
        if (commentSubmitButton) commentSubmitButton.disabled = false;
      }
    }
  })();
})();
