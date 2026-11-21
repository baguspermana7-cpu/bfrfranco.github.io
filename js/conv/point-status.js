/*
 * point-status.js — window.RZPointStatus: every number shows its state (PRD-CONV-POINT-STATUS-TREND §4, §6).
 *
 *   limits(id)              the registry row for a point (data/conv-parameters.json `limits`, browser twin
 *                           window.RZ_CONV_PARAMETERS.limits) or null. A page never types a limit (P-1).
 *   classify(v, L, prev)    -> 'ok' | 'warn' | 'alarm' | 'info' (no limits) | 'none' (no value). ISA-18.2 deadband (§4.2):
 *                           warn at v > hi_warn, alarm at v > hi_alarm; back to warn only when v < hi_alarm − db, back to
 *                           normal only when v < hi_warn − db; the low side mirrors it; any bound may be null.
 *                           prev = the previous state string or { state, dir }. Pure: Node-testable.
 *   evaluate(v, L, prev)    -> { state, dir: 'hi' | 'lo' | null } (the direction picks ▲ or ▼)
 *   apply(el, id, value)    writes data-pt-state / data-pt-dir / data-pt-value, aria-label and the tooltip text. Attributes
 *                           are written only when they change (the sheet restyles every scan: perf, PRD §9).
 *   bindAll(root)           every [data-point="<id>"] under root: registered with RZTrend (pen def from the element and the
 *                           limits, amp bounded by RZConvHistory.bounded so a normal point has a normal past, P-6), made a
 *                           button (tabindex 0, role button, data-trend), state applied from its text.
 *   setLimits(rows)         replaces the limits table (Node gates, fixtures). load order: setLimits > RZ_CONV_PARAMETERS.
 *   define(id, L)           explicit limits for a point that is not in the registry (e.g. a DC AI point). L has the registry
 *                           shape { lo_alarm, lo_warn, hi_warn, hi_alarm, deadband, basis, evidenceClass, source }; bad bound
 *                           order throws. fromSimple({ warn, alarm, kind: 'high' | 'low' | 'window', deadband?, lowWarn?,
 *                           lowAlarm?, ...meta }) -> L (high -> hi_*, low -> lo_*, window -> both, the low side from
 *                           lowWarn / lowAlarm); same order law, throws on bad bounds.
 *   Precedence of limits(id): a database row (Supabase conv_points, PRD §5b) > define() > the shipped registry — except
 *                           that a database row never overrides a define() of an id the shipped conv registry does not
 *                           know (the database holds conv ids only).
 *   Database (§5b): after first paint the conv_points rows are read through window.rzSupa.getConvPoints() (5 min
 *                           sessionStorage cache rz_conv_points_v1). Only rows that pass the order law are used; Supabase
 *                           down or not configured = the shipped registry. Bound elements are restyled and the event
 *                           'rz-point-limits' fires when the rows arrive. limitsSource() = 'database' | 'cache' | 'shipped';
 *                           dbIds() = { id: true } of the database points (null before they load) — RZTrend asks the
 *                           database for the history of those ids only.
 *   tooltipText(id, value)  "Name · value unit · State · warn X · alarm Y unit · limits ASSUMED · Click for trend"
 *
 * Colour lives in css/conv-point.css (--rz-pt-ok / --rz-pt-warn / --rz-pt-alarm). Colour is never the only cue (P-4): the
 * glyph (▲ ▼ ◆) comes from data-pt-state + data-pt-dir in CSS, the state word is in aria-label and in the tooltip.
 */
