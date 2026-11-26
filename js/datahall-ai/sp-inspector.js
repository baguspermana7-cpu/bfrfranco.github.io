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
  function rows(classId) {
    var C = root && root.RZControlPoints;
    return C && C.forClass ? C.forClass('dcai:' + classId) : [];
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
    var E = root.DCAI_CALC, sec = body.ownerDocument.createElement('section');
    sec.className = 'rz-inspector-sp'; sec.setAttribute('data-rz-dcai-sp', payload.classId);
    sec.innerHTML = '<div class="rz-inspector-sec">Setpoints &amp; limits</div>' + B.inner(list, { snapshot: E && E.snapshot ? E.snapshot : null });
    body.appendChild(sec);
    B.bind(sec, { recompute: recompute, live: liveOf(payload) });
    return true;
  }
  var api = { rows: rows, recompute: recompute, attach: attach, version: '1.0.0' };
  if (root) {
    root.RZDcaiSpInspector = api;
    if (root.document && root.document.addEventListener) root.document.addEventListener('rz-inspector-payload', function (e) { if (e && e.detail) attach(e.detail.payload, e.detail.body); });
  }
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
