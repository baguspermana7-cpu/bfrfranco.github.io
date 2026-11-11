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
 * is cleared. A `#rzs=` share link (P02) is read the same way and wins over a pending Open.
 * Exposes window.rzScenario = { capture, restore, openInCalc, saveToAccount, shareLink, readLink, encodeLink, restoreFiltered }.
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

  // One entry per <body data-rz-calc> page; tools/test-scenario-open-routes.mjs and test-calculator-registry.mjs keep it in step.
  var ROUTES = { capex: 'capex-calculator.html', opex: 'opex-calculator.html', roi: 'roi-calculator.html',
                 tco: 'tco-calculator.html', pue: 'pue-calculator.html', carbon: 'carbon-footprint.html',
                 cx: 'cx-calculator.html', rfs: 'rfs-readiness-workbench.html',
                 spares: 'spares-readiness-calculator.html', tia: 'tia-942-checklist.html',
                 tier: 'tier-advisor.html' };

  /** From account.html: stash a scenario's inputs and navigate to its calculator. */
  function openInCalc(calc, inputs) {
    // calc is set by each calculator's own Save button (a known literal), but sanitize before it
    // reaches location.href so a malformed stored value can never build an unexpected path.
    if (!/^[a-z0-9-]{1,40}$/.test(String(calc || ''))) return;
    // One entry per <body data-rz-calc> page; tools/test-scenario-open-routes.mjs keeps this in step.
    // An id with no entry does not navigate (it used to guess "<id>-calculator.html" — 404 for carbon,
    // rfs, spares, tia and tier).
    var file = ROUTES[calc];
    if (!file) return;
    try { w.localStorage.setItem('rz_open_scenario', JSON.stringify({ calc: calc, inputs: inputs, ts: Date.now() })); } catch (e) {}
    w.location.href = file;
  }


  /* ── Share links (P02): #rzs=<base64url(JSON {v:1, calc, inputs, origin?})> ─────────────────────────────
     The fragment never reaches a server. The payload is untrusted: strict schema, size caps, id pattern, and it is
     written only into elements that pass isCapturable (so a link can never fill a login field).
     Limits are mirrored in data/scenario-link.schema.json; tools/test-scenario-share-links.mjs keeps them equal. */
  var LINK = {
    prefix: '#rzs=', version: 1, maxLength: 8000, maxKeys: 500, maxValue: 2000,
    keyPattern: /^[A-Za-z0-9_:-]{1,80}$/, originPattern: /^[A-Za-z0-9_.:\/-]{1,80}$/,
    types: ['text', 'number', 'range', 'select', 'checkbox', 'radio', 'date', 'textarea', 'search', 'tel', 'url',
            'color', 'month', 'week', 'time', 'datetime-local']
  };
  // Where Copy link goes when a page has no #btnSaveAccount. null = the page keeps its own share (spares: "Share URL", #s=).
  var COPY_ANCHORS = { tier: '#btnExportPDF', tia: '#btnExportPDF', rfs: '#rfsBtnSave', spares: null };
  var ADOPT_SHARE = { cx: '.cx-share-btn' };

  function b64urlEncode(str) {
    var bin = unescape(encodeURIComponent(str));
    return w.btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64urlDecode(s) {
    if (!/^[A-Za-z0-9_-]+$/.test(s)) throw new Error('bad base64');
    var b = s.replace(/-/g, '+').replace(/_/g, '/');
    while (b.length % 4) b += '=';
    return decodeURIComponent(escape(w.atob(b)));
  }

  function validatePayload(obj, calc) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return 'not an object';
    if (obj.v !== LINK.version) return 'unsupported version';
    if (typeof obj.calc !== 'string' || obj.calc !== calc) return 'link is for another calculator';
    if (obj.origin != null && (typeof obj.origin !== 'string' || !LINK.originPattern.test(obj.origin))) return 'bad origin';
    var inputs = obj.inputs;
    if (!inputs || typeof inputs !== 'object' || Array.isArray(inputs)) return 'no inputs';
    var keys = Object.keys(inputs);
    if (keys.length > LINK.maxKeys) return 'too many inputs';
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i], rec = inputs[k];
      if (!LINK.keyPattern.test(k)) return 'bad input id';
      if (!rec || typeof rec !== 'object' || LINK.types.indexOf(rec.t) < 0) return 'bad input type';
      if (typeof rec.v === 'string') { if (rec.v.length > LINK.maxValue) return 'value too long'; }
      else if (typeof rec.v !== 'boolean') return 'bad input value';
    }
    return null;
  }

  function encodeLink(calc, inputs, origin) {
    var payload = { v: LINK.version, calc: calc, inputs: inputs || {} };
    if (origin) payload.origin = origin;
    return LINK.prefix + b64urlEncode(JSON.stringify(payload));
  }

  /** Parse and validate a location.hash for `calc`. → {ok:true, map, origin} | {ok:false, reason} */
  function readLink(hash, calc) {
    hash = String(hash || '');
    if (hash.indexOf(LINK.prefix) !== 0) return { ok: false, reason: 'no link' };
    if (hash.length > LINK.maxLength + 200) return { ok: false, reason: 'link too long' };
    var obj;
    try { obj = JSON.parse(b64urlDecode(hash.slice(LINK.prefix.length))); } catch (e) { return { ok: false, reason: 'unreadable' }; }
    var bad = validatePayload(obj, calc);
    if (bad) return { ok: false, reason: bad };
    return { ok: true, map: obj.inputs, origin: obj.origin || null };
  }

  /** The current page's share URL. → {ok:true, url} | {ok:false, reason:'no-calc'|'too-large'} */
  function shareLink(inputs) {
    var calc = d.body && d.body.getAttribute('data-rz-calc');
    if (!calc) return { ok: false, reason: 'no-calc' };
    var url = w.location.origin + w.location.pathname + encodeLink(calc, inputs || capture());
    if (url.length > LINK.maxLength) return { ok: false, reason: 'too-large' };
    return { ok: true, url: url };
  }

  /** A share URL for any calculator (account.html rows). → {ok:true, url} | {ok:false, reason:'no-calc'|'too-large'} */
  function linkFor(calc, inputs) {
    if (!/^[a-z0-9-]{1,40}$/.test(String(calc || '')) || !ROUTES[calc]) return { ok: false, reason: 'no-calc' };
    var dir = w.location.pathname.replace(/[^/]*$/, '');
    var url = w.location.origin + dir + ROUTES[calc] + encodeLink(calc, inputs || {});
    if (url.length > LINK.maxLength) return { ok: false, reason: 'too-large' };
    return { ok: true, url: url };
  }

  /** Restore only ids that exist here and are capturable; count the rest. */
  function restoreFiltered(map) {
    var allowed = {}, restored = 0, skipped = 0;
    Object.keys(map || {}).forEach(function (id) {
      if (isCapturable(d.getElementById(id))) { allowed[id] = map[id]; restored++; } else skipped++;
    });
    restore(allowed);
    return { restored: restored, skipped: skipped, allowed: allowed };
  }

  // Read at script evaluation: a page with its own hash router (rfs: '#setup') may rewrite the hash before
  // DOMContentLoaded, and the link must still be read.
  var BOOT_HASH = String((w.location && w.location.hash) || '');

  function clearHash() {
    // Only remove our own fragment; a router that already moved on keeps its hash.
    if (String(w.location.hash).indexOf(LINK.prefix) !== 0) return;
    try { w.history.replaceState(null, '', w.location.pathname + w.location.search); } catch (e) {}
  }

  function showBanner(text, isError) {
    var old = d.getElementById('rzShareBanner');
    if (old) old.parentNode.removeChild(old);
    var b = d.createElement('div');
    b.id = 'rzShareBanner';
    b.setAttribute('role', isError ? 'alert' : 'status');
    b.style.cssText = 'display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px 12px;margin:0 0 12px;padding:8px 12px;' +
      'border:1px solid var(--rzt-line, rgba(127,127,127,.35));border-radius:4px;background:var(--rzt-bg-2, transparent);' +
      'color:var(--rzt-text, inherit);font-size:14px;line-height:1.4';
    var t = d.createElement('span');
    t.textContent = text;
    var x = d.createElement('button');
    x.type = 'button';
    x.className = 'tool-btn';
    x.textContent = 'Dismiss';
    x.style.minHeight = '44px';
    var main = d.querySelector('main') || d.body;
    // Sit directly above the calculator's action row, inside the content column, when the page has one.
    var calc = d.body.getAttribute('data-rz-calc');
    var sel = Object.prototype.hasOwnProperty.call(COPY_ANCHORS, calc) ? COPY_ANCHORS[calc] : '#btnSaveAccount';
    var anchor = sel && d.querySelector(sel);
    var bar = anchor && anchor.parentNode;
    x.addEventListener('click', function () {
      if (b.parentNode) b.parentNode.removeChild(b);
      if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
      try { main.focus(); } catch (e) {}
    });
    b.appendChild(t); b.appendChild(x);
    // .tool-btn is styled only inside the action row, so the Dismiss button takes the look of the row's own button.
    if (anchor) {
      var cs = w.getComputedStyle(anchor);
      ['fontFamily', 'fontSize', 'fontWeight', 'letterSpacing', 'color', 'backgroundColor', 'borderTop', 'borderRight',
       'borderBottom', 'borderLeft', 'borderRadius', 'paddingLeft', 'paddingRight', 'textTransform'].forEach(function (k) { x.style[k] = cs[k]; });
    }
    if (bar && bar.parentNode) bar.parentNode.insertBefore(b, bar);
    else { b.style.margin = '12px 16px'; main.insertBefore(b, main.firstChild); }
    return b;
  }

  /** On load: a valid #rzs= link wins over a pending local "Open"; an invalid one says so and changes nothing. */
  function handleLink() {
    var calc = d.body && d.body.getAttribute('data-rz-calc');
    if (!calc || BOOT_HASH.indexOf(LINK.prefix) !== 0) return false;
    var r = readLink(BOOT_HASH, calc);
    clearHash();
    if (!r.ok) { showBanner('This shared link could not be read (' + r.reason + '). The calculator shows its defaults.', true); return true; }
    var pending = false;
    try { pending = !!w.localStorage.getItem('rz_open_scenario'); w.localStorage.removeItem('rz_open_scenario'); } catch (e) {}
    var first = restoreFiltered(r.map);
    setTimeout(function () { restoreFiltered(r.map); }, 350);
    setTimeout(function () { restoreFiltered(r.map); }, 900);
    showBanner('Shared scenario: ' + first.restored + ' input' + (first.restored === 1 ? '' : 's') + ' loaded from a link' +
      (first.skipped ? ', ' + first.skipped + ' not on this page skipped' : '') + '. Results recalculated on this page.' +
      (pending ? ' A scenario opened from your account was set aside in favour of the link.' : ''), false);
    return true;
  }

  function msgLine(anchor) {
    var m = d.getElementById('acctSaveMsg') || d.getElementById('rzScenarioMsg');
    if (m) return m;
    m = d.createElement('p');
    m.id = 'rzScenarioMsg';
    m.className = 'tool-msg';
    m.setAttribute('role', 'status');
    var bar = anchor.parentNode;
    bar.parentNode.insertBefore(m, bar.nextSibling);
    return m;
  }

  function copyLink(btn) {
    var msg = msgLine(btn);
    function say(t) { msg.style.display = 'block'; msg.textContent = t; }
    var r = shareLink();
    if (!r.ok) {
      say(r.reason === 'too-large' ? 'This scenario is too large for a link. Save it to your account instead.' : 'This page cannot be shared.');
      var save = d.getElementById('btnSaveAccount');
      if (save) save.focus();
      return;
    }
    function fallback() {
      say('Copy this link:');
      var inp = d.createElement('input');
      inp.type = 'text'; inp.readOnly = true; inp.value = r.url; inp.id = 'rzShareLinkField';
      inp.setAttribute('aria-label', 'Shareable link');
      inp.style.cssText = 'display:block;width:100%;margin-top:6px;font:inherit;font-size:16px';
      msg.appendChild(inp); inp.focus(); inp.select();
    }
    try {
      if (!w.navigator.clipboard || !w.navigator.clipboard.writeText) return fallback();
      // A clipboard write can hang (unfocused document, a pending permission prompt): show the link after 1.5 s.
      var settled = false;
      var guard = setTimeout(function () { if (!settled) { settled = true; fallback(); } }, 1500);
      w.navigator.clipboard.writeText(r.url).then(function () {
        if (settled) return;
        settled = true; clearTimeout(guard);
        say('Link copied. Anyone who opens it sees these inputs.');
        track('scenario_link_copied', 'calc', null, { calc: (d.body && d.body.getAttribute('data-rz-calc')) || '' });
        setTimeout(function () { if (msg.textContent.indexOf('Link copied') === 0) msg.style.display = 'none'; }, 4000);
      }, function () { if (!settled) { settled = true; clearTimeout(guard); fallback(); } });
    } catch (e) { fallback(); }
  }

  function injectCopyButton() {
    var calc = d.body && d.body.getAttribute('data-rz-calc');
    if (!calc || d.getElementById('btnCopyLink')) return;
    if (/[?&]embed=(compare|pack|sensitivity|article)(&|$)/.test(w.location.search || '')) return;
    var sel = Object.prototype.hasOwnProperty.call(COPY_ANCHORS, calc) ? COPY_ANCHORS[calc] : '#btnSaveAccount';
    // A page that already has its own "copy a link" control adopts the shared one instead of growing a duplicate
    // (cx: .cx-share-btn copied a ?query link, with a prompt() fallback). Its old ?query links still restore.
    var own = ADOPT_SHARE[calc] && d.querySelector(ADOPT_SHARE[calc]);
    if (own) {
      own.id = 'btnCopyLink';
      own.removeAttribute('onclick');
      own.setAttribute('title', 'Copy a link that opens this calculator with these inputs');
      own.addEventListener('click', function (e) { e.preventDefault(); copyLink(own); });
      return;
    }
    var anchor = sel && d.querySelector(sel);
    if (!anchor) return;
    var b = d.createElement('button');
    b.type = 'button';
    b.className = 'tool-btn';
    b.id = 'btnCopyLink';
    b.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true" style="vertical-align:-1px;margin-right:6px"><path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1"/><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"/></svg>Copy link';
    b.addEventListener('click', function () { copyLink(b); });
    // The register holds a tool bar to 6 controls (test-tool-register T13; owner, ledger "toolbars of 6-18
    // buttons"). When the bar is full, the link goes on its own quiet row directly under the bar.
    var bar = anchor.closest ? anchor.closest('.tool-bar') : null;
    if (bar && barControls(bar) >= 6) {
      var row = d.createElement('div');
      row.className = 'rz-scn-share-row';
      row.style.cssText = 'display:flex;justify-content:flex-end;margin:6px 0 0';
      row.appendChild(b);
      bar.parentNode.insertBefore(row, bar.nextSibling);
      return;
    }
    anchor.parentNode.insertBefore(b, anchor.nextSibling);
  }

  // Controls in a bar, counted the way the register gate counts them: aria-pressed chips are one group.
  function barControls(bar) {
    var all = bar.querySelectorAll('button, a[role=button], select, a.btn, a[class*="btn"]');
    var n = 0, pressed = 0;
    for (var i = 0; i < all.length; i++) {
      var e = all[i];
      if (!(e.offsetWidth || e.offsetHeight || e.getClientRects().length)) continue;
      if (e.hasAttribute('aria-pressed') && !(e.closest && e.closest('.seg'))) pressed++; else n++;
    }
    return n + (pressed ? 1 : 0);
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
    // Expire a stale pending scenario (e.g. the calc page never finished loading last time) so it
    // can't silently overwrite the user's fresh inputs on a much later visit. 60-minute TTL.
    if (obj.ts && (Date.now() - obj.ts) > 60 * 60 * 1000) {
      try { w.localStorage.removeItem('rz_open_scenario'); } catch (e) {}
      return;
    }
    try { w.localStorage.removeItem('rz_open_scenario'); } catch (e) {}
    // Restore after the page's own init has run.
    // Filtered like a shared link: a stored map is replayed only into capturable fields.
    setTimeout(function () { restoreFiltered(obj.inputs); }, 350);
    setTimeout(function () { restoreFiltered(obj.inputs); }, 900);
  }

  /**
   * Shared "save this scenario to my account" orchestration for calculators.
   * calc: 'opex'|'roi'|… ; opts: { msgEl, name, summary }. Captures the page inputs,
   * saves {summary, inputs} to Supabase for the signed-in user, and reports into #msgEl.
   * Signed-out users are pointed to account.html. Uses window.rzSupa at call time.
   */
  /* P15 part A (v3.39.0): the signed-in user's own activity, written to audit_log through the existing
     log_event RPC. Fire-and-forget: a logging failure never touches the action. Meta carries only the
     calculator id and a format, never inputs or personal data. */
  var TRACK_ACTIONS = ['scenario_saved', 'scenario_deleted', 'scenario_opened', 'scenario_link_copied', 'pdf_exported'];
  var TRACK_META = ['calc', 'format'];
  function track(action, targetType, targetId, meta) {
    try {
      if (TRACK_ACTIONS.indexOf(action) < 0) return Promise.resolve(false);
      var S = w.rzSupa;
      if (!S || !S.configured || !S.logEvent) return Promise.resolve(false);
      var clean = {};
      Object.keys(meta || {}).forEach(function (k) {
        if (TRACK_META.indexOf(k) >= 0 && typeof meta[k] === 'string' && meta[k].length <= 40) clean[k] = meta[k];
      });
      return Promise.resolve(S.getUser()).then(function (u) {
        if (!u) return false;
        return Promise.resolve(S.logEvent(action, targetType || null, targetId ? String(targetId) : null, clean))
          .then(function (r) { return !(r && r.error); });
      }).catch(function () { return false; });
    } catch (e) { return Promise.resolve(false); }
  }

  /* PDF exports: every calculator's builder, wrapped once here instead of edited on 11 pages. A builder
     that returns without throwing counts as exported. Names absent on a page are skipped. */
  var PDF_BUILDERS = ['exportPDF', 'exportOpexPDF', 'cxExportPDF', 'cxExportActivityPDF', 'exportFullReportPDF',
    'exportCriticalityPDF', 'exportReadinessPDF', 'RfsReportEngine.exportPdf', 'RfsUI.exportCurrentTabPdf'];
  function hookPdfExports() {
    var calc = d.body && d.body.getAttribute('data-rz-calc');
    if (!calc) return 0;
    var n = 0;
    PDF_BUILDERS.forEach(function (path) {
      var parts = path.split('.'), owner = w;
      for (var i = 0; i < parts.length - 1; i++) { owner = owner && owner[parts[i]]; }
      var key = parts[parts.length - 1];
      var fn = owner && owner[key];
      if (typeof fn !== 'function' || fn.__rzTracked) return;
      var wrapped = function () {
        var out = fn.apply(this, arguments);
        var done = function () { track('pdf_exported', 'calc', null, { calc: calc, format: 'pdf' }); };
        if (out && typeof out.then === 'function') out.then(done, function () {}); else done();
        return out;
      };
      wrapped.__rzTracked = true;
      try { owner[key] = wrapped; n++; } catch (e) {}
    });
    return n;
  }

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
      track('scenario_saved', 'scenario', res.data && res.data.id, { calc: calc });
      // Trusted, hardcoded content — safe to use innerHTML for the account link (discoverability).
      showOk('<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" style="vertical-align:-1px;margin-right:5px" aria-hidden="true"><path d="M6.5 19a4.5 4.5 0 0 1 0-9 6 6 0 0 1 11.6-1.6A4 4 0 0 1 18 19z"/></svg>Saved — <a href="account.html" style="color:#67e8f9;text-decoration:underline;">open My Account</a>');
    } catch (e) { show('Save failed: ' + (e && e.message || e), false); }
  }

  /**
   * Inject a small, persistent "My Account" link on calculator pages so users can reach
   * account.html any time (not only after a save). Only on pages with data-rz-calc; skips if
   * already present. Positioned bottom-left, and lifted above the mobile share bottom-bar.
   */
  function injectAccountLink() {
    if (!(d.body && d.body.getAttribute('data-rz-calc'))) return;
    if (d.body.getAttribute('data-rz-account-pill') === 'off') return;
    if (/[?&]embed=(compare|pack|sensitivity|article)(&|$)/.test(w.location.search || '')) return; // computed in a hidden frame (rz-embed-compute.js) // the tool shell links to account.html from its own nav and reference section
    if (d.getElementById('rzAccountPill')) return;
    if (!d.getElementById('rzAccountPillCss')) {
      var st = d.createElement('style');
      st.id = 'rzAccountPillCss';
      // Industrial-instrument idiom (documentation/design.md): deep-slate surface, 1px hairline,
      // instrument-cyan (#00DDFF, informational/secondary data), JetBrains Mono data-field label,
      // 4px radius. NO glassmorphism blur, NO generic-blue — both are on the anti-pattern list.
      st.textContent =
        '#rzAccountPill{position:fixed;left:16px;bottom:16px;z-index:1200;background:#1a1d23;' +
        'color:#00DDFF;border:1px solid rgba(0,221,255,0.34);border-radius:4px;padding:8px 12px;' +
        "font-family:'JetBrains Mono','SF Mono','Cascadia Code','Consolas',monospace;font-size:10.5px;" +
        'font-weight:500;letter-spacing:0.12em;text-transform:uppercase;text-decoration:none;' +
        'box-shadow:0 2px 8px rgba(0,0,0,0.4);display:inline-flex;align-items:center;gap:8px;' +
        'transition:border-color .15s,color .15s;}' +
        '#rzAccountPill::before{content:"";width:6px;height:6px;border-radius:50%;background:#00DDFF;' +
        'box-shadow:0 0 6px rgba(0,221,255,0.7);flex:0 0 auto;}' +
        '#rzAccountPill:hover{border-color:rgba(0,221,255,0.7);color:#7fefff;}' +
        '#rzAccountPill:focus-visible{outline:2px solid rgba(0,221,255,0.7);outline-offset:2px;}' +
        '@media(max-width:768px){#rzAccountPill{bottom:76px;}}';
      (d.head || d.documentElement).appendChild(st);
    }
    var a = d.createElement('a');
    a.id = 'rzAccountPill';
    a.href = 'account.html';
    a.title = 'View your account and saved scenarios';
    a.setAttribute('aria-label', 'My account and saved scenarios');
    a.textContent = 'My Account';
    d.body.appendChild(a);
  }

  w.rzScenario = { capture: capture, restore: restore, openInCalc: openInCalc, saveToAccount: saveToAccount, track: track,
                   TRACK_ACTIONS: TRACK_ACTIONS, PDF_BUILDERS: PDF_BUILDERS, hookPdfExports: hookPdfExports,
                   shareLink: shareLink, linkFor: linkFor, readLink: readLink, encodeLink: encodeLink, restoreFiltered: restoreFiltered, LINK: LINK };

  function onReady() { if (!handleLink()) autoRestore(); injectAccountLink(); injectCopyButton(); hookPdfExports(); }
  if (d.readyState === 'loading') w.addEventListener('DOMContentLoaded', onReady);
  else onReady();
})(typeof window !== 'undefined' ? window : this, typeof document !== 'undefined' ? document : null);
