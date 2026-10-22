// Member uploads are intentionally disabled. Video publishing is available only in admin.html.
(()=>{if(location.pathname.endsWith('/upload.html')||location.pathname==='upload.html'){const form=document.getElementById('uploadForm');if(form){form.addEventListener('submit',e=>{e.preventDefault();alert('Upload video hanya tersedia untuk administrator melalui panel admin.');});}}})();
