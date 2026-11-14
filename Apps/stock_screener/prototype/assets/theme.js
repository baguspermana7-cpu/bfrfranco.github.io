/* StockMap theme (FINANCE_SUITE_STANDARD.md §Theme sync). Loaded in <head> of every page, before paint.
   - Inside the rz-ops console: start on the console's saved theme (rz_admin_theme), then follow the
     {type:'theme-sync',theme} message the console posts on our load and on every toggle (same origin only).
   - Standalone: our own saved choice (stockmap_theme), else dark (the suite default).
   The theme is <html data-theme>; css/rz-finance-suite.css flips the --fs-* tokens StockMap's vars map onto. */
(function () {
  var root = document.documentElement;
  function apply(t) { if (t === 'light' || t === 'dark') root.setAttribute('data-theme', t); }
  var t = null;
  try {
    if (window.parent !== window) t = localStorage.getItem('rz_admin_theme');
    if (!t) t = localStorage.getItem('stockmap_theme');
  } catch (e) {}
  apply(t || 'dark');
  window.addEventListener('message', function (e) {
    if (e.origin !== window.location.origin) return;
    if (e.data && e.data.type === 'theme-sync') apply(e.data.theme);
  });
})();
