// Theme before first paint. Preference: 'light' | 'dark' | system (nothing stored).
// System mode follows OS changes live. External file so CSP script-src 'self' holds.
(function () {
  var KEY = 'bd-theme';
  var root = document.documentElement;
  var mq = window.matchMedia('(prefers-color-scheme: dark)');
  function pref() {
    try { var t = localStorage.getItem(KEY); return t === 'light' || t === 'dark' ? t : 'system'; } catch (e) { return 'system'; }
  }
  function apply() {
    var p = pref();
    var dark = p === 'dark' || (p === 'system' && mq.matches);
    if (dark) root.setAttribute('data-theme', 'dark'); else root.removeAttribute('data-theme');
    root.setAttribute('data-theme-pref', p);
    root.style.colorScheme = dark ? 'dark' : 'light';
    try { document.dispatchEvent(new CustomEvent('bd-theme')); } catch (e) {}
  }
  apply();
  window.bdApplyTheme = apply;
  if (mq.addEventListener) mq.addEventListener('change', apply); else if (mq.addListener) mq.addListener(apply);
  window.addEventListener('storage', function (e) { if (e.key === KEY) apply(); });
})();
