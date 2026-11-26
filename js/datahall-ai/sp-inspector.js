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
  var CSS = '.rz-inspector-sp{margin:10px 0 0}' +
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
    '.rz-inspector-sp .rz-cvm-wi-t th[scope="row"]{width:44%}' +
    '.rz-inspector-sp .rz-cvm-note{margin:6px 0 0;font-size:11px;line-height:1.4;color:#94a3b8}';
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
  function attach(payload, body) {
    var B = root.RZSpBlock; if (!B || !payload || !body) return false;
    var list = rows(payload.classId); if (!list.length) return false;
    style(body.ownerDocument);
    var E = root.DCAI_CALC, sec = body.ownerDocument.createElement('section');
    sec.className = 'rz-inspector-sp'; sec.setAttribute('data-rz-dcai-sp', payload.classId);
    sec.innerHTML = '<div class="rz-inspector-sec">Setpoints &amp; limits</div>' + B.inner(list, { snapshot: E && E.snapshot ? E.snapshot : null });
    body.appendChild(sec);
    B.bind(sec, { recompute: recompute, live: liveOf(payload) });
    return true;
  }
  var api = { rows: rows, recompute: recompute, attach: attach, version: '1.1.0' };
  if (root) {
    root.RZDcaiSpInspector = api;
    if (root.document && root.document.addEventListener) root.document.addEventListener('rz-inspector-payload', function (e) { if (e && e.detail) attach(e.detail.payload, e.detail.body); });
  }
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
