(() => {
  const mount = document.getElementById("footerMount"); if (!mount) return;
  const year = new Date().getFullYear();
  mount.innerHTML = `<footer class="site-footer"><div class="footer-inner"><a class="brand footer-brand" href="index.html"><span>Show Stream</span></a><div class="footer-links"><a href="index.html#features" data-footer="features">Fitur</a><a href="index.html#how" data-footer="how">Cara kerja</a><a href="mailto:support@jsvidey.com" data-footer="contact">Kontak</a></div><span class="footer-copy">© ${year} Jsvidey. <span data-footer="rights">Hak cipta dilindungi.</span></span><span class="footer-tagline">Upload, Share, Earn, Withdraw.</span></div></footer>`;
  const apply = lang => { const d={id:{features:'Fitur',how:'Cara kerja',contact:'Kontak',rights:'Hak cipta dilindungi.'},en:{features:'Features',how:'How it works',contact:'Contact',rights:'All rights reserved.'}}[lang]||{}; mount.querySelectorAll('[data-footer]').forEach(el=>{if(d[el.dataset.footer])el.textContent=d[el.dataset.footer]}); };
  let lang='id'; try{lang=localStorage.getItem('jsvidey-language')||'id'}catch(_){} apply(lang);
  document.addEventListener('jsvidey:language-change',e=>apply(e.detail.lang));
})();