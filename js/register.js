(() => {
  const pageTranslations = {"Buat akun Jsvidey": "Create your Jsvidey account", "Mulai bangun ruang video dan komunitasmu.": "Start building your video space and community.", "Nama pengguna": "Username", "Kata sandi": "Password", "Minimal 8 karakter": "At least 8 characters", "Saya menyetujui ketentuan penggunaan.": "I agree to the terms of use.", "Buat Akun": "Create Account", "Sudah punya akun?": "Already have an account?", "Masuk": "Login", "Demo tampilan: data akun disimpan di browser ini saja, belum menjadi akun server.": "UI demo: account data is stored only in this browser and is not a server account.", "Buat. Bagikan.": "Create. Share.", "Tumbuh bersama.": "Grow together.", "Siapkan profil kreator, kelola video, dan pantau perkembangan kontenmu.": "Set up your creator profile, manage videos, and track your content growth.", "Nama pengguna harus 3–24 karakter: huruf, angka, atau garis bawah.": "Username must be 3–24 characters: letters, numbers, or underscores.", "Kata sandi minimal 8 karakter.": "Password must be at least 8 characters.", "Centang persetujuan ketentuan terlebih dahulu.": "Please accept the terms first.", "Browser tidak mengizinkan penyimpanan lokal.": "Your browser does not allow local storage.", "Akun demo berhasil dibuat. Membuka dashboard...": "Demo account created. Opening dashboard..."};
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
  document.getElementById("registerForm")?.addEventListener("submit", async event => {
    event.preventDefault();
    const name = document.getElementById("regName").value.trim();
    const email = document.getElementById("regEmail").value.trim();
    const password = document.getElementById("regPassword").value;
    const message = document.getElementById("registerMessage");
    const lang = localStorage.getItem("jsvidey-language") || "id";
    const showMessage = (text, success = false) => { message.className = success ? "form-message success" : "form-message"; message.textContent = text; };
    if (!/^[A-Za-z0-9_]{3,24}$/.test(name)) return showMessage(lang === "en" ? "Username must be 3–24 characters: letters, numbers, or underscores." : "Nama pengguna harus 3–24 karakter: huruf, angka, atau garis bawah.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showMessage(lang === "en" ? "Enter a valid email address." : "Masukkan alamat email yang valid.");
    if (password.length < 8) return showMessage(lang === "en" ? "Password must be at least 8 characters." : "Kata sandi minimal 8 karakter.");
    if (!document.getElementById("acceptTerms").checked) return showMessage(lang === "en" ? "Please accept the terms first." : "Centang persetujuan ketentuan terlebih dahulu.");
    if (SUPABASE_URL.includes("YOUR_") || SUPABASE_ANON_KEY.includes("YOUR_")) return showMessage(lang === "en" ? "Supabase is not configured yet. Add your Project URL and anon key in js/register.js." : "Supabase belum dikonfigurasi. Isi Project URL dan anon key di js/register.js.");
    const form = document.getElementById("registerForm");
    const submit = form.querySelector('button[type="submit"]'); submit.disabled = true;
    try {
      if (!window.supabase?.createClient) throw new Error("Library Supabase gagal dimuat. Periksa koneksi internet.");
      const client = window.jsvideySupabaseClient || window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { storageKey: "sb-ordvxiydkxbtahjpseph-auth-token", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
      window.jsvideySupabaseClient = client;
      const { data, error } = await client.auth.signUp({ email, password, options: { data: { username: name, display_name: name } } });
      if (error) throw error;
      if (!data.user) throw new Error("Signup did not return a user.");
      if (!data.session) {
        showMessage(lang === "en" ? "Registration received. Check your email to confirm your account, then log in." : "Pendaftaran diterima. Periksa email untuk konfirmasi akun, lalu masuk.", true);
        return;
      }
      try { localStorage.setItem("jsvidey-session", JSON.stringify({ id: data.user.id, name, username: name, email: data.user.email, at: Date.now() })); } catch (_) { /* Supabase session remains the source of truth. */ }
      showMessage(lang === "en" ? "Account created. Opening dashboard..." : "Akun berhasil dibuat. Membuka dashboard...", true);
      setTimeout(() => location.href = "dashboard.html", 500);
    } catch (error) {
      let text = error?.message || "Registration failed.";
      if (/duplicate key|username.*already|unique constraint/i.test(text)) text = lang === "en" ? "That username is already taken." : "Nama pengguna sudah digunakan.";
      showMessage(lang === "en" ? `Registration failed: ${text}` : `Pendaftaran gagal: ${text}`);
    } finally { submit.disabled = false; }
  });
})();
