/* js/datahall-ai/sp-inspector.js — PRD-SETPOINT-SIM §C P5/P6: the DC AI inspector shows what each controller of the opened
 * unit holds (SP, live value, error, the controller), from the control registry, through the one block js/rz-sp-block.js.
 *
 * Wiring: js/rz-inspector.js fires 'rz-inspector-payload' on document after each render (open and every refresh) with
 * detail { payload, body }. This file appends the block to body for payload.classId ('dcai:' + classId in the registry
 * twin) and binds it:
 *   live(pvId)        -> payload.n(point) of the opened unit (the number the inspector itself shows), else '—'
 *   recompute(p, v)   -> DCAI_CALC.compute on a structured copy of DCAI_CALC.model with that one parameter changed
 *                        (v === null: unchanged); the live model is never touched (P6 what-if)
 * No registry, no block (no throw). Nothing is stored.
 */
(function (root) {
  'use strict';
  /* only what a controller of THIS class holds; a reference value (nameplate, a temperature another unit sets) is
     already a live row of the inspector and is not repeated here */
  function rows(classId) {
    var C = root && root.RZControlPoints;
    return (C && C.forClass ? C.forClass('dcai:' + classId) : []).filter(function (r) { return r.role === 'setpoint'; });
  }
  /* the inspector is ~360 px wide (a sheet on a phone): Setpoint · SP · Live · Error; the band, range, evidence and
     controller ride in the row's title (owner 2026-11-12: less visible text, details on hover). Ink only, no wash. */
  /* the inspector is always the dark slate panel (js/rz-inspector.js); the DC AI page has no equipment-modal tokens, so
     the ones the sequence view (and RZDiagram through it) draws with are set here to that panel's palette (else paper
     and ink resolve black) */
  var CSS = '.rz-inspector-sp{margin:10px 0 0;--cvm-bg:#0f172a;--cvm-panel:#16213a;--cvm-text:#e2e8f0;--cvm-mute:#94a3b8;' +
      '--cvm-line:rgba(255,255,255,.12);--cvm-acc:#e8b563;--o:#e8b563;--c:#67e8f9;--g:#4ade80;--r:#fca5a5}' +
    '.rz-inspector-sp .rz-cvm-sp-wrap{overflow-x:auto;max-width:100%}' +
    '.rz-inspector-sp table{width:100%;border-collapse:collapse;table-layout:auto;font:12px/1.35 IBM Plex Sans,sans-serif;color:inherit}' +
    '.rz-inspector-sp th,.rz-inspector-sp td{padding:4px 6px 4px 0;border-bottom:1px solid rgba(255,255,255,.12);text-align:left;vertical-align:top;font-weight:400}' +
    '.rz-inspector-sp thead th{font-size:10.5px;color:#94a3b8;white-space:nowrap}' +
    '.rz-inspector-sp th[scope="row"]{white-space:normal}' +
    '.rz-inspector-sp td[data-k="sp"],.rz-inspector-sp td[data-k="pv"],.rz-inspector-sp td[data-k="err"],.rz-inspector-sp .rz-cvm-wi-t td{font-family:JetBrains Mono,IBM Plex Mono,monospace;white-space:nowrap}' +
    '.rz-inspector-sp [data-k="band"],.rz-inspector-sp [data-k="adj"],.rz-inspector-sp [data-k="ev"],.rz-inspector-sp [data-k="ctl"]{display:none}' +
    '.rz-inspector-sp .rz-cvm-wi{margin:10px 0 0;padding:8px 0 0;border-top:1px solid rgba(255,255,255,.12)}' +
    '.rz-inspector-sp .rz-cvm-wi-ctl label{display:grid;gap:4px;font-size:11.5px}' +
    '.rz-inspector-sp .rz-cvm-wi-ctl input[type="range"]{width:100%;accent-color:#e8b563}' +
    '.rz-inspector-sp .rz-cvm-wi-ctl{display:grid;grid-template-columns:1fr auto;gap:4px 8px;align-items:end}' +
    '.rz-inspector-sp .rz-cvm-wi-ctl label{grid-column:1/-1}' +
    '.rz-inspector-sp output{font:12px JetBrains Mono,monospace}' +
    '.rz-inspector-sp [data-wi-active] output{color:#e3a6c6}' +
    '.rz-inspector-sp button[data-wi-reset]{min-height:28px;padding:2px 10px;border:1px solid rgba(255,255,255,.25);border-radius:3px;background:transparent;color:inherit;font:inherit;font-size:11px;cursor:pointer}' +
    '.rz-inspector-sp button[data-wi-reset]:focus-visible,.rz-inspector-sp input:focus-visible{outline:2px solid #e8b563;outline-offset:2px}' +
    /* what-if in ~360 px: Output · Engine now · SIMULATED; the change is the difference of the two shown, so it goes */
    '.rz-inspector-sp .rz-cvm-wi-t [data-k="d"]{display:none}' +
    '.rz-inspector-sp .rz-cvm-wi-t td{white-space:normal}' +
    '.rz-inspector-sp [data-rz-cliff] td,.rz-inspector-sp [data-rz-cliff] th{white-space:nowrap}' +
    '.rz-inspector-sp .rz-cvm-wi-t th[scope="row"]{width:42%}' +
    '.rz-inspector-sp caption{caption-side:top;text-align:left;padding:8px 0 4px;font-size:11px;color:#94a3b8}' +
    '.rz-inspector-sp [data-mode="mechanical"]{color:#fca5a5}' +
    '.rz-inspector-sp tr[data-design-bin] th,.rz-inspector-sp tr[data-design-bin] td{border-top:1px solid rgba(255,255,255,.45);border-bottom:1px solid rgba(255,255,255,.45)}' +
    '.rz-inspector-sp td[data-wi-clamped]{text-decoration:underline dotted;cursor:help}' +
    '.rz-inspector-sp .rz-cvm-note{margin:6px 0 0;font-size:11px;line-height:1.4;color:#94a3b8}' +
    /* P7 the step table in ~360 px: one step = one block, each value with its column name; Available and Capacity
       (running × unit) go, the Short column keeps what is missing */
    '.rz-inspector-sp .rz-cvm-seq-t thead,.rz-inspector-sp .rz-cvm-seq-t [data-k="avail"],.rz-inspector-sp .rz-cvm-seq-t [data-k="cap"]{display:none}' +
    '.rz-inspector-sp .rz-cvm-seq-t,.rz-inspector-sp .rz-cvm-seq-t tbody{display:block}' +
    '.rz-inspector-sp .rz-cvm-seq-t tr:not([hidden]){display:flex;flex-wrap:wrap;gap:2px 12px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.12)}' +
    '.rz-inspector-sp .rz-cvm-seq-t tr > *{display:block;border:0;padding:0;white-space:nowrap}' +
    '.rz-inspector-sp .rz-cvm-seq-t th[scope="row"]{flex:1 0 100%;white-space:normal;font-weight:600}' +
    '.rz-inspector-sp .rz-cvm-seq-t td::before{content:attr(data-l) " ";color:#94a3b8;font-family:IBM Plex Sans,sans-serif;font-size:10.5px}' +
    '.rz-inspector-sp .rz-cvm-seq-t caption{display:block}' +
    '.rz-inspector-sp .rz-cvm-seq-fig{max-width:100%!important;overflow-x:auto}';
  function style(doc) {
    if (doc.getElementById('rz-inspector-sp-css')) return;
    var st = doc.createElement('style'); st.id = 'rz-inspector-sp-css'; st.textContent = CSS; doc.head.appendChild(st);
  }
  function recompute(param, v) {
    var E = root && root.DCAI_CALC; if (!E || typeof E.compute !== 'function' || !E.model) return null;
    var m = JSON.parse(JSON.stringify(E.model)), k = String(param).split('.'), o = m;
    for (var i = 0; i < k.length - 1; i++) o = o && o[k[i]];
    if (!o || typeof o[k[k.length - 1]] !== 'number') return null;
    if (v !== null) o[k[k.length - 1]] = v;
    try { return E.compute(m); } catch (e) { return null; }
  }
  function liveOf(payload) {
    return function (pvId) {
      var point = String(pvId).split('/').pop(), v = payload && typeof payload.n === 'function' ? payload.n(point) : null;
      return typeof v === 'number' && isFinite(v) ? { v: v, src: 'page', title: 'the value this inspector shows' } : { v: NaN };
    };
  }
  /* P6 the free-cooling cliff as a control fact (closes G6): under the TCS supply what-if, one row per weather bin of the
     engine (shaped bins, ASSUMED), liquid free cooling or mechanical, engine now and at the simulated SP. The design
     ambient row is marked. Ink only; the word "mechanical" carries the alarm ink. */
  function binsOf(snap) { return snap && Array.isArray(snap.bins) ? snap.bins : []; }
  function word(b) { return b ? (b.liquid_free_cooling ? 'free' : 'mechanical') : '—'; }
  function cliff(sec) {
    var E = root.DCAI_CALC, box = sec.querySelector('[data-rz-cvm-whatif][data-wi-param="thermal.tcsSupplyC"]');
    if (!box || !E || !E.snapshot) return;
    var now = binsOf(E.snapshot), design = E.snapshot.design ? E.snapshot.design.ambient_db_c : null; if (!now.length) return;
    var esc = root.RZSpBlock.esc, t = box.ownerDocument.createElement('div');
    t.className = 'rz-cvm-sp-wrap rz-inspector-cliff';
    t.innerHTML = '<table class="rz-cvm-sp rz-cvm-wi-t" data-rz-cliff><caption>Liquid free cooling by weather bin (' + esc(E.model && E.model.weather ? E.model.weather.basis : 'shaped bins') + ')</caption>' +
      '<thead><tr><th scope="col">Ambient</th><th scope="col">Hours</th><th scope="col">Engine now</th><th scope="col">SIMULATED</th></tr></thead><tbody>' +
      now.map(function (b, i) {
        var d = b.ambient_db_c === design;
        return '<tr data-bin="' + i + '"' + (d ? ' data-design-bin' : '') + '><th scope="row">' + esc(b.ambient_db_c + ' °C' + (d ? ' · design' : '')) + '</th><td>' + esc(b.hours.toLocaleString('en-US')) + ' h</td>' +
          '<td data-k="now" data-mode="' + word(b) + '">' + word(b) + '</td><td data-k="sim">—</td></tr>';
      }).join('') + '</tbody></table>';
    var note = box.querySelector('.rz-cvm-note'); box.insertBefore(t, note || null);
    var s = box.querySelector('input[type="range"]'), sp = +box.getAttribute('data-wi-sp'), cells = t.querySelectorAll('td[data-k="sim"]');
    function clear() { for (var i = 0; i < cells.length; i++) { cells[i].textContent = '—'; cells[i].removeAttribute('data-mode'); } }
    function run() {
      var v = +s.value; if (!isFinite(v) || v === sp) { clear(); return; }
      var b1 = binsOf(recompute('thermal.tcsSupplyC', v));
      for (var i = 0; i < cells.length; i++) { var w = word(b1[i]); cells[i].textContent = w; cells[i].setAttribute('data-mode', w); }
    }
    s.addEventListener('input', run);
    box.querySelector('[data-wi-reset]').addEventListener('click', clear);
  }

  /* the inspector rewrites its body every 4 s (same unit, new tick): the block is built once per unit and the SAME node
     is put back, so a what-if slider keeps its value and focus across a refresh; only Live / Error are repainted */
  var kept = { key: null, sec: null, focus: null };
  function attach(payload, body) {
    var B = root.RZSpBlock; if (!B || !payload || !body) return false;
    /* P7: a class with a sequence of operations (RZSequences 'dcai:<cls>') gets the block even with no setpoint of its own */
    var list = rows(payload.classId), Q = root.RZSequences, V = root.RZConvSequence;
    var seqKey = Q && Q.get && V && Q.get('dcai:' + payload.classId) ? 'dcai:' + payload.classId : null;
    if (!list.length && !seqKey) return false;
    var doc = body.ownerDocument, key = payload.classId + ':' + payload.id + ':' + (payload.hall || '');
    style(doc);
    var sec = kept.key === key ? kept.sec : null;
    if (!sec) {
      var E = root.DCAI_CALC;
      sec = doc.createElement('section');
      sec.className = 'rz-inspector-sp'; sec.setAttribute('data-rz-dcai-sp', payload.classId);
      /* the traceability reason of every number in this block (test-dcai-coverage DECLARED): none is typed here */
      sec.setAttribute('data-rz-authored-basis', 'Setpoints and bands from the control registry (js/rz-control-points.js, data/control-points.json); Live = the value this inspector shows; what-if, cliff bins and sequence steps = DCAI_CALC.compute on a copy of the model (PRD-SETPOINT-SIM P5-P7)');
      sec.innerHTML = (list.length ? '<div class="rz-inspector-sec">Setpoints &amp; limits</div>' + B.inner(list, { snapshot: E && E.snapshot ? E.snapshot : null }) : '') +
        (seqKey ? V.block(seqKey, { narrow: true }) : '');
      if (list.length) cliff(sec);
      if (seqKey) V.bind(sec);
      sec.addEventListener('focusin', function (e) { kept.focus = e.target; });
      /* the 4 s body rewrite blurs the focused node BEFORE it detaches (Chrome); the rewrite puts the block back and
         re-focuses in the same task, so the user has only left when focus is still outside one task later */
      sec.addEventListener('focusout', function () { setTimeout(function () { if (!sec.contains(doc.activeElement)) kept.focus = null; }, 0); });
      kept.key = key; kept.sec = sec; kept.focus = null;
    }
    var f = kept.focus;
    body.appendChild(sec);
    if (list.length) B.bind(sec, { recompute: recompute, live: liveOf(payload) });
    if (f && sec.contains(f) && doc.activeElement !== f) { try { f.focus({ preventScroll: true }); } catch (e) { /* not focusable */ } }
    return true;
  }
  var api = { rows: rows, recompute: recompute, attach: attach, version: '1.3.0' };
  if (root) {
    root.RZDcaiSpInspector = api;
    if (root.document && root.document.addEventListener) root.document.addEventListener('rz-inspector-payload', function (e) { if (e && e.detail) attach(e.detail.payload, e.detail.body); });
  }
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
