// Static mirror only (added by scripts/resilience/build-mirror.mjs; never part of the Worker build).
// The mirror has no form API, so every form opens the visitor's email app with the message filled in.
// Runs in the capture phase, before the site's own fetch-based form handlers, and stops them.
(function () {
  var TO = 'anthonytoday+bots@mail.grokbot.com';
  var SKIP = { website: 1, started: 1 }; // honeypot and timing fields
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
  function note(form, text, isError) {
    var host = form.parentElement || form;
    var p = host.querySelector('.mirror-note');
    if (!p) {
      p = document.createElement('p');
      p.className = 'mirror-note';
      p.setAttribute('role', 'status');
      p.style.cssText = 'margin:.5rem 0 0;font-size:.875rem;line-height:1.4';
      form.insertAdjacentElement('afterend', p);
    }
    p.style.color = isError ? '#B91C1C' : '';
    p.textContent = text;
  }
  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form || !form.matches || !form.matches('form[data-mirror-mail]')) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    var data = new FormData(form);
    if (String(data.get('website') || '').trim()) { note(form, 'Thanks.'); return; } // honeypot filled: silently drop
    var lines = [], hasValue = false, bad = '';
    data.forEach(function (v, k) {
      if (SKIP[k] || typeof v !== 'string') return;
      v = v.trim();
      if (!v) return;
      if (k === 'email' && !EMAIL_RE.test(v)) bad = 'Check the email address.';
      hasValue = true;
      lines.push(k.replace(/_/g, ' ') + ': ' + v);
    });
    if (bad) { note(form, bad, true); return; }
    if (!hasValue) { note(form, 'Fill in the form first.', true); return; }
    var kind = form.getAttribute('data-mirror-mail') || 'Website message';
    var body = lines.join('\n') + '\n\nSent from ' + location.href;
    if (body.length > 1800) body = body.slice(0, 1800) + '\n[shortened]';
    var url = 'mailto:' + TO + '?subject=' + encodeURIComponent('[Money With AI] ' + kind) + '&body=' + encodeURIComponent(body);
    note(form, 'Your email app should open with the message ready to send. Nothing opened? Email ' + TO + '.');
    window.location.href = url;
  }, true);
})();
