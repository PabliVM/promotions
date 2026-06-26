// ================================================
// CAMPOGRAMA-DARKMODE.JS — Toggle dark mode MAESTRO
// ================================================

// Toggle dark mode MAESTRO — persiste preferencia en localStorage
(function(){
  function applyDark(isDark){
    document.body.classList.toggle('dark', isDark);
    var btn = document.getElementById('darkBtnMaestro');
    if(btn) btn.innerHTML = isDark ? '☀' : '☾';
    // Actualizar theme-color PWA según modo
    var meta = document.querySelector('meta[name="theme-color"]');
    if(meta) meta.setAttribute('content', isDark ? '#1a1d23' : '#2563eb');
  }
  window.toggleDarkMaestro = function(){
    var isDark = !document.body.classList.contains('dark');
    applyDark(isDark);
    try{ localStorage.setItem('maestro-dark', isDark ? '1' : '0'); }catch(e){}
  };
  // Restaurar preferencia al cargar
  try{
    var saved = localStorage.getItem('maestro-dark');
    if(saved === '1') applyDark(true);
  }catch(e){}
})();
