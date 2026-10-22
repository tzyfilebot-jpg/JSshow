(() => {
  const pageTranslations = {"PLATFORM VIDEO MODERN": "MODERN VIDEO PLATFORM", "Mulai Sekarang": "Get Started", "Cara Kerja": "How It Works", "Jadikan video sebagai cara untuk berbagi cerita, membangun audiens, dan mengembangkan peluang kreatifmu bersama Jsvidey.": "Turn videos into a way to share stories, build an audience, and grow your creative opportunities with Jsvidey.", "Upload mudah": "Easy uploads", "Link praktis": "Easy sharing", "Statistik kreator": "Creator analytics", "Video preview": "Video preview", "Explore Something New": "Explore Something New", "Creator video preview": "Creator video preview", "Preview": "Preview", "Upload Videos": "Upload Videos", "Kelola video dalam satu ruang kreator yang praktis.": "Manage your videos in one convenient creator space.", "Share Anywhere": "Share Anywhere", "Bagikan tautan video kepada audiensmu dengan mudah.": "Share video links with your audience easily.", "Creator Analytics": "Creator Analytics", "Pantau penayangan dan performa konten dari dashboard.": "Track views and content performance from your dashboard.", "Earn & Withdraw": "Earn & Withdraw", "Siapkan pengelolaan penghasilan dan penarikan sesuai ketentuan.": "Manage earnings and withdrawals according to the applicable terms.", "MULAI DALAM 4 LANGKAH": "GET STARTED IN 4 STEPS", "Perjalanan kreator,": "Your creator journey,", "lebih sederhana.": "made simpler.", "Dari unggah video hingga membagikannya ke dunia.": "From uploading videos to sharing them with the world.", "Buat Akun": "Create an Account", "Daftar untuk menyiapkan ruang kreatormu.": "Sign up to set up your creator space.", "Upload Video": "Upload Videos", "Tambahkan video yang kamu miliki atau berhak bagikan.": "Add videos you own or have permission to share.", "Bagikan": "Share", "Distribusikan tautan ke komunitas dan media sosial.": "Share links with your community and social media.", "Pantau Performa": "Track Performance", "Lihat statistik dan kelola fitur kreator dari dashboard.": "View stats and manage creator tools from your dashboard.", "Mulai bangun ruang videomu.": "Build your video space.", "Daftar gratis dan jelajahi pengalaman Jsvidey.": "Sign up for free and explore Jsvidey.", "Upload": "Upload", "Creator tools": "Creator tools"};
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

  const languageKey = "jsvidey-language";
  const dict = {
    id: {getStarted:"Mulai Sekarang",howWorks:"Cara Kerja"},
    en: {getStarted:"Get Started",howWorks:"How It Works"}
  };
  const applyLanguage = lang => {
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-i18n]").forEach(el => {
      const value = dict[lang]?.[el.dataset.i18n];
      if (value) el.textContent = value;
    });
    try { localStorage.setItem(languageKey,lang); } catch (_) {}
  };
  let lang = "id";
  try { lang = localStorage.getItem(languageKey) || "id"; } catch (_) {}
  applyLanguage(lang);
})();