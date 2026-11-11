/**
 * rz-project.js — one facility project shared by the calculators (P01 Stage 1: this browser only, localStorage).
 *
 * Core (no DOM, also loaded by tools/test-project-core.mjs in Node):
 *   RZProject.createStore(storage)      -> store with list / get / active / setActive / create / update / remove /
 *                                          setOverride / clearOverride / publish / exportJson / importJson / status
 *   RZProject.validateInputs(inputs)    -> [errors]      ranges from PRD-P01 §10
 *   RZProject.toPage(key, value, spec)  -> { value, clamped } in the page's unit/format (spec = registry field)
 *   RZProject.fromPage(key, raw, spec)  -> canonical value, or null when the page value does not parse
 *   RZProject.isStale(result, project)  -> true when a published result predates the project's current revision
 * Field map: data/calculators.json `fields` (ARCHITECTURE-P C1): canonical value = page value x factor; formats
 * iso2 ('ID'), iso2+region ('ID', or 'US-VA' kept as is), digit ('3'), tier-n ('tier-3').
 * Store shape (key rz_projects_v1): { v:1, active, projects:{ id:{ id, name, rev, created_at, updated_at, inputs,
 * results:{ calc:{ key:{ value, unit, at, rev } } }, overrides:{ calc:{ fieldId:{ value, at } } } } } }.
 * A store that does not parse or fails validation is moved aside to rz_projects_v1_quarantine, never silently dropped.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RZProject = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var KEY = 'rz_projects_v1', QUARANTINE = 'rz_projects_v1_quarantine', MAX_BYTES = 256 * 1024;
  var RANGES = {
    it_load_kw: [50, 500000], tier: [1, 4], pue_design: [1.05, 2.5],
    energy_price_usd_kwh: [0.02, 0.5], horizon_years: [5, 40],
  };
  /* registry key -> canonical project input */
  var KEYMAP = { it_load: 'it_load_kw', pue: 'pue_design', country: 'country', tier: 'tier', energy_price: 'energy_price_usd_kwh', horizon: 'horizon_years' };

  function validateInputs(inputs) {
    var e = [];
    if (!inputs || typeof inputs !== 'object') return ['inputs missing'];
    Object.keys(inputs).forEach(function (k) {
      var v = inputs[k];
      if (k === 'country') { if (!/^[A-Z]{2}$/.test(String(v))) e.push('country must be a two-letter code'); return; }
      if (!RANGES[k]) { e.push('unknown input ' + k); return; }
      if (typeof v !== 'number' || !isFinite(v)) { e.push(k + ' must be a number'); return; }
      if (v < RANGES[k][0] || v > RANGES[k][1]) e.push(k + ' must be ' + RANGES[k][0] + ' to ' + RANGES[k][1]);
      if (k === 'tier' && v !== Math.round(v)) e.push('tier must be a whole number');
    });
    return e;
  }

  function validName(n) { return typeof n === 'string' && n.trim().length >= 1 && n.trim().length <= 80; }

  function validStore(s) {
    if (!s || s.v !== 1 || typeof s.projects !== 'object' || Array.isArray(s.projects)) return false;
    var ids = Object.keys(s.projects);
    for (var i = 0; i < ids.length; i++) {
      var p = s.projects[ids[i]];
      if (!p || p.id !== ids[i] || !validName(p.name) || !(p.rev >= 1) || validateInputs(p.inputs || {}).length) return false;
    }
    return s.active == null || !!s.projects[s.active];
  }

  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  var counter = 0;
  function newId() {
    try { if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
    counter += 1;
    return 'p-' + Date.now().toString(36) + '-' + counter.toString(36);
  }

  /* ---- unit / format conversion ---- */
  function decimalsOf(step) { var s = String(step); var i = s.indexOf('.'); return i < 0 ? 0 : s.length - i - 1; }
  function toPage(key, value, spec, field) {
    spec = spec || {};
    if (value == null) return null;
    if (spec.format === 'iso2' || spec.format === 'iso2+region') return { value: String(value), clamped: false };
    if (spec.format === 'digit') return { value: String(value), clamped: false };
    if (spec.format === 'tier-n') return { value: 'tier-' + value, clamped: false };
    var v = value / (spec.factor || 1), clamped = false;
    if (field) {
      var min = field.min !== '' && field.min != null ? parseFloat(field.min) : -Infinity;
      var max = field.max !== '' && field.max != null ? parseFloat(field.max) : Infinity;
      if (v < min) { v = min; clamped = true; }
      if (v > max) { v = max; clamped = true; }
      var step = parseFloat(field.step);
      if (isFinite(step) && step > 0) v = parseFloat(v.toFixed(Math.max(decimalsOf(field.step), 0)));
    }
    return { value: String(parseFloat(v.toPrecision(12))), clamped: clamped };
  }
  function fromPage(key, raw, spec) {
    spec = spec || {};
    var s = String(raw == null ? '' : raw).trim();
    if (spec.format === 'iso2' || spec.format === 'iso2+region') { var m = s.match(/^([A-Z]{2})(?:$|-)/); return m ? m[1] : null; }
    if (spec.format === 'digit') return /^\d$/.test(s) ? parseInt(s, 10) : null;
    if (spec.format === 'tier-n') { var t = s.match(/^tier-(\d)$/); return t ? parseInt(t[1], 10) : null; }
    var n = parseFloat(s);
    return isFinite(n) ? parseFloat((n * (spec.factor || 1)).toPrecision(12)) : null;
  }
  function isStale(result, project) { return !!(result && project && result.rev < project.rev); }

  /* ---- store ---- */
  function createStore(storage, now) {
    now = now || function () { return new Date().toISOString(); };
    var state = { v: 1, active: null, projects: {} }, mode = 'ok', note = null;
    function read() {
      var raw = null;
      try { raw = storage.getItem(KEY); } catch (e) { mode = 'unavailable'; note = 'storage is blocked in this browser'; return; }
      if (raw == null) return;
      var parsed = null;
      try { parsed = JSON.parse(raw); } catch (e) {}
      if (validStore(parsed)) { state = parsed; return; }
      try { storage.setItem(QUARANTINE, raw); storage.removeItem(KEY); } catch (e) {}
      note = 'a damaged project store was set aside (' + QUARANTINE + ')';
    }
    function write() {
      if (mode !== 'ok') return { ok: false, error: note };
      var s = JSON.stringify(state);
      if (s.length > MAX_BYTES) return { ok: false, error: 'projects exceed the 256 KB limit' };
      try { storage.setItem(KEY, s); } catch (e) { return { ok: false, error: 'could not save: ' + (e && e.message || e) }; }
      return { ok: true };
    }
    read();
    function get(id) { return state.projects[id] ? clone(state.projects[id]) : null; }
    function mutate(fn) {
      var before = JSON.stringify(state);
      var res = fn();
      if (res && res.ok === false) return res;
      var w = write();
      if (!w.ok) { state = JSON.parse(before); return w; }
      return res || { ok: true };
    }
    return {
      mode: function () { return mode; },
      note: function () { return note; },
      list: function () { return Object.keys(state.projects).map(get).sort(function (a, b) { return a.updated_at < b.updated_at ? 1 : -1; }); },
      get: get,
      active: function () { return state.active ? get(state.active) : null; },
      setActive: function (id) { return mutate(function () { if (id != null && !state.projects[id]) return { ok: false, error: 'no such project' }; state.active = id; }); },
      create: function (name, inputs) {
        var err = (validName(name) ? [] : ['name must be 1 to 80 characters']).concat(validateInputs(inputs || {}));
        if (err.length) return { ok: false, error: err.join('; ') };
        var id = newId(), t = now();
        return mutate(function () {
          state.projects[id] = { id: id, name: name.trim(), rev: 1, created_at: t, updated_at: t, inputs: clone(inputs || {}), results: {}, overrides: {} };
          state.active = id;
          return { ok: true, id: id };
        });
      },
      update: function (id, patch) {
        var p = state.projects[id];
        if (!p) return { ok: false, error: 'no such project' };
        var name = patch.name != null ? patch.name : p.name;
        var inputs = Object.assign({}, p.inputs, patch.inputs || {});
        Object.keys(inputs).forEach(function (k) { if (inputs[k] == null) delete inputs[k]; });
        var err = (validName(name) ? [] : ['name must be 1 to 80 characters']).concat(validateInputs(inputs));
        if (err.length) return { ok: false, error: err.join('; ') };
        return mutate(function () {
          state.projects[id] = Object.assign({}, p, { name: name.trim(), inputs: inputs, rev: p.rev + 1, updated_at: now() });
        });
      },
      remove: function (id) {
        return mutate(function () { delete state.projects[id]; if (state.active === id) state.active = null; });
      },
      setOverride: function (calc, fieldId, value) {
        var p = state.projects[state.active];
        if (!p) return { ok: false, error: 'no active project' };
        return mutate(function () {
          var o = Object.assign({}, p.overrides), c = Object.assign({}, o[calc]);
          c[fieldId] = { value: String(value), at: now() }; o[calc] = c;
          state.projects[p.id] = Object.assign({}, p, { overrides: o });
        });
      },
      clearOverride: function (calc, fieldId) {
        var p = state.projects[state.active];
        if (!p) return { ok: false, error: 'no active project' };
        return mutate(function () {
          var o = Object.assign({}, p.overrides), c = Object.assign({}, o[calc]);
          delete c[fieldId]; o[calc] = c;
          state.projects[p.id] = Object.assign({}, p, { overrides: o });
        });
      },
      publish: function (calc, values) {
        var p = state.projects[state.active];
        if (!p) return { ok: false, error: 'no active project' };
        return mutate(function () {
          var r = Object.assign({}, p.results), c = Object.assign({}, r[calc]), t = now();
          Object.keys(values || {}).forEach(function (k) {
            var v = values[k];
            if (!v || typeof v.value !== 'number' || !isFinite(v.value)) return;
            c[k] = { value: v.value, unit: String(v.unit || ''), at: t, rev: p.rev };
          });
          r[calc] = c;
          state.projects[p.id] = Object.assign({}, p, { results: r });
        });
      },
      exportJson: function (id) { var p = get(id); return p ? JSON.stringify({ v: 1, project: p }, null, 2) : null; },
      importJson: function (text) {
        var d;
        try { d = JSON.parse(text); } catch (e) { return { ok: false, error: 'not JSON' }; }
        if (!d || d.v !== 1 || !d.project) return { ok: false, error: 'not a version 1 project file' };
        var p = d.project;
        var err = (validName(p.name) ? [] : ['name must be 1 to 80 characters']).concat(validateInputs(p.inputs || {}));
        if (err.length) return { ok: false, error: err.join('; ') };
        var id = p.id && !state.projects[p.id] && /^[\w-]{1,64}$/.test(p.id) ? p.id : newId(), t = now();
        return mutate(function () {
          state.projects[id] = { id: id, name: p.name.trim(), rev: 1, created_at: t, updated_at: t, inputs: clone(p.inputs || {}), results: {}, overrides: {} };
          state.active = id;
          return { ok: true, id: id };
        });
      },
    };
  }

  return { KEY: KEY, QUARANTINE: QUARANTINE, KEYMAP: KEYMAP, RANGES: RANGES, createStore: createStore,
    validateInputs: validateInputs, toPage: toPage, fromPage: fromPage, isStale: isStale };
});

/* ===================== page UI (browser only) ===================== */
(function (w, d) {
  'use strict';
  if (!w || !d || !w.RZProject || w.__rzProjectUI) return;
  w.__rzProjectUI = true;
  var P = w.RZProject;
  // Read before rz-scenario.js consumes it: a scenario opened from the account or a #rzs= link wins over the project.
  var openedScenario = /^#rzs=/.test(w.location.hash || '');
  try { openedScenario = openedScenario || !!w.localStorage.getItem('rz_open_scenario'); } catch (e) {}
  var CALCS = ['capex', 'opex', 'tco', 'roi', 'carbon', 'pue'];
  var LABEL = { it_load_kw: 'IT load (kW)', country: 'Country (two-letter code)', tier: 'Uptime tier (1 to 4)', pue_design: 'Design PUE',
    energy_price_usd_kwh: 'Energy price (USD/kWh)', horizon_years: 'Horizon (years)' };
  var store, reg, entry, applying = false, root, chip, pop, lastView = 'home';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function ago(iso) {
    var s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
    return s < 90 ? 'just now' : s < 5400 ? Math.round(s / 60) + ' min ago' : s < 129600 ? Math.round(s / 3600) + ' h ago' : Math.round(s / 86400) + ' d ago';
  }
  function num(text) {
    var s = String(text || '').replace(/,/g, ''), m = s.match(/\d+(?:\.\d+)?/);
    if (!m) return NaN;
    var v = parseFloat(m[0]), suf = s.slice(m.index + m[0].length).trim().charAt(0);
    if (suf === 'K' || suf === 'k') v *= 1e3; else if (suf === 'M') v *= 1e6; else if (suf === 'B') v *= 1e9;
    if (/[-(]\s*[^\d\s]{0,3}\s*$/.test(s.slice(0, m.index))) v = -v;
    return v;
  }
  function fire(el) { ['input', 'change'].forEach(function (t) { try { el.dispatchEvent(new Event(t, { bubbles: true })); } catch (e) {} }); }
  function labelOf(el) {
    var l = el.id && d.querySelector('label[for="' + el.id + '"]');
    if (l) return l;
    for (var n = el, depth = 0; n && depth < 3; n = n.parentElement, depth++) {
      for (var s = n.previousElementSibling; s; s = s.previousElementSibling) {
        if (s.matches && s.matches('label, .input-label')) return s;
        var inner = s.querySelector && s.querySelector('label.input-label, .input-label');
        if (inner && s.contains(inner) && !s.querySelector('input,select')) return inner;
      }
    }
    return null;
  }
  function tag(el, html, tone) {
    var host = labelOf(el) || el.parentElement;
    var t = host.querySelector(':scope > .rz-proj-tag[data-for="' + el.id + '"]');
    if (!html) { if (t) t.remove(); return; }
    if (!t) { t = d.createElement('span'); t.className = 'rz-proj-tag'; t.setAttribute('data-for', el.id); host.appendChild(t); }
    if (t.innerHTML !== html) t.innerHTML = html;  // rewriting on a blur 'change' would detach the Reset button mid-click
    t.setAttribute('data-tone', tone || '');
  }

  /* project -> page */
  function apply(force) {
    var p = store.active();
    if (!p || !entry) return [];
    var clamps = [], ov = (p.overrides || {})[entry.calc] || {};
    applying = true;
    Object.keys(entry.fields || {}).forEach(function (key) {
      var spec = entry.fields[key], el = d.getElementById(spec.id), canon = P.KEYMAP[key];
      if (!el) return;
      if (ov[spec.id] && !force) { tag(el, 'overridden · <button type="button" class="rz-proj-reset" data-field="' + esc(spec.id) + '">Reset</button>', 'warn'); return; }
      var v = p.inputs[canon];
      if (v == null) { tag(el, ''); return; }
      var out = P.toPage(key, v, spec, el);
      if (el.tagName === 'SELECT' && ![].some.call(el.options, function (o) { return o.value === out.value; })) {
        var match = [].filter.call(el.options, function (o) { return P.fromPage(key, o.value, spec) === v; })[0];
        if (!match) { tag(el, 'project value ' + esc(v) + ' is not offered here', 'warn'); return; }
        out = { value: match.value, clamped: false };
      }
      if (el.value !== out.value) { el.value = out.value; fire(el); }
      if (out.clamped) clamps.push(spec.id);
      tag(el, out.clamped ? 'project · clamped to this field\'s limit' : 'project', out.clamped ? 'warn' : '');
    });
    (entry.consumes ? Object.keys(entry.consumes) : []).forEach(function (id) {
      var c = entry.consumes[id], el = d.getElementById(id), parts = c.from.split('.');
      if (!el) return;
      var r = (p.results[parts[0]] || {})[parts[1]];
      if (ov[id] && !force) { tag(el, 'overridden · <button type="button" class="rz-proj-reset" data-field="' + esc(id) + '">Reset</button>', 'warn'); return; }
      if (!r) { tag(el, esc(c.label) + ' not run for this project', 'muted'); return; }
      var out = P.toPage(id, r.value, { factor: c.factor }, el);
      if (el.value !== out.value) { el.value = out.value; fire(el); }
      tag(el, 'from ' + esc(c.label) + ' · ' + ago(r.at) + (P.isStale(r, p) ? ' · out of date: rerun ' + esc(c.label) : ''), P.isStale(r, p) ? 'warn' : '');
    });
    applying = false;
    return clamps;
  }

  /* page -> project: user edits become overrides; results are published after each recompute */
  function watchFields() {
    var ids = Object.keys(entry.fields || {}).map(function (k) { return entry.fields[k].id; }).concat(Object.keys(entry.consumes || {}));
    ids.forEach(function (id) {
      var el = d.getElementById(id);
      if (!el) return;
      var on = function (e) {
        if (applying || !e.isTrusted || !store.active()) return;
        store.setOverride(entry.calc, id, el.value);
        tag(el, 'overridden · <button type="button" class="rz-proj-reset" data-field="' + esc(id) + '">Reset</button>', 'warn');
        render();
      };
      el.addEventListener('input', on); el.addEventListener('change', on);
    });
    d.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('.rz-proj-reset');
      if (!b) return;
      e.preventDefault();
      store.clearOverride(entry.calc, b.getAttribute('data-field'));
      apply(false); render();
    });
  }
  var pubTimer;
  function publishSoon() {
    clearTimeout(pubTimer);
    pubTimer = setTimeout(function () {
      if (!store.active() || !entry) return;
      var vals = {};
      (entry.results || []).forEach(function (r) {
        var el = d.querySelector(r.selector), v = el ? num(el.textContent) : NaN;
        if (isFinite(v)) vals[r.key] = { value: v, unit: r.unit };
      });
      if (Object.keys(vals).length) { store.publish(entry.calc, vals); render(); }
    }, 400);
  }
  function watchResults() {
    if (typeof MutationObserver === 'undefined') return;
    var mo = new MutationObserver(publishSoon);
    (entry.results || []).forEach(function (r) {
      var el = d.querySelector(r.selector);
      if (el) mo.observe(el, { childList: true, characterData: true, subtree: true });
    });
  }

  /* chip + popover */
  function pageInputs() {
    var out = {};
    Object.keys(entry.fields || {}).forEach(function (key) {
      var spec = entry.fields[key], el = d.getElementById(spec.id);
      var v = el ? P.fromPage(key, el.value, spec) : null;
      if (v != null && v !== '') out[P.KEYMAP[key]] = v;
    });
    return out;
  }
  function formHtml(p) {
    var inp = p ? p.inputs : pageInputs();
    var h = '<form class="rz-proj-form" novalidate><label>Name<input name="name" maxlength="80" required value="' + esc(p ? p.name : '') + '" class="input-field"></label>';
    Object.keys(LABEL).forEach(function (k) {
      var r = P.RANGES[k];
      h += '<label>' + esc(LABEL[k]) + (k === 'country' ? '<input name="country" maxlength="2" pattern="[A-Z]{2}" class="input-field"'
        : '<input name="' + k + '" type="number" step="any" min="' + r[0] + '" max="' + r[1] + '" class="input-field"')
        + ' value="' + esc(inp[k] == null ? '' : inp[k]) + '"></label>';
    });
    return h + '<p class="rz-proj-err" role="alert" id="rzProjErr"></p><div class="rz-proj-row"><button type="submit" class="rz-proj-primary">'
      + (p ? 'Save' : 'Create') + '</button><button type="button" class="rz-proj-cancel">Cancel</button></div></form>';
  }
  function readForm(f) {
    var inputs = {};
    Object.keys(LABEL).forEach(function (k) {
      var v = f.elements[k].value.trim();
      if (v === '') return;
      inputs[k] = k === 'country' ? v.toUpperCase() : Number(v);
    });
    return { name: f.elements.name.value, inputs: inputs };
  }
  function statusRows(p) {
    return CALCS.map(function (c) {
      var e = reg.filter(function (x) { return x.calc === c; })[0];
      if (!e) return '';
      var res = p.results[c], keys = res ? Object.keys(res) : [];
      var st = !keys.length ? 'not run' : keys.some(function (k) { return P.isStale(res[k], p); }) ? 'out of date' : 'current · ' + ago(res[keys[0]].at);
      return '<tr><td><a href="' + esc(e.page) + '">' + esc(e.title || c) + '</a></td><td data-tone="' + (st === 'out of date' ? 'warn' : '') + '">' + esc(st) + '</td></tr>';
    }).join('');
  }
  /* P04 project pack: choose calculators; each is computed in a hidden copy of its page (js/rz-pack.js) and printed as one document */
  function calcStatus(p, c) {
    var res = p.results[c], keys = res ? Object.keys(res) : [];
    return !keys.length ? 'not run' : keys.some(function (k) { return P.isStale(res[k], p); }) ? 'out of date' : 'current';
  }
  function packHtml(p) {
    var here = entry && entry.calc;
    var rows = CALCS.map(function (c) {
      var e = reg.filter(function (x) { return x.calc === c; })[0];
      if (!e) return '';
      var st = calcStatus(p, c), on = st !== 'not run' || c === here;
      return '<li><label><input type="checkbox" name="calc" value="' + esc(c) + '"' + (on ? ' checked' : '') + '> ' + esc(e.title || c)
        + ' <span class="rz-proj-sub" data-tone="' + (st === 'out of date' ? 'warn' : '') + '">' + esc(st) + '</span></label></li>';
    }).join('');
    return '<form class="rz-proj-form rz-pack-form" novalidate><p class="rz-proj-note">Each chosen calculator is computed now from the project values in a hidden copy of its page, then printed together with an assumptions register. Your open pages are not changed.</p>'
      + '<fieldset><legend>Calculators</legend><ul class="rz-pack-list">' + rows + '</ul></fieldset>'
      + '<fieldset><legend>Include</legend><label><input type="checkbox" name="register" checked> Assumptions register</label> <label><input type="checkbox" name="basis" checked> Basis notes</label></fieldset>'
      + '<label class="rz-pack-note">Issue note (optional)<textarea name="note" maxlength="500" rows="2"></textarea></label>'
      + '<p class="rz-proj-err" role="alert" id="rzProjErr"></p><p class="rz-pack-progress" role="status" aria-live="polite"></p>'
      + '<div class="rz-proj-row"><button type="submit" class="rz-proj-primary">Build and print</button><button type="button" class="rz-proj-cancel">Back</button></div></form>';
  }
  function need(src, name) {
    if (w[name]) return Promise.resolve();
    return new Promise(function (ok, fail) {
      var s = d.createElement('script'); s.src = src + '?v=' + encodeURIComponent(w.RZ_VERSION || '1');
      s.onload = function () { if (w[name]) ok(); else fail(new Error(name + ' did not load')); };
      s.onerror = function () { fail(new Error(src + ' could not load')); };
      d.head.appendChild(s);
    });
  }
  function printHtml(html) {
    // A hidden frame prints only the pack; no window to block, and this tab stays visible while it computes.
    var f = d.createElement('iframe');
    f.className = 'rz-pack-print'; f.setAttribute('aria-hidden', 'true'); f.tabIndex = -1;
    f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    f.onload = function () {
      try { f.contentWindow.focus(); f.contentWindow.print(); } catch (x) {}
      setTimeout(function () { f.remove(); }, 60000);
    };
    f.srcdoc = html;
    d.body.appendChild(f);
  }
  function wirePack() {
    var f = pop.querySelector('form'), err = pop.querySelector('#rzProjErr'), prog = pop.querySelector('.rz-pack-progress');
    var busy = false, cancelled = false, cancelBtn = f.querySelector('.rz-proj-cancel'), go = f.querySelector('.rz-proj-primary');
    function idle() { busy = false; cancelBtn.textContent = 'Back'; go.disabled = false; }
    cancelBtn.addEventListener('click', function () { if (busy) { cancelled = true; prog.textContent = 'Cancelling after the current calculator…'; } else render('home'); });
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      if (busy) return;
      var calcs = [].filter.call(f.querySelectorAll('input[name="calc"]'), function (x) { return x.checked; }).map(function (x) { return x.value; });
      if (!calcs.length) { err.textContent = 'Choose at least one calculator.'; return; }
      err.textContent = '';
      busy = true; cancelled = false; cancelBtn.textContent = 'Cancel'; go.disabled = true;
      need('js/rz-embed-compute.js', 'RZEmbedCompute').then(function () { return need('js/rz-pdf-export.js', 'RZPdfExport'); })
        .then(function () { return need('js/rz-pack.js', 'RZPack'); })
        .then(function () {
          return w.RZPack.build(store, calcs, { register: f.elements.register.checked, basis: f.elements.basis.checked, note: f.elements.note.value.trim(),
            isCancelled: function () { return cancelled; },
            onProgress: function (i, n, title) { prog.textContent = 'Computing ' + i + ' of ' + n + ': ' + title + '…'; } });
        })
        .then(function (r) {
          idle();
          if (r.cancelled) { prog.textContent = 'Cancelled. Nothing was printed.'; return; }
          prog.innerHTML = '<span class="rz-pack-ready">Pack ready · ' + r.sections.length + ' calculator' + (r.sections.length === 1 ? '' : 's')
            + (r.failed.length ? ' · ' + r.failed.length + ' could not be computed and say' + (r.failed.length === 1 ? 's' : '') + ' so' : '') + '.</span> '
            + '<button type="button" class="rz-proj-act" data-pack="print">Print or save as PDF</button> <button type="button" class="rz-proj-act" data-pack="open">Open in a new tab</button>';
          prog.querySelector('[data-pack="print"]').onclick = function () { printHtml(r.html); };
          prog.querySelector('[data-pack="open"]').onclick = function () {
            var url = URL.createObjectURL(new Blob([r.html], { type: 'text/html' })), win = null;
            try { win = w.open(url, '_blank'); } catch (x) { win = null; }
            if (!win) err.textContent = 'The browser blocked the new tab. Allow pop-ups for this site, or use Print or save as PDF.';
            setTimeout(function () { URL.revokeObjectURL(url); }, 120000);
          };
          prog.querySelector('[data-pack="print"]').focus();
          try { if (w.rzScenario && w.rzScenario.track) w.rzScenario.track('pdf_exported', 'calc', null, { calc: 'project', format: 'pack' }); } catch (x) {}
        }, function (x) {
          idle();
          err.textContent = 'The pack could not be built: ' + ((x && x.message) || 'unknown error') + '.';
        });
    });
    var first = f.querySelector('input'); if (first) first.focus();
  }
  function render(view) {
    if (!chip) return;
    var p = store.active(), list = store.list();
    if (store.mode() !== 'ok') {
      chip.disabled = true; chip.title = store.note() || 'storage unavailable';
      chip.innerHTML = 'Facility project: unavailable <span class="rz-proj-sub">' + esc(store.note()) + '</span>';
      return;
    }
    var nf = entry ? Object.keys(entry.fields || {}).length : 0, nr = p && p.results ? Object.keys(p.results).length : 0;
    var chipHtml = p ? 'Facility project: <b>' + esc(p.name) + '</b><span class="rz-proj-sub">' + nf + ' field' + (nf === 1 ? '' : 's') + ' · ' + nr + ' calculator' + (nr === 1 ? '' : 's') + ' with results</span>'
      : 'Facility project: none · Set up';
    if (chip.innerHTML !== chipHtml) chip.innerHTML = chipHtml;
    if (!pop || pop.hidden) return;
    // A background refresh (results published, an override) must not tear down the pack view mid-build.
    if (view === undefined && lastView === 'pack' && pop.querySelector('.rz-pack-form')) return;
    lastView = view || 'home';
    var h = '<h2 id="rzProjTitle">Facility project</h2>';
    if (store.note()) h += '<p class="rz-proj-note">' + esc(store.note()) + '</p>';
    if (view === 'pack' && p) {
      h += packHtml(p);
    } else if (view === 'form' || view === 'edit' || !p) {
      h += '<p class="rz-proj-note">' + (view === 'edit' ? 'Editing raises the revision; results computed before it read "out of date".' : 'Values start from this page. The calculators read them as defaults; anything you change on a page stays on that page.') + '</p>' + formHtml(view === 'edit' ? p : null);
    } else {
      h += '<dl class="rz-proj-dl"><dt>Name</dt><dd>' + esc(p.name) + ' · rev ' + p.rev + '</dd>';
      Object.keys(LABEL).forEach(function (k) { if (p.inputs[k] != null) h += '<dt>' + esc(LABEL[k]) + '</dt><dd>' + esc(p.inputs[k]) + '</dd>'; });
      h += '</dl>' + (openedScenario ? '<p class="rz-proj-note">This page opened a saved scenario, so the project was not applied. <button type="button" class="rz-proj-act" data-act="apply">Apply project values</button></p>' : '')
        + '<table class="rz-proj-table"><thead><tr><th scope="col">Calculator</th><th scope="col">Results</th></tr></thead><tbody>' + statusRows(p) + '</tbody></table>'
        + '<div class="rz-proj-row"><button type="button" class="rz-proj-act" data-act="pack">Project pack</button><button type="button" class="rz-proj-act" data-act="edit">Edit</button><button type="button" class="rz-proj-act" data-act="export">Export</button>'
        + '<label class="rz-proj-switch">Switch<select class="rz-proj-sel"><option value="">—</option>' + list.map(function (x) { return '<option value="' + esc(x.id) + '"' + (x.id === p.id ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</select></label>'
        + '<button type="button" class="rz-proj-act" data-act="duplicate">Duplicate</button><button type="button" class="rz-proj-act" data-act="new">New</button><button type="button" class="rz-proj-act" data-act="import">Import</button>'
        + '<button type="button" class="rz-proj-act rz-proj-del" data-act="delete">Delete</button></div><p class="rz-proj-confirm" hidden></p>';
    }
    pop.innerHTML = h + '<input type="file" accept="application/json" class="rz-proj-file" hidden>';
    wirePop(view);
  }
  function wirePop(view) {
    if (view === 'pack') { wirePack(); return; }
    var f = pop.querySelector('form');
    if (f) {
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        var v = readForm(f), p = store.active();
        var res = view === 'edit' && p ? store.update(p.id, { name: v.name, inputs: Object.assign(Object.keys(p.inputs).reduce(function (o, k) { o[k] = null; return o; }, {}), v.inputs) })
          : store.create(v.name, v.inputs);
        if (!res.ok) { pop.querySelector('#rzProjErr').textContent = res.error; return; }
        openedScenario = false; apply(false); render(); publishSoon();
      });
      pop.querySelector('.rz-proj-cancel').addEventListener('click', function () { if (store.active()) render(); else close(); });
      var first = f.querySelector('input'); if (first) first.focus();
    }
    var sel = pop.querySelector('.rz-proj-sel');
    if (sel) sel.addEventListener('change', function () { if (sel.value) { store.setActive(sel.value); apply(false); render(); publishSoon(); } });
    [].forEach.call(pop.querySelectorAll('.rz-proj-act'), function (b) {
      b.addEventListener('click', function () {
        var act = b.getAttribute('data-act'), p = store.active();
        if (act === 'pack') render('pack');
        else if (act === 'edit') render('edit');
        else if (act === 'new') { store.setActive(null); render('form'); }
        else if (act === 'duplicate' && p) {
          var dup = store.create((p.name + ' (copy)').slice(0, 80), p.inputs);
          if (dup.ok) { apply(false); render(); publishSoon(); }
        }
        else if (act === 'apply') { openedScenario = false; apply(true); render(); }
        else if (act === 'export' && p) {
          var a = d.createElement('a');
          a.href = URL.createObjectURL(new Blob([store.exportJson(p.id)], { type: 'application/json' }));
          a.download = p.name.replace(/[^\w.-]+/g, '-').slice(0, 60) + '.rz-project.json';
          d.body.appendChild(a); a.click(); a.remove();
        } else if (act === 'import') {
          var inp = pop.querySelector('.rz-proj-file');
          inp.onchange = function () {
            var file = inp.files && inp.files[0];
            if (!file || file.size > 256 * 1024) { pop.querySelector('.rz-proj-confirm').hidden = false; pop.querySelector('.rz-proj-confirm').textContent = 'That file is empty or larger than 256 KB.'; return; }
            file.text().then(function (t) { var r = store.importJson(t); if (!r.ok) { var c = pop.querySelector('.rz-proj-confirm'); c.hidden = false; c.textContent = 'Not imported: ' + r.error; return; } apply(false); render(); });
          };
          inp.click();
        } else if (act === 'delete' && p) {
          var c = pop.querySelector('.rz-proj-confirm');
          c.hidden = false;
          c.innerHTML = 'Delete "' + esc(p.name) + '" and its results from this browser? <button type="button" class="rz-proj-del rz-proj-yes">Delete</button> <button type="button" class="rz-proj-no">Keep</button>';
          c.querySelector('.rz-proj-yes').onclick = function () { store.remove(p.id); render(); };
          c.querySelector('.rz-proj-no').onclick = function () { c.hidden = true; };
          c.querySelector('.rz-proj-no').focus();
        }
      });
    });
  }
  function open() { pop.hidden = false; chip.setAttribute('aria-expanded', 'true'); render('home'); }
  function close() { pop.hidden = true; chip.setAttribute('aria-expanded', 'false'); chip.focus(); }

  function mount() {
    var head = d.querySelector('.tool-head .wrap');
    if (!head) return;
    if (!d.querySelector('link[data-rz-proj-css]')) {
      var l = d.createElement('link'); l.rel = 'stylesheet'; l.href = 'css/rz-project.css?v=' + (w.RZ_VERSION || '1'); l.setAttribute('data-rz-proj-css', ''); d.head.appendChild(l);
    }
    root = d.createElement('div'); root.className = 'rz-proj';
    root.innerHTML = '<button type="button" class="rz-proj-chip" aria-haspopup="dialog" aria-expanded="false" aria-controls="rzProjPop"></button>'
      + '<div class="rz-proj-pop" id="rzProjPop" role="dialog" aria-modal="false" aria-labelledby="rzProjTitle" hidden></div>';
    var basis = head.querySelector('.basis');
    head.insertBefore(root, basis ? basis.nextSibling : null);
    chip = root.querySelector('.rz-proj-chip'); pop = root.querySelector('.rz-proj-pop');
    chip.addEventListener('click', function () { if (pop.hidden) open(); else close(); });
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !pop.hidden) close(); });
    // composedPath is fixed at dispatch: a render() that replaced the clicked node must not read as an outside click.
    d.addEventListener('click', function (e) {
      var path = e.composedPath ? e.composedPath() : [e.target];
      if (!pop.hidden && path.indexOf(root) < 0) { pop.hidden = true; chip.setAttribute('aria-expanded', 'false'); }
    });
    render();
  }

  function start() {
    var calc = d.body && d.body.getAttribute('data-rz-calc');
    if (!calc || CALCS.indexOf(calc) < 0) return;
    if (d.body.getAttribute('data-rz-project') === 'off') return;  // per-page kill switch (PRD-P01 §22)
    // An embedded copy (sensitivity / compare iframes, ?embed=) measures; it must never read or write the project.
    var framed = false; try { framed = w.top !== w; } catch (e) { framed = true; }
    if (framed || /[?&]embed=/.test(w.location.search || '')) return;
    try { store = P.createStore(w.localStorage); } catch (e) { store = P.createStore({ getItem: function () { throw e; }, setItem: function () { throw e; }, removeItem: function () {} }); }
    fetch('data/calculators.json?v=' + (w.RZ_VERSION || '1'), { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        reg = (j && j.calculators) || [];
        entry = reg.filter(function (x) { return x.calc === calc; })[0] || null;
        if (!entry) return;
        mount();
        if (!openedScenario) apply(false);
        watchFields(); watchResults(); publishSoon();
        w.rzProject = { store: store, apply: apply, entry: entry };
      }, function (e) { if (w.console) console.warn('rz-project: registry not loaded', e); });
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start); else start();
})(typeof window !== 'undefined' ? window : null, typeof document !== 'undefined' ? document : null);
