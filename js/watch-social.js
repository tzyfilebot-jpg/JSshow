const SUPABASE_URL = 'https://ordvxiydkxbtahjpseph.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yZHZ4aXlka3hidGFoanBzZXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2MDM3MjMsImV4cCI6MjEwODE3OTcyM30.PCruI7EeLyagV_PMyCd57s3N9oYcL41k-fEgwE8G60E';

(() => {
  const $ = id => document.getElementById(id);
  const notice = message => {
    const el = $('socialNotice');
    if (el) el.textContent = message;
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
  const favoriteButton = $('favoriteVideoButton');
  const commentForm = $('commentForm');
  const commentInput = $('commentInput');
  const commentName = $('commentName');
  const commentList = $('commentList');
  const commentsSection = $('commentsSection');
  let videoReady = false;
  const downloadPageButton = $('downloadPageButton');
  const commentSubmitButton = commentForm?.querySelector('[type="submit"]');
  // Disable database-backed actions until the video ID is resolved.
  if (likeButton) likeButton.disabled = true;
  if (favoriteButton) favoriteButton.disabled = true;
  if (commentSubmitButton) commentSubmitButton.disabled = true;
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
    commentsSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    commentInput?.focus({ preventScroll: true });
  });
  shareButton?.addEventListener('click', async () => {
    const shareUrl = window.__jsvideyShareUrl || (videoSlug ? location.origin + '/v/' + encodeURIComponent(videoSlug) : (videoId ? location.origin + '/watch.html?id=' + encodeURIComponent(videoId) : location.href));
    try {
      if (navigator.share) {
        await navigator.share({ title: document.title, url: shareUrl });
        notice('Link video berhasil dibagikan.');
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        notice('Link video berhasil disalin.');
        return;
      }
      throw new Error('Clipboard tidak tersedia');
    } catch (error) {
      if (error?.name === 'AbortError') return;
      // Fallback for browsers without Clipboard API / non-secure contexts.
      try {
        const field = document.createElement('textarea');
        field.value = shareUrl;
        field.setAttribute('readonly', '');
        field.style.position = 'fixed';
        field.style.opacity = '0';
        document.body.append(field);
        field.select();
        const copied = document.execCommand('copy');
        field.remove();
        if (copied) notice('Link video berhasil disalin.');
        else notice('Salin link video ini: ' + shareUrl);
      } catch (_) {
        notice('Salin link video ini: ' + shareUrl);
      }
    }
  });

  if (!window.supabase?.createClient) {
    notice('Library database gagal dimuat. Bagikan dan navigasi komentar tetap tersedia; fitur database perlu koneksi Supabase.');
    if (likeButton) likeButton.disabled = true;
    if (favoriteButton) favoriteButton.disabled = true;
    if (commentForm) commentForm.addEventListener('submit', e => { e.preventDefault(); notice('Komentar belum dapat dikirim karena koneksi database tidak tersedia.'); });
    return;
  }

  const db = window.jsvideySupabaseClient || window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'sb-ordvxiydkxbtahjpseph-auth-token' }
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
    const { data, error } = await db.rpc(rpcName, args);
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
    const { data: authData, error: authError } = await db.auth.getUser();
    if (authError) throw authError;
    currentUser = authData?.user || null;
    const { data, error } = await db.rpc('get_video_like_state', { p_video_id: videoId });
    if (error) throw error;
    const state = Array.isArray(data) ? data[0] : data;
    likeCount = Number(state?.like_count || 0);
    liked = Boolean(currentUser && state?.liked);
    renderLikes();
  }

  async function loadComments() {
    const { data, error } = await db.from('video_comments')
      .select('id,display_name,body,created_at')
      .eq('video_id', videoId)
      .order('created_at', { ascending: false })
      .limit(100);
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
    const result = await db.from('video_favorites').select('video_id')
      .eq('user_id', currentUser.id).eq('video_id', videoId).maybeSingle();
    if (result.error) throw result.error;
    favorited = Boolean(result.data);
    renderFavorite();
  }

  likeButton?.addEventListener('click', async () => {
    likeButton.disabled = true;
    try {
      await requireVideo();
      const { data: authData, error: authError } = await db.auth.getUser();
      if (authError) throw authError;
      const user = authData?.user;
      if (!user) {
        notice('Silakan login terlebih dahulu untuk menggunakan Like.');
        location.href = '/login.html?next=' + encodeURIComponent(videoSlug ? '/v/' + videoSlug : '/watch.html?id=' + videoId);
        return;
      }
      const nextLiked = !liked;
      const { data, error } = await db.rpc('set_video_like', {
        p_video_id: videoId,
        p_liked: nextLiked
      });
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
      notice(error?.message ? 'Like gagal: ' + error.message : 'Like gagal. Login dan pastikan sql/fix_social_interactions_safe.sql sudah diterapkan di Supabase.');
      console.error('Like action failed:', error);
    } finally {
      likeButton.disabled = false;
    }
  });

  favoriteButton?.addEventListener('click', async () => {
    favoriteButton.disabled = true;
    try {
      await requireVideo();
      const { data, error: authError } = await db.auth.getUser();
      if (authError) throw authError;
      const user = data?.user;
      if (!user) {
        notice('Silakan login terlebih dahulu untuk menyimpan Favorit.');
        location.href = '/login.html?next=' + encodeURIComponent(videoSlug ? '/v/' + videoSlug : '/watch.html?id=' + videoId);
        return;
      }
      if (favorited) {
        const { error } = await db.from('video_favorites').delete().eq('user_id', user.id).eq('video_id', videoId);
        if (error) throw error;
        favorited = false;
        notice('Video dihapus dari My Favorit.');
      } else {
        const { error } = await db.from('video_favorites').insert({ user_id: user.id, video_id: videoId });
        if (error && error.code !== '23505') throw error;
        favorited = true;
        notice('Video ditambahkan ke My Favorit.');
      }
      renderFavorite();
    } catch (error) {
      notice(error?.message ? 'Favorit gagal: ' + error.message : 'Favorit gagal. Login dan pastikan sql/fix_social_interactions_safe.sql sudah diterapkan di Supabase.');
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
      await requireVideo();
      const { data, error: authError } = await db.auth.getUser();
      if (authError) throw authError;
      const user = data?.user;
      if (!user) {
        location.href = '/login.html?next=' + encodeURIComponent(videoSlug ? '/v/' + videoSlug : '/watch.html?id=' + videoId);
        return;
      }
      const { error } = await db.from('video_comments').insert({
        video_id: videoId,
        visitor_id: user.id,
        display_name: displayName.slice(0, 40) || 'Member',
        body: body.slice(0, 1000)
      });
      if (error) throw error;
      commentInput.value = '';
      notice('Komentar berhasil disimpan.');
      await loadComments();
    } catch (error) {
      notice('Komentar gagal: ' + (error?.message || 'Periksa login, tabel video_comments, dan izin Supabase.'));
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

  async function loadRelatedVideos() {
    const grid = $('relatedVideoGrid');
    if (!grid) return;
    try {
      // Catalog query only reads the public fields granted by the catalog migration.
      const { data, error } = await db.from('videos')
        .select('id,title,slug,thumbnail_url,created_at,audience,status')
        .eq('status', 'published')
        .eq('audience', 'public')
        .order('created_at', { ascending: false })
        .limit(12);
      if (error) throw error;
      const rows = (data || []).filter(row => row.id !== videoId);
      if (!rows.length) {
        grid.innerHTML = '<p class="related-loading">Belum ada video lainnya.</p>';
        return;
      }

      const ids = rows.map(row => row.id);
      let counts = new Map();
      const { data: countRows, error: countError } = await db.rpc('jsvidey_get_video_social_counts', {
        p_video_ids: ids
      });
      if (!countError && Array.isArray(countRows)) {
        counts = new Map(countRows.map(row => [row.video_id, row]));
      } else {
        console.warn('Related video counts RPC unavailable. Apply sql/jsvidey_watch_related_counts.sql', countError);
      }

      grid.replaceChildren();
      for (const row of rows) {
        const stats = counts.get(row.id) || {};
        const href = row.slug
          ? '/v/' + encodeURIComponent(row.slug)
          : '/watch.html?id=' + encodeURIComponent(row.id);
        const card = document.createElement('a');
        card.className = 'related-card';
        card.href = href;
        const thumb = document.createElement('div');
        thumb.className = 'related-thumb';
        if (row.thumbnail_url) {
          const img = document.createElement('img');
          img.src = row.thumbnail_url;
          img.alt = '';
          img.loading = 'lazy';
          img.referrerPolicy = 'no-referrer';
          thumb.append(img);
        } else {
          thumb.innerHTML = '<span class="related-placeholder"><i class="fa-solid fa-circle-play"></i></span>';
        }
        const copy = document.createElement('div');
        copy.className = 'related-copy';
        const title = document.createElement('div');
        title.className = 'related-title';
        title.textContent = row.title || 'Video tanpa judul';
        const statLine = document.createElement('div');
        statLine.className = 'related-stats';
        const like = document.createElement('span');
        like.innerHTML = '<i class="fa-solid fa-heart" aria-hidden="true"></i> ' + Number(stats.like_count || 0) + ' Like';
        const comments = document.createElement('span');
        comments.innerHTML = '<i class="fa-solid fa-comment" aria-hidden="true"></i> ' + Number(stats.comment_count || 0) + ' Komentar';
        const favorites = document.createElement('span');
        favorites.innerHTML = '<i class="fa-solid fa-bookmark" aria-hidden="true"></i> ' + Number(stats.favorite_count || 0) + ' Favorit';
        statLine.append(like, comments, favorites);
        copy.append(title, statLine);
        card.append(thumb, copy);
        grid.append(card);
      }
    } catch (error) {
      console.error('Related videos failed to load:', error);
      grid.innerHTML = '<p class="related-loading">Video lainnya belum dapat dimuat. Periksa izin katalog video di Supabase.</p>';
    }
  }

  (async () => {
    try {
      await resolveVideo();
      loadRelatedVideos();
      if (likeButton) likeButton.disabled = false;
      if (favoriteButton) favoriteButton.disabled = false;
      if (commentSubmitButton) commentSubmitButton.disabled = false;
      const results = await Promise.allSettled([loadLikes(), loadComments(), loadFavorite()]);
      const failed = results.filter(result => result.status === 'rejected');
      if (failed.length) {
        console.error('Some social features could not initialize:', failed.map(result => result.reason));
        notice('Sebagian interaksi belum aktif. Periksa migrasi SQL sosial dan kebijakan akses Supabase.');
      }
    } catch (error) {
      videoLoadError = error;
      loadRelatedVideos();
      console.error('Social video lookup failed:', error);
      notice(error.message || 'Interaksi video gagal dimuat.');
      if (window.__jsvideyVideoId) {
        videoId = window.__jsvideyVideoId;
        videoSlug = window.__jsvideyVideoSlug || videoSlug;
        videoReady = true;
        if (likeButton) likeButton.disabled = false;
        if (favoriteButton) favoriteButton.disabled = false;
        if (commentSubmitButton) commentSubmitButton.disabled = false;
      } else {
        if (likeButton) likeButton.disabled = true;
        if (favoriteButton) favoriteButton.disabled = true;
        if (commentSubmitButton) commentSubmitButton.disabled = true;
      }
    }
  })();
})();
