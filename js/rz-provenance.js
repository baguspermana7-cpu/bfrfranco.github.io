/* RZProvenance — one line under a panel that says what kind of number it shows (PRD-Q06 §10–§11).
   Kinds: simulated, snapshot, model, fallback. There is no "measured" or "telemetry" kind.
   Text is written with textContent only; a repeated identical mark() touches nothing. Guard: window.__rzProvenance. */
(function (root) {
  'use strict';
  var KINDS = Object.freeze({ simulated: 'Simulated', snapshot: 'Snapshot', model: 'Model output', fallback: 'Fallback' });
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var ASOF = /^\d{4}(-\d{2}(-\d{2}(T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:\d{2}))?)?)?$/;
  var VER = /^[0-9A-Za-z.\-]+$/;
  var ATTR = { kind: 'data-rz-provenance', basis: 'data-rz-prov-basis', asOf: 'data-rz-prov-asof',
    source: 'data-rz-prov-source', version: 'data-rz-prov-version', reason: 'data-rz-prov-reason' };
  var FIELDS = ['kind', 'basis', 'asOf', 'source', 'version', 'reason'];

  function str(v) { return typeof v === 'string' ? v : ''; }
  function err(code, field, message) { return { code: code, field: field, message: message }; }

  function validate(rec) {
    var e = [];
    rec = rec || {};
    var kind = rec.kind, basis = str(rec.basis), snap = kind === 'snapshot';
    if (!Object.prototype.hasOwnProperty.call(KINDS, kind)) e.push(err('E_KIND', 'kind', 'unknown or missing kind'));
    if (!basis || basis.length > 200 || /[<>]/.test(basis)) e.push(err('E_BASIS', 'basis', 'basis missing, too long, or contains < or >'));
    if (rec.asOf != null || snap) {
      if (!ASOF.test(str(rec.asOf))) e.push(err('E_ASOF', 'asOf', 'asOf missing on a snapshot or not in the allowed format'));
    }
    if (rec.source != null || snap) {
      var s = str(rec.source);
      if (!s || s.length > 200 || /[<>]/.test(s)) e.push(err('E_SOURCE', 'source', 'source missing on a snapshot or invalid'));
    }
    if (rec.version != null || snap) {
      var v = str(rec.version);
      if (!v || v.length > 40 || !VER.test(v)) e.push(err('E_VERSION', 'version', 'version missing on a snapshot or bad characters'));
    }
    if (rec.reason != null) {
      var r = str(rec.reason);
      if (!r || r.length > 200 || /[<>]/.test(r)) e.push(err('E_BASIS', 'reason', 'reason empty, too long, or contains < or >'));
    }
    return { ok: e.length === 0, errors: e };
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function fmtDate(a) {
    var y = a.slice(0, 4);
    if (a.length === 4) return y;
    var mon = MON[parseInt(a.slice(5, 7), 10) - 1];
    if (a.length === 7) return mon + ' ' + y;
    var out = parseInt(a.slice(8, 10), 10) + ' ' + mon + ' ' + y;
    if (a.length === 10) return out;
    var t = a.slice(11), hm = t.slice(0, 5), z = t.replace(/^\d{2}:\d{2}(:\d{2})?/, '');
    var zone = z === 'Z' ? 'UTC' : z === '+07:00' ? 'WIB' : 'UTC' + z;
    return out + ', ' + hm + ' ' + zone;
  }

  /* line := WORD " · " basis [" · as of " date] [" · " source] [" · data " version] [" · " reason] */
  function tail(rec) {
    var t = ' \u00b7 ' + rec.basis;
    if (rec.asOf) t += ' \u00b7 as of ' + fmtDate(rec.asOf);
    if (rec.source) t += ' \u00b7 ' + rec.source;
    if (rec.version) t += ' \u00b7 data ' + rec.version;
    if (rec.reason) t += ' \u00b7 ' + rec.reason;
    return t;
  }

  function format(rec) {
    try { return validate(rec).ok ? KINDS[rec.kind] + tail(rec) : ''; } catch (x) { return ''; }
  }

  function fromElement(el) {
    var rec = {};
    if (!el || !el.getAttribute) return rec;
    for (var i = 0; i < FIELDS.length; i++) {
      var v = el.getAttribute(ATTR[FIELDS[i]]);
      if (v != null) rec[FIELDS[i]] = v;
    }
    return rec;
  }

  function resolve(target) {
    if (typeof target !== 'string') return target && target.nodeType === 1 ? target : null;
    var d = root.document;
    if (!d) return null;
    return d.getElementById(target.charAt(0) === '#' ? target.slice(1) : target) || d.querySelector(target);
  }

  function sig(rec) {
    var s = [];
    for (var i = 0; i < FIELDS.length; i++) s.push(rec[FIELDS[i]] == null ? '' : String(rec[FIELDS[i]]));
    return s.join('\u0001');
  }

  function paint(el, rec) {
    for (var i = 0; i < FIELDS.length; i++) {
      var f = FIELDS[i];
      if (rec[f] == null || rec[f] === '') el.removeAttribute(ATTR[f]);
      else el.setAttribute(ATTR[f], String(rec[f]));
    }
    var d = el.ownerDocument;
    while (el.firstChild) el.removeChild(el.firstChild);
    var b = d.createElement('b');
    b.textContent = KINDS[rec.kind];
    el.appendChild(b);
    el.appendChild(d.createTextNode(tail(rec)));
  }

  function emit(el, kind, prev) {
    var d = el.ownerDocument, CE = d.defaultView && d.defaultView.CustomEvent;
    if (!CE) return;
    d.dispatchEvent(new CE('rz-provenance-change', { detail: { id: el.id, kind: kind, previousKind: prev } }));
  }

  function mark(target, rec) {
    var el = resolve(target);
    if (!el) { warn('E_TARGET', target); return null; }
    var v = validate(rec);
    if (!v.ok) { warn(v.errors[0].code, el.id); return null; }
    var s = sig(rec);
    if (el.__rzProvSig === s) return el;
    if (!el.__rzProvAuthored) {
      el.__rzProvAuthored = { rec: fromElement(el), text: el.textContent };
    }
    var prev = el.getAttribute(ATTR.kind);
    paint(el, rec);
    el.__rzProvSig = s;
    emit(el, rec.kind, prev);
    return el;
  }

  function clear(target) {
    var el = resolve(target);
    if (!el) { warn('E_TARGET', target); return null; }
    var a = el.__rzProvAuthored;
    if (!a) return el;
    var prev = el.getAttribute(ATTR.kind);
    if (validate(a.rec).ok) paint(el, a.rec);
    else { for (var i = 0; i < FIELDS.length; i++) el.removeAttribute(ATTR[FIELDS[i]]); el.textContent = a.text; }
    el.__rzProvSig = null;
    el.__rzProvAuthored = null;
    emit(el, a.rec.kind, prev);
    return el;
  }

  function norm(t) { return String(t || '').replace(/\s+/g, ' ').trim(); }

  function audit(scope) {
    scope = scope || root.document;
    var out = [];
    if (!scope || !scope.querySelectorAll) return out;
    var els = scope.querySelectorAll('[' + ATTR.kind + ']');
    for (var i = 0; i < els.length; i++) {
      var el = els[i], rec = fromElement(el), v = validate(rec), errors = v.errors.slice();
      if (v.ok && norm(el.textContent) !== norm(format(rec))) errors.push(err('E_TEXT', 'text', 'rendered text differs from format()'));
      out.push({ id: el.id, kind: rec.kind, ok: errors.length === 0, errors: errors });
    }
    return out;
  }

  function warn(code, where) {
    if (root.console && root.console.warn) root.console.warn('[RZProvenance] ' + code + ' ' + (where || ''));
  }

  var CSS = '.rz-prov{margin:4px 0 8px;font:400 12px/1.5 var(--rz-font-mono,\'JetBrains Mono\',\'SF Mono\',ui-monospace,monospace);' +
    'letter-spacing:.02em;color:var(--rz-text-secondary,#A0AEC0);max-width:100%;overflow-wrap:anywhere}' +
    '.rz-prov b{font-weight:600;color:var(--rz-text-primary,#E8EDF5)}' +
    '.rz-prov[data-rz-provenance="fallback"] b{color:var(--rz-text-accent,#FFAA00)}' +
    '[data-theme="light"] .rz-prov{color:#374151}[data-theme="light"] .rz-prov b{color:#111827}' +
    /* Light ink only under an explicit [data-theme="light"]: six cockpits are dark-only and never set data-theme,
       so an OS light preference must not turn the line grey-on-graphite (found in T-5 screenshots). */
    '[data-theme="light"] .rz-prov[data-rz-provenance="fallback"] b{color:#7A4800}';

  var api = { version: '1.0.0', KINDS: KINDS, format: format, validate: validate, fromElement: fromElement,
    mark: mark, clear: clear, audit: audit };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root.document && !root.__rzProvenance) {
    root.__rzProvenance = true;
    var st = root.document.createElement('style');
    st.id = 'rz-provenance-css';
    st.textContent = CSS;
    (root.document.head || root.document.documentElement).appendChild(st);
    root.RZProvenance = api;
  }
})(typeof window !== 'undefined' ? window : this);