(function (root) {
  'use strict';
  var TABLE = null, DEFINED = {}, DBL = null, DBIDS = null, DBSRC = 'shipped', STATES = { ok: 'Normal', warn: 'Warning', alarm: 'Alarm', info: 'Informational', none: 'No data' };
  function isNum(n) { return typeof n === 'number' && isFinite(n); }

  function rows() {
    if (TABLE) return TABLE;
    var src = root && root.RZ_CONV_PARAMETERS && root.RZ_CONV_PARAMETERS.limits;
    if (!src) return null;
    setLimits(src);
    return TABLE;
  }
  function setLimits(list) {
    TABLE = {};
    (list || []).forEach(function (r) { if (r && r.id) TABLE[r.id] = r; });
  }
  function limits(id) {
    var t = rows(), reg = t && t[id] ? t[id] : null, def = DEFINED[id] || null, db = DBL && DBL[id] ? DBL[id] : null;
    if (db && (reg || !def)) return db;
    return def || reg;
  }

  /* the order law of the registry, the database check constraint and the core gate: lo_alarm <= lo_warn < hi_warn <= hi_alarm */
  var BOUNDS = ['lo_alarm', 'lo_warn', 'hi_warn', 'hi_alarm'];
  function boundsError(L) {
    if (!L || typeof L !== 'object') return 'limits must be an object';
    var i, j, k, any = false;
    for (i = 0; i < BOUNDS.length; i++) {
      k = L[BOUNDS[i]];
      if (k !== null && k !== undefined && !isNum(k)) return BOUNDS[i] + ' is not a number';
      if (isNum(k)) any = true;
    }
    if (!any) return 'no bound set';
    for (i = 0; i < BOUNDS.length; i++) for (j = i + 1; j < BOUNDS.length; j++) {
      var a = L[BOUNDS[i]], b = L[BOUNDS[j]];
      if (!isNum(a) || !isNum(b)) continue;
      var strict = !(i === 0 && j === 1) && !(i === 2 && j === 3);
      if (strict ? !(a < b) : !(a <= b)) return BOUNDS[i] + ' ' + a + (strict ? ' must be < ' : ' must be <= ') + BOUNDS[j] + ' ' + b;
    }
    if (L.deadband !== null && L.deadband !== undefined && !(isNum(L.deadband) && L.deadband >= 0)) return 'deadband must be >= 0';
    return null;
  }
  function copy(o) { var out = {}, k; for (k in o) if (Object.prototype.hasOwnProperty.call(o, k)) out[k] = o[k]; return out; }
  function define(id, L) {
    if (!id || typeof id !== 'string') throw new Error('RZPointStatus.define: id required');
    var e = boundsError(L); if (e) throw new Error('RZPointStatus.define(' + id + '): ' + e);
    var c = copy(L); c.id = id;
    if (!c.evidenceClass) c.evidenceClass = 'ASSUMED';
    DEFINED[id] = c;
    return c;
  }
  function fromSimple(o) {
    o = o || {};
    var kind = o.kind || 'high', L = { lo_alarm: null, lo_warn: null, hi_warn: null, hi_alarm: null }, k;
    if (kind !== 'high' && kind !== 'low' && kind !== 'window') throw new Error('RZPointStatus.fromSimple: kind must be high, low or window');
    if (kind === 'high' || kind === 'window') { L.hi_warn = isNum(o.warn) ? o.warn : null; L.hi_alarm = isNum(o.alarm) ? o.alarm : null; }
    if (kind === 'low') { L.lo_warn = isNum(o.warn) ? o.warn : null; L.lo_alarm = isNum(o.alarm) ? o.alarm : null; }
    if (kind === 'window') { L.lo_warn = isNum(o.lowWarn) ? o.lowWarn : null; L.lo_alarm = isNum(o.lowAlarm) ? o.lowAlarm : null; }
    for (k in o) if (Object.prototype.hasOwnProperty.call(o, k) && ['warn', 'alarm', 'kind', 'lowWarn', 'lowAlarm', 'deadband'].indexOf(k) < 0) L[k] = o[k];
    var e = boundsError(L); if (e) throw new Error('RZPointStatus.fromSimple: ' + e);
    L.deadband = isNum(o.deadband) ? o.deadband : deadband(L);
    if (!L.evidenceClass) L.evidenceClass = 'ASSUMED';
    if (L.basis === undefined) L.basis = '';
    return L;
  }

  /* ── database rows (conv_points, PRD §5b) ──────────────────────────────────────────────────────────────────── */
  var CACHE_KEY = 'rz_conv_points_v1', CACHE_TTL_MS = 5 * 60 * 1000, FETCH_TIMEOUT_MS = 6000, inflight = null;
  function fromDb(r) {
    if (!r || typeof r.id !== 'string') return null;
    var reg = TABLE && TABLE[r.id] ? TABLE[r.id] : null, L = reg ? copy(reg) : { id: r.id };
    BOUNDS.forEach(function (k) { L[k] = isNum(r[k]) ? r[k] : null; });
    L.deadband = isNum(r.deadband) ? r.deadband : null;
    if (r.label) L.label = r.label;
    if (r.unit !== undefined && r.unit !== null) L.unit = r.unit;
    if (r.basis) L.basis = r.basis;
    if (r.evidence_class) L.evidenceClass = r.evidence_class;
    if (r.source_ref || r.source_as_of) L.source = { ref: r.source_ref || '', asOf: r.source_as_of || '' };
    L.db = true;
    return boundsError(L) ? null : L;
  }
  function setDbRows(list, src) {
    rows();
    var map = {}, ids = {};
    (list || []).forEach(function (r) { if (!r || typeof r.id !== 'string') return; ids[r.id] = true; var L = fromDb(r); if (L) map[r.id] = L; });
    DBL = map; DBIDS = ids; DBSRC = src || 'database';
    var doc = root && root.document;
    if (doc && doc.querySelectorAll) {
      var list2 = doc.querySelectorAll('[data-point]');
      for (var i = 0; i < list2.length; i++) { var pe = list2[i]; if (pe.getAttribute('data-point')) apply(pe, pe.getAttribute('data-point')); }
      try { root.dispatchEvent(new root.CustomEvent('rz-point-limits', { detail: { source: DBSRC } })); } catch (e) { /* old browser */ }
    }
  }
  function dbConfigured() {
    if (!root) return false;
    if (root.rzSupa) return !!root.rzSupa.configured;
    var c = root.RZ_CONFIG;
    return !!(c && c.SUPABASE_URL && c.SUPABASE_ANON && root._rzAuth && typeof root._rzAuth.ensureSupabase === 'function');
  }
  function loadSupa() {
    if (root.rzSupa && root.rzSupa.ready) return root.rzSupa.ready;
    if (root._rzAuth && typeof root._rzAuth.ensureSupabase === 'function') return root._rzAuth.ensureSupabase();
    return Promise.resolve(null);
  }
  function readCache() {
    try {
      var c = JSON.parse(root.sessionStorage.getItem(CACHE_KEY) || 'null'), age;
      if (!c || typeof c.t !== 'number' || !Array.isArray(c.rows)) return null;
      age = Date.now() - c.t;
      if (age < -60000 || age > CACHE_TTL_MS) return null;   /* stale or from the future: ask again */
      return c.rows;
    } catch (e) { return null; }
  }
  function refreshDb() {
    if (inflight) return inflight;
    inflight = new Promise(function (resolve) {
      var done = false;
      function fin(v) { if (!done) { done = true; inflight = null; resolve(v); } }
      setTimeout(function () { fin(false); }, FETCH_TIMEOUT_MS);
      Promise.resolve().then(loadSupa).then(function (supa) {
        if (!supa || !supa.configured || typeof supa.getConvPoints !== 'function') return fin(false);
        return Promise.resolve(supa.getConvPoints()).then(function (res) {
          if (done) return;
          if (!res || res.error || !Array.isArray(res.data) || !res.data.length) return fin(false);
          setDbRows(res.data, 'database');
          try { root.sessionStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), rows: res.data })); } catch (e) { /* storage blocked */ }
          fin(true);
        });
      }).catch(function () { fin(false); });
    });
    return inflight;
  }
  function bootDb() {
    var doc = root && root.document; if (!doc) return;
    function go() {
      var cached = readCache();
      if (cached) { setDbRows(cached, 'cache'); return; }
      if (dbConfigured()) { setTimeout(refreshDb, 0); return; }
      root.addEventListener('rz-supa-ready', function once() { root.removeEventListener('rz-supa-ready', once); if (dbConfigured()) refreshDb(); });
    }
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', function () { setTimeout(go, 0); });
    else setTimeout(go, 0);   /* after first paint, never blocking it */
  }

  function deadband(L) {
    if (isNum(L.deadband) && L.deadband >= 0) return L.deadband;
    var hi = isNum(L.hi_alarm) ? L.hi_alarm : L.hi_warn, lo = isNum(L.lo_alarm) ? L.lo_alarm : L.lo_warn;
    if (isNum(hi) && isNum(lo)) return Math.abs(hi - lo) * 0.01;
    return Math.abs(isNum(hi) ? hi : isNum(lo) ? lo : 0) * 0.01;
  }
  function evaluate(v, L, prev) {
    if (!isNum(v)) return { state: 'none', dir: null };
    if (!L) return { state: 'info', dir: null };
    var db = deadband(L), ps = prev && typeof prev === 'object' ? prev.state : prev, pd = prev && typeof prev === 'object' ? prev.dir : null;
    var wasAlarm = ps === 'alarm', wasOff = ps === 'warn' || ps === 'alarm';
    if (isNum(L.hi_alarm) && (v > L.hi_alarm || (wasAlarm && pd !== 'lo' && v >= L.hi_alarm - db))) return { state: 'alarm', dir: 'hi' };
    if (isNum(L.lo_alarm) && (v < L.lo_alarm || (wasAlarm && pd !== 'hi' && v <= L.lo_alarm + db))) return { state: 'alarm', dir: 'lo' };
    if (isNum(L.hi_warn) && (v > L.hi_warn || (wasOff && pd !== 'lo' && v >= L.hi_warn - db))) return { state: 'warn', dir: 'hi' };
    if (isNum(L.lo_warn) && (v < L.lo_warn || (wasOff && pd !== 'hi' && v <= L.lo_warn + db))) return { state: 'warn', dir: 'lo' };
    return { state: 'ok', dir: null };
  }
  function classify(v, L, prev) { return evaluate(v, L, prev).state; }

  function num(x, d) { return isNum(x) ? (isNum(d) ? x.toFixed(d) : String(+x.toFixed(6))) : '—'; }
  function pair(lo, hi) {
    if (isNum(lo) && isNum(hi)) return num(lo) + ' / ' + num(hi);
    if (isNum(hi)) return num(hi);
    if (isNum(lo)) return '< ' + num(lo);
    return null;
  }
  function tooltipText(id, value, opts) {
    var L = limits(id), o = opts || {}, unit = o.unit != null ? o.unit : (L ? L.unit : ''), name = o.label || (L && L.label) || id;
    var ev = evaluate(value, L, o.prev), parts = [name, (isNum(value) ? num(value, o.digits) : '—') + (unit ? ' ' + unit : ''), STATES[ev.state]];
    if (L) {
      var w = pair(L.lo_warn, L.hi_warn), a = pair(L.lo_alarm, L.hi_alarm);
      if (w) parts.push('warn ' + w + (a ? '' : (unit ? ' ' + unit : '')));
      if (a) parts.push('alarm ' + a + (unit ? ' ' + unit : ''));
      parts.push('limits ' + L.evidenceClass);
    }
    parts.push('Click for trend');
    return parts.join(' · ');
  }

  function setAttr(el, k, v) { if (v === null) { if (el.hasAttribute(k)) el.removeAttribute(k); } else if (el.getAttribute(k) !== v) el.setAttribute(k, v); }
  function parseValue(el) {
    var t = (el.textContent || '').replace(/,/g, ''), m = /-?\d+(?:\.\d+)?/.exec(t);
    return m ? parseFloat(m[0]) : null;
  }
  function digitsOf(el) {
    var d = el.getAttribute('data-pt-digits'); if (d !== null && d !== '') return +d;
    var m = /-?\d+(?:\.(\d+))?/.exec((el.textContent || '').replace(/,/g, '')); return m && m[1] ? m[1].length : 0;
  }
  /* SVG text has no ::after: the glyph is a tspan the function keeps in place (a page that rewrites the text drops it) */
  var GLYPH = { warn: { hi: '▲', lo: '▼' }, alarm: { hi: '◆', lo: '◆' } };
  function svgGlyph(el, ev) {
    if (!el.namespaceURI || el.namespaceURI.indexOf('svg') < 0) return;
    var g = el.querySelector && el.querySelector('tspan.rz-pt-g'), ch = ev.state === 'warn' || ev.state === 'alarm' ? ' ' + GLYPH[ev.state][ev.dir || 'hi'] : '';
    /* T2: a normal point with limits keeps an invisible glyph (class rz-pt-g-off) so a middle- or end-anchored label does not
       move when it turns (a start-anchored label never moves: the glyph only appears after it) */
    var anc = el.getAttribute('text-anchor'), off = !ch && ev.state === 'ok' && (anc === 'middle' || anc === 'end');
    if (!ch && !off) { if (g) g.parentNode.removeChild(g); return; }
    if (!g) { g = el.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'tspan'); g.setAttribute('aria-hidden', 'true'); el.appendChild(g); }
    setAttr(g, 'class', off ? 'rz-pt-g rz-pt-g-off' : 'rz-pt-g');
    if (off) ch = ' ' + GLYPH.warn.hi;
    if (g.textContent !== ch) g.textContent = ch;
  }
  function apply(el, id, value) {
    if (!el) return null;
    var L = limits(id), prev = { state: el.getAttribute('data-pt-state'), dir: el.getAttribute('data-pt-dir') };
    var v = isNum(value) ? value : parseValue(el), ev = evaluate(v, L, prev);
    setAttr(el, 'data-pt-state', ev.state);
    setAttr(el, 'data-pt-dir', ev.dir);
    setAttr(el, 'data-pt-value', isNum(v) ? String(v) : null);
    var unit = el.getAttribute('data-pt-unit') || (L ? L.unit : ''), name = el.getAttribute('data-pt-label') || (L && L.label) || id;
    var d = digitsOf(el);
    setAttr(el, 'aria-label', name + ': ' + (isNum(v) ? num(v, d) : 'no data') + (unit && isNum(v) ? ' ' + unit : '') + ', ' + STATES[ev.state] + (ev.dir ? (ev.dir === 'hi' ? ' high' : ' low') : '') + '. Open trend.');
    setAttr(el, 'data-pt-tip', tooltipText(id, v, { unit: unit, label: name, digits: d, prev: prev }));
    svgGlyph(el, ev);
    return ev;
  }

  /* ── tooltip: one node, shown on hover or focus of a point, text from data-pt-tip ─────────────────────────────── */
  var tip = null;
  function showTip(el) {
    var doc = el.ownerDocument, text = el.getAttribute('data-pt-tip'); if (!text) return;
    if (!tip) { tip = doc.createElement('div'); tip.className = 'rz-pt-tip'; tip.setAttribute('role', 'tooltip'); tip.id = 'rz-pt-tip'; doc.body.appendChild(tip); }
    tip.textContent = text; tip.hidden = false;
    var b = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight, vw = doc.documentElement.clientWidth;
    var vh = doc.documentElement.clientHeight, x = Math.max(8, Math.min(vw - w - 8, b.left)), y = b.bottom + 6;
    if (y + h > vh - 8) y = b.top - h - 6;   /* below the number, so its label above stays readable */
    tip.style.left = Math.round(x) + 'px'; tip.style.top = Math.round(y) + 'px';
    el.setAttribute('aria-describedby', 'rz-pt-tip');
  }
  function hideTip() { if (tip) tip.hidden = true; }

  function syncFlat(doc) {
    var flat = false;
    try { flat = !!(root.RZHmiSheet && root.RZHmiSheet.shadeMode && root.RZHmiSheet.shadeMode() === 'flat'); } catch (e) { flat = false; }
    setAttr(doc.documentElement, 'data-pt-flat', flat ? '1' : null);
  }

  function register(el, id) {
    var T = root.RZTrend, H = root.RZConvHistory; if (!T) return;
    var L = limits(id), v = parseValue(el), base = isNum(v) ? v : (L && L.nominal ? L.nominal.value : null);
    if (!isNum(base)) return;
    var a = el.getAttribute('data-pt-amp'), def = {
      id: id, label: el.getAttribute('data-pt-label') || (L && L.label) || id, unit: el.getAttribute('data-pt-unit') || (L ? L.unit : ''),
      base: base, amp: a !== null && a !== '' ? +a : Math.abs(base) * 0.03, digits: digitsOf(el), shape: el.getAttribute('data-pt-shape') || 'load',
      cls: el.getAttribute('data-pt-cls') === 'ENGINE' ? 'ENGINE' : 'SIM', group: el.getAttribute('data-pt-group') || 'Points'
    };
    if (def.cls === 'ENGINE') def.ref = base;
    T.register([H && H.bounded && L ? H.bounded(def, L) : def]);
  }
  var bound = false;
  function bindAll(scope) {
    var host = scope || (root && root.document); if (!host) return 0;
    var doc = host.ownerDocument || host, list = host.querySelectorAll('[data-point]'), n = 0;
    for (var i = 0; i < list.length; i++) {
      var el = list[i], id = el.getAttribute('data-point'); if (!id) continue;
      if (!el.hasAttribute('data-trend')) { register(el, id); el.setAttribute('data-trend', id); }
      if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
      if (!el.hasAttribute('role')) el.setAttribute('role', 'button');
      /* T3: one tooltip — an empty title stops a parent's native title from showing over the point's own tooltip */
      if (!el.hasAttribute('title') && el.parentElement && el.parentElement.closest('[title]')) el.setAttribute('title', '');
      apply(el, id); n++;
    }
    syncFlat(doc);
    if (!bound) {
      bound = true;
      doc.addEventListener('mouseover', function (e) { var t = e.target.closest && e.target.closest('[data-point]'); if (t) showTip(t); });
      doc.addEventListener('mouseout', function (e) { var t = e.target.closest && e.target.closest('[data-point]'); if (t && !(e.relatedTarget && t.contains(e.relatedTarget))) hideTip(); });
      doc.addEventListener('focusin', function (e) { var t = e.target.closest && e.target.closest('[data-point]'); if (t) showTip(t); else hideTip(); });
      doc.addEventListener('focusout', hideTip);
      doc.addEventListener('keydown', function (e) { if (e.key === 'Escape') hideTip(); });
      doc.addEventListener('click', function (e) { hideTip(); if (e.target.closest && e.target.closest('[data-shade-btn]')) setTimeout(function () { syncFlat(doc); }, 0); }, true);
    }
    return n;
  }

  var API = { limits: limits, classify: classify, evaluate: evaluate, apply: apply, bindAll: bindAll, setLimits: setLimits,
    tooltipText: tooltipText, STATES: STATES, define: define, fromSimple: fromSimple, boundsError: boundsError,
    setDbRows: setDbRows, refreshDb: refreshDb, dbIds: function () { return DBIDS; }, limitsSource: function () { return DBSRC; },
    version: '1.1.0' };
  if (root) { root.RZPointStatus = API; bootDb(); }
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : null);
