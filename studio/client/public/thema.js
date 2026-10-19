// EduOrga Studio: Thema vor dem ersten Zeichnen setzen (kein weißes Aufblitzen im dunklen Thema). Eigene Datei wegen CSP (script-src 'self').
(function () {
  var t = 'hell';
  try { t = localStorage.getItem('studio.thema') || 'hell'; } catch (e) { /* privat */ }
  var d = t === 'dunkel' || (t === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.thema = t === 'auto' ? 'auto' : d ? 'dunkel' : 'hell';
  document.documentElement.style.background = d ? '#10161a' : '#f5f7f8';
  document.documentElement.style.colorScheme = d ? 'dark' : 'light';
})();
