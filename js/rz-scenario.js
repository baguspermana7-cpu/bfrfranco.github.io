/**
 * rz-scenario.js — save/restore a calculator's input state so a saved scenario can be
 * reopened later. Generic: captures every relevant input/select/textarea on the page by
 * `id` → value (no per-calculator field list needed), and restores by setting values +
 * dispatching input/change so the calculator recomputes.
 *
 * Auth/modal fields are excluded (never capture passwords). Pairs with rz-supabase.js
 * (which persists the captured map) and account.html (which triggers "Open").
 *
 * Auto-restore: a page sets `<body data-rz-calc="capex">`; on load, if
 * localStorage.rz_open_scenario matches that calc, its inputs are restored then the key
 * is cleared. Exposes window.rzScenario = { capture, restore, openInCalc }.
 */
(function (w, d) {
  'use strict';

  // email excluded by TYPE (not just by modal-ancestor) so credentials never leak into a saved scenario.
  var EXCLUDE_TYPES = { password: 1, email: 1, hidden: 1, file: 1, submit: 1, button: 1, image: 1 };

  function isCapturable(el) {
    if (!el || !el.id) return false;
    var tag = el.tagName;
    if (tag !== 'INPUT' && tag !== 'SELECT' && tag !== 'TEXTAREA') return false;
    if (tag === 'INPUT' && EXCLUDE_TYPES[(el.type || '').toLowerCase()]) return false;
    // Skip anything inside an auth/login modal (avoids capturing email/password).
    if (el.closest && el.closest('#rzModalOverlay, .rz-modal-overlay, [id*="ogin"], [id*="odal"]')) return false;
    return true;
  }

  /** Capture the page's input state → { id: {t, v} }. */
  function capture(root) {
    var scope = (typeof root === 'string' ? d.querySelector(root) : root) || d;
    var out = {};
    var els = scope.querySelectorAll('input[id], select[id], textarea[id]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (!isCapturable(el)) continue;
      var t = el.tagName === 'SELECT' ? 'select' : (el.type || 'text').toLowerCase();
      if (t === 'checkbox') out[el.id] = { t: 'checkbox', v: !!el.checked };
      else if (t === 'radio') { if (el.checked) out[el.id] = { t: 'radio', v: el.value }; }
      else out[el.id] = { t: t, v: el.value };
    }
    return out;
  }

  function fire(el, type) { try { el.dispatchEvent(new Event(type, { bubbles: true })); } catch (e) {} }

  /**
   * Restore a captured map onto the page, triggering recompute. Idempotent: a field is only
   * set + its events fired when its current value actually DIFFERS from the target — so the
   * second auto-restore pass (below) is a no-op if the first already applied, avoiding a
   * gratuitous double recompute / flicker.
   */
  function restore(map) {
    if (!map) return;
    Object.keys(map).forEach(function (id) {
      var el = d.getElementById(id);
      if (!el) return;
      var rec = map[id];
      try {
        var changed = false;
        if (rec.t === 'checkbox') {
          if (el.checked !== !!rec.v) { el.checked = !!rec.v; changed = true; }
        } else if (rec.t === 'radio') {
          var radios = d.getElementsByName(el.name || id);
          for (var j = 0; j < radios.length; j++) {
            var want = radios[j].value === rec.v;
            if (radios[j].checked !== want) { radios[j].checked = want; changed = true; }
          }
        } else {
          if (String(el.value) !== String(rec.v)) { el.value = rec.v; changed = true; }
        }
        if (changed) { fire(el, 'input'); fire(el, 'change'); }
      } catch (e) {}
    });
  }

  /** From account.html: stash a scenario's inputs and navigate to its calculator. */
  function openInCalc(calc, inputs) {
    try { w.localStorage.setItem('rz_open_scenario', JSON.stringify({ calc: calc, inputs: inputs, ts: Date.now() })); } catch (e) {}
    var file = ({ capex: 'capex-calculator.html', opex: 'opex-calculator.html', roi: 'roi-calculator.html',
                  tco: 'tco-calculator.html', pue: 'pue-calculator.html' })[calc] || (calc + '-calculator.html');
    w.location.href = file;
  }

  /** On a calculator page, restore a pending "Open" scenario for this calc (once). */
  function autoRestore() {
    var calc = d.body && d.body.getAttribute('data-rz-calc');
    if (!calc) return;
    var raw;
    try { raw = w.localStorage.getItem('rz_open_scenario'); } catch (e) { return; }
    if (!raw) return;
    var obj;
    try { obj = JSON.parse(raw); } catch (e) { return; }
    if (!obj || obj.calc !== calc || !obj.inputs) return;
    try { w.localStorage.removeItem('rz_open_scenario'); } catch (e) {}
    // Restore after the page's own init has run.
    setTimeout(function () { restore(obj.inputs); }, 350);
    setTimeout(function () { restore(obj.inputs); }, 900);
  }

  /**
   * Shared "save this scenario to my account" orchestration for calculators.
   * calc: 'opex'|'roi'|… ; opts: { msgEl, name, summary }. Captures the page inputs,
   * saves {summary, inputs} to Supabase for the signed-in user, and reports into #msgEl.
   * Signed-out users are pointed to account.html. Uses window.rzSupa at call time.
   */
  async function saveToAccount(calc, opts) {
    opts = opts || {};
    var msg = opts.msgEl && d.getElementById(opts.msgEl);
    function show(t, ok) { if (!msg) return; msg.style.display = 'block'; msg.style.color = ok ? '#34d399' : '#f87171'; msg.textContent = t; }
    function showOk(html) { if (!msg) return; msg.style.display = 'block'; msg.style.color = '#34d399'; msg.innerHTML = html; }
    var S = w.rzSupa;
    if (!S || !S.configured) { show('Cloud save unavailable (config missing).', false); return; }
    try {
      var user = await S.getUser();
      if (!user) { show('Please log in first — opening your account…', false); setTimeout(function () { w.open('account.html', '_blank'); }, 600); return; }
      var inputs = capture();
      var name = opts.name || (calc.toUpperCase() + ' · ' + new Date().toLocaleDateString());
      var res = await S.saveScenario(calc, name, { summary: opts.summary || {}, inputs: inputs });
      if (res.error) { show('Save failed: ' + res.error, false); return; }
      // Trusted, hardcoded content — safe to use innerHTML for the account link (discoverability).
      showOk('☁ Saved — <a href="account.html" style="color:#67e8f9;text-decoration:underline;">open My Account</a>');
    } catch (e) { show('Save failed: ' + (e && e.message || e), false); }
  }

  /**
   * Inject a small, persistent "My Account" link on calculator pages so users can reach
   * account.html any time (not only after a save). Only on pages with data-rz-calc; skips if
   * already present. Positioned bottom-left, and lifted above the mobile share bottom-bar.
   */
  function injectAccountLink() {
    if (!(d.body && d.body.getAttribute('data-rz-calc'))) return;
    if (d.getElementById('rzAccountPill')) return;
    if (!d.getElementById('rzAccountPillCss')) {
      var st = d.createElement('style');
      st.id = 'rzAccountPillCss';
      st.textContent =
        '#rzAccountPill{position:fixed;left:14px;bottom:14px;z-index:1200;background:rgba(30,41,59,0.92);' +
        'color:#93c5fd;border:1px solid rgba(59,130,246,0.45);border-radius:999px;padding:7px 14px;' +
        "font:600 12px/1 system-ui,-apple-system,'Segoe UI',sans-serif;text-decoration:none;" +
        'box-shadow:0 4px 14px rgba(0,0,0,0.35);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);' +
        'display:inline-flex;align-items:center;gap:6px;transition:filter .15s;}' +
        '#rzAccountPill:hover{filter:brightness(1.15);}' +
        '@media(max-width:768px){#rzAccountPill{bottom:74px;}}';
      (d.head || d.documentElement).appendChild(st);
    }
    var a = d.createElement('a');
    a.id = 'rzAccountPill';
    a.href = 'account.html';
    a.title = 'View your saved scenarios';
    a.textContent = '👤 My Account';
    d.body.appendChild(a);
  }

  w.rzScenario = { capture: capture, restore: restore, openInCalc: openInCalc, saveToAccount: saveToAccount };

  function onReady() { autoRestore(); injectAccountLink(); }
  if (d.readyState === 'loading') w.addEventListener('DOMContentLoaded', onReady);
  else onReady();
})(typeof window !== 'undefined' ? window : this, typeof document !== 'undefined' ? document : null);
