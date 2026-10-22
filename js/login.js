(() => {
  const pageTranslations = {"Masuk ke Jsvidey": "Log in to Jsvidey", "Lanjutkan perjalanan kreatormu.": "Continue your creator journey.", "Kata sandi": "Password", "Masukkan kata sandi": "Enter your password", "Tampilkan kata sandi": "Show password", "Masuk": "Login", "Belum punya akun?": "Don’t have an account?", "Daftar": "Register", "Video kamu.": "Your videos.", "Ruang kamu.": "Your space.", "Upload, share, pantau performa, dan kelola konten dari satu tempat.": "Upload, share, track performance, and manage content in one place.", "Demo tampilan: login ini menyimpan status lokal di browser, belum terhubung ke server autentikasi.": "UI demo: this login stores a local browser session and is not connected to server authentication.", "Isi email dan kata sandi terlebih dahulu.": "Enter your email and password first.", "Email tidak ditemukan pada data demo di browser ini. Silakan daftar terlebih dahulu.": "Email not found in this browser demo. Please register first.", "Kata sandi tidak sesuai dengan data demo.": "Password does not match the demo account.", "Berhasil masuk. Membuka beranda...": "Login successful. Opening home..."};
  const applyPageLanguage = (lang) => {
    const reverse = Object.fromEntries(Object.entries(pageTranslations).map(([id,en])=>[en,id]));
    const map = lang === 'en' ? pageTranslations : reverse;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes=[]; while(walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => { const original=node.nodeValue; const key=original.trim(); if(map[key]) node.nodeValue=original.replace(key,map[key]); });
    document.querySelectorAll('input[placeholder],textarea[placeholder]').forEach(el=>{ const val=el.getAttribute('placeholder'); const next=map[val]; if(next)el.setAttribute('placeholder',next); });
    document.querySelectorAll('[aria-label]').forEach(el=>{ const val=el.getAttribute('aria-label'); if(map[val])el.setAttribute('aria-label',map[val]); });
  };
  let currentPageLang='id'; try{currentPageLang=localStorage.getItem('jsvidey-language')||'id'}catch(_){}
  applyPageLanguage(currentPageLang);
  document.addEventListener('jsvidey:language-change', e => applyPageLanguage(e.detail.lang));

  document.querySelectorAll("[data-reveal]").forEach(button => button.addEventListener("click", () => {
    const input = document.getElementById(button.dataset.reveal);
    if (!input) return;
    input.type = input.type === "password" ? "text" : "password";
    button.innerHTML = input.type === "password" ? '<i class="fa-regular fa-eye"></i>' : '<i class="fa-regular fa-eye-slash"></i>';
  }));
  // Paste the Supabase Project URL and anon/publishable key from Project Settings > API.
  const SUPABASE_URL = "https://ordvxiydkxbtahjpseph.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yZHZ4aXlka3hidGFoanBzZXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2MDM3MjMsImV4cCI6MjEwODE3OTcyM30.PCruI7EeLyagV_PMyCd57s3N9oYcL41k-fEgwE8G60E";
  const form = document.getElementById("loginForm");
  // Reuse one Supabase client per page and the same storage key on every page.
  // This avoids auth-storage races between independently-created clients on mobile.
  const getSupabaseClient = () => {
    if (window.jsvideySupabaseClient) return window.jsvideySupabaseClient;
    if (!window.supabase?.createClient) throw new Error("Library Supabase gagal dimuat. Periksa koneksi internet.");
    window.jsvideySupabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storageKey: "sb-ordvxiydkxbtahjpseph-auth-token",
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
    return window.jsvideySupabaseClient;
  };
  const showMessage = (message, success = false) => {
    const el = document.getElementById("loginMessage");
    el.className = success ? "form-message success" : "form-message";
    el.textContent = message;
  };
  form?.addEventListener("submit", async event => {
    event.preventDefault();
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    const lang = localStorage.getItem("jsvidey-language") || "id";
    if (!email || !password) return showMessage(lang === "en" ? "Enter your email and password." : "Isi email dan kata sandi terlebih dahulu.");
    if (SUPABASE_URL.includes("YOUR_") || SUPABASE_ANON_KEY.includes("YOUR_")) {
      return showMessage(lang === "en" ? "Supabase is not configured yet. Add your Project URL and anon key in js/login.js." : "Supabase belum dikonfigurasi. Isi Project URL dan anon key di js/login.js.");
    }
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      const supabaseClient = getSupabaseClient();
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const user = data.user;
      const { data: profile, error: profileError } = await supabaseClient.from("profiles").select("username, display_name").eq("id", user.id).maybeSingle();
      if (profileError) console.warn("Could not load profile after login:", profileError.message);
      // Confirm the authenticated session is available before navigating away.
      const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
      if (sessionError || !sessionData.session) throw new Error("Login berhasil, tetapi sesi tidak tersimpan. Coba login lagi dan pastikan Safari mengizinkan penyimpanan situs.");
      try { localStorage.setItem("jsvidey-session", JSON.stringify({ id: user.id, name: profile?.display_name || profile?.username || user.user_metadata?.username || email.split("@")[0], username: profile?.username || user.user_metadata?.username || "", email: user.email, at: Date.now() })); } catch (_) { /* Supabase session remains the source of truth. */ }
      showMessage(lang === "en" ? "Login successful. Opening home..." : "Berhasil masuk. Membuka beranda...", true);
      const params = new URLSearchParams(location.search);
      const requested = params.get("next");
      const allowed = new Set(["dashboard.html", "my-file.html", "upload.html", "download.html", "leaderboard.html", "withdraw.html", "settings.html", "top-10-videos.html", "my-favorites.html"]);
      let destination = "/dashboard.html";
      if (requested) {
        try {
          const nextUrl = new URL(requested, location.origin);
          const file = nextUrl.pathname.split("/").pop();
          if (nextUrl.origin === location.origin && allowed.has(file)) destination = "/" + file + nextUrl.search + nextUrl.hash;
        } catch (_) { /* Ignore malformed or external redirect targets. */ }
      }
      setTimeout(() => location.replace(destination), 500);
    } catch (error) {
      const message = error?.message || "Login failed.";
      showMessage(lang === "en" ? (message.includes("Invalid login credentials") ? "Email or password is incorrect." : `Login failed: ${message}`) : (message.includes("Invalid login credentials") ? "Email atau kata sandi salah." : `Gagal masuk: ${message}`));
    } finally { submit.disabled = false; }
  });
})();
