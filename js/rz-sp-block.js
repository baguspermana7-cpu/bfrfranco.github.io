/* js/rz-sp-block.js — THE "Setpoints & limits" block (PRD-SETPOINT-SIM §C4), one implementation for both cockpits.
 * Moved out of js/conv/equipment-modal.js (P1–P4b, P10 part 1); the DC AI inspector calls it from P5.
 *
 *   RZSpBlock.inner(rows, opts)  -> HTML (escaped) of the table, the loop lines and the what-if panels; the host wraps it
 *                                   in its own section frame. rows = RZControlPoints.forClass(classKey).
 *                                   opts.snapshot: the engine snapshot the loop authority is read from (P10) | null
 *   RZSpBlock.bind(host, opts)   -> wires the what-if sliders (once per box) and fills Live / Error.
 *                                   opts.recompute(param, v) -> engine snapshot with that one parameter changed
 *                                   (v === null: unchanged) | null
 *                                   opts.live(pvId) -> { v, src: 'page' | 'engine', title } (v NaN when not shown)
 * Nothing is stored: Reset puts the slider back on the registry SP. Values are textContent; registry text is escaped.
 */
(function (root) {
  'use strict';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function CP() { return root.RZControlPoints; }

  /* PRD-SETPOINT-SIM P1: per setpoint the SP, the live value of the point it governs, the error, the alarm band of that
     point, the adjustable range or why it is fixed, the evidence class and what holds it */
  function rowHtml(r) {
    var C = CP(), PS = root.RZPointStatus, pv = r.pv[0], L = PS && pv ? PS.limits(pv) : null, u = r.unit ? ' ' + r.unit : '';
    var band = L ? ['lo_alarm', 'lo_warn', 'hi_warn', 'hi_alarm'].map(function (k) { return typeof L[k] === 'number' ? ({ lo_alarm: 'LL ', lo_warn: 'L ', hi_warn: 'H ', hi_alarm: 'HH ' })[k] + L[k] : null; }).filter(Boolean).join(' · ') : 'no band';
    var adj = r.adjustable ? r.adjustable.min + '–' + r.adjustable.max + u + ' (step ' + r.adjustable.step + ')' : 'fixed: ' + (r.note || 'design value');
    return '<tr data-sp-row="' + esc(r.id) + '" data-sp-pv="' + esc(pv || '') + '" data-sp="' + r.value + '" data-sp-unit="' + esc(r.unit) + '" title="' + esc('Alarm band ' + band + ' · ' + adj + ' · ' + r.ev + (r.control ? ' · ' + r.control : '')) + '"><th scope="row">' + esc(r.label) + '</th>' +
      '<td data-k="sp">' + esc(C.fmt(r.value, r.unit) + u) + '</td>' +
      '<td data-k="pv">—</td><td data-k="err">—</td>' +
      '<td data-k="band">' + esc(band) + '</td><td data-k="adj">' + esc(adj) + '</td>' +
      '<td data-k="ev">' + esc(r.ev) + '</td><td data-k="ctl">' + esc(r.control || '—') + '</td></tr>';
  }
  /* P4: the control loop that holds the setpoint: PV -> controller -> MV, action, tuning.
     P10: how much output the controller has left before it can no longer hold its setpoint (engine steady state) */
  function loopHtml(r, snap) {
    var C = CP(), L = r.loop, A = C.authority && snap ? C.authority(L, snap) : null;
    var auth = A ? ' · OUT ' + A.out + ' % (' + esc(L.out.what) + ') · ' + A.left + ' % authority left' +
      (A.sat ? ' · <strong data-auth-word>SATURATED</strong>: the controller cannot move its output further, so more load moves the PV off its setpoint (band ' + A.band + ' %, ASSUMED)' : '') : '';
    return '<p class="rz-cvm-note" data-rz-cvm-loop="' + esc(L.tag) + '"' + (A ? ' data-auth-out="' + A.out + '" data-auth-left="' + A.left + '" data-auth-sat="' + A.sat + '"' : '') + '><strong>' + esc(L.tag) + '</strong> · ' + esc(L.pv.tag) + ' → ' + esc(L.tag) + ' → ' + esc(L.mv.what) +
      ' · ' + esc(L.action + ' acting ' + L.kind) + auth + ' · ' + esc(L.tuning ? 'tuning ' + JSON.stringify(L.tuning) : L.tuningNote) + (L.notDrawn ? ' · ' + esc(L.notDrawn) : '') + ' · basis: ' + esc(L.basis) + '</p>';
  }
  /* P2 what-if: a slider inside the registry's adjustable range; the host's recompute gives the steady-state outputs the
     registry lists: engine now, SIMULATED, difference */
  function wiHtml(r) {
    var a = r.adjustable, u = r.unit ? ' ' + r.unit : '';
    var rows = r.whatIf.map(function (w) {
      return '<tr data-wi-path="' + esc(w.path) + '" data-wi-unit="' + esc(w.unit) + '" data-wi-now="" data-wi-sim=""><th scope="row">' + esc(w.label) + '</th><td data-k="now">—</td><td data-k="sim">—</td><td data-k="d">—</td></tr>';
    }).join('');
    return '<div class="rz-cvm-wi" data-rz-cvm-whatif="' + esc(r.id) + '" data-wi-param="' + esc(r.param) + '" data-wi-sp="' + r.value + '" data-wi-unit="' + esc(r.unit) + '">' +
      '<div class="rz-cvm-wi-ctl"><label><span>What-if · ' + esc(r.label) + '</span><input type="range" min="' + a.min + '" max="' + a.max + '" step="' + a.step + '" value="' + r.value + '" aria-label="' + esc('Simulate ' + r.label + ', ' + a.min + ' to ' + a.max + u) + '"></label>' +
      '<output data-wi-out>' + esc('SP ' + CP().fmt(r.value, r.unit) + u) + '</output><button type="button" data-wi-reset>Reset</button></div>' +
      '<div class="rz-cvm-sp-wrap"><table class="rz-cvm-sp rz-cvm-wi-t"><thead><tr><th scope="col">Output (steady state)</th><th scope="col">Engine now</th><th scope="col">SIMULATED</th><th scope="col">Change</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<p class="rz-cvm-note">' + esc(r.whatIfNote || '') + '</p></div>';
  }
  function inner(rows, opts) {
    if (!CP() || !rows || !rows.length) return '';
    var snap = opts && opts.snapshot || null;
    return '<div class="rz-cvm-sp-wrap"><table class="rz-cvm-sp" data-rz-cvm-sp><thead><tr><th scope="col">Setpoint</th><th scope="col">SP</th><th scope="col">Live</th><th scope="col">Error</th><th scope="col" data-k="band">Alarm band</th><th scope="col" data-k="adj">Adjustable</th><th scope="col" data-k="ev">Evidence</th><th scope="col" data-k="ctl">Held by</th></tr></thead><tbody>' +
      rows.map(rowHtml).join('') + '</tbody></table></div>' +
      rows.filter(function (r) { return r.loop; }).map(function (r) { return loopHtml(r, snap); }).join('') +
      rows.filter(function (r) { return r.adjustable && r.whatIf && r.param; }).map(wiHtml).join('');
  }

  function get(s, p) { var k = p.split('.'), o = s; for (var i = 0; o != null && i < k.length; i++) o = o[k[i]]; return typeof o === 'number' && isFinite(o) ? o : NaN; }
  function dec(n) { var s = String(n), i = s.indexOf('.'); return i < 0 ? 0 : s.length - i - 1; }
  function show(n, u) { return isFinite(n) ? String(n) + (u ? ' ' + u : '') : '—'; }
  function bindWhatIf(box, recompute) {
    var C = CP();
    if (box.getAttribute('data-wi-bound')) return;
    box.setAttribute('data-wi-bound', '1');
    var param = box.getAttribute('data-wi-param'), sp = +box.getAttribute('data-wi-sp'), un = box.getAttribute('data-wi-unit'), u = un ? ' ' + un : '';
    var s = box.querySelector('input[type="range"]'), out = box.querySelector('[data-wi-out]'), trs = box.querySelectorAll('tr[data-wi-path]');
    var s0 = recompute(param, null);
    for (var i = 0; i < trs.length; i++) { var n0 = s0 ? get(s0, trs[i].getAttribute('data-wi-path')) : NaN; trs[i].setAttribute('data-wi-now', isFinite(n0) ? String(n0) : ''); trs[i].querySelector('[data-k="now"]').textContent = show(n0, trs[i].getAttribute('data-wi-unit')); }
    function clear() {
      out.textContent = 'SP ' + C.fmt(sp, un) + u; box.removeAttribute('data-wi-active');
      for (var i = 0; i < trs.length; i++) { trs[i].setAttribute('data-wi-sim', ''); trs[i].querySelector('[data-k="sim"]').textContent = '—'; trs[i].querySelector('[data-k="d"]').textContent = '—'; }
    }
    function run() {
      var v = +s.value; if (!isFinite(v) || v === sp) { clear(); return; }
      var s1 = recompute(param, v); if (!s1) { clear(); return; }
      out.textContent = 'SP′ ' + C.fmt(v, un) + u + ' (SIMULATED)'; box.setAttribute('data-wi-active', '1');
      for (var i = 0; i < trs.length; i++) {
        var tr = trs[i], un2 = tr.getAttribute('data-wi-unit'), n0 = +tr.getAttribute('data-wi-now'), n1 = get(s1, tr.getAttribute('data-wi-path'));
        tr.setAttribute('data-wi-sim', isFinite(n1) ? String(n1) : '');
        tr.querySelector('[data-k="sim"]').textContent = show(n1, un2);
        var d = n1 - n0, dp = Math.max(dec(n0), dec(n1));
        tr.querySelector('[data-k="d"]').textContent = isFinite(d) ? (d > 0 ? '+' : d < 0 ? '−' : '') + Math.abs(d).toFixed(dp) + (un2 ? ' ' + un2 : '') : '—';
      }
    }
    s.addEventListener('input', run);
    box.querySelector('[data-wi-reset]').addEventListener('click', function () { s.value = String(sp); clear(); });
  }
  function bind(host, opts) {
    var C = CP(); if (!host || !C) return;
    var boxes = host.querySelectorAll('[data-rz-cvm-whatif]');
    for (var b = 0; b < boxes.length; b++) bindWhatIf(boxes[b], opts.recompute || function () { return null; });
    var trs = host.querySelectorAll('tr[data-sp-row]');
    for (var i = 0; i < trs.length; i++) {
      var tr = trs[i], pv = tr.getAttribute('data-sp-pv'), sp = +tr.getAttribute('data-sp'), un = tr.getAttribute('data-sp-unit'), u = un ? ' ' + un : '';
      var L = pv && opts.live ? opts.live(pv) : { v: NaN }, v = L.v;
      var pc = tr.querySelector('[data-k="pv"]'), ec = tr.querySelector('[data-k="err"]');
      if (isFinite(v)) { pc.textContent = C.fmt(v, un) + u; ec.textContent = (v - sp >= 0 ? '+' : '') + (v - sp).toFixed(1) + u; pc.setAttribute('title', L.title || ''); pc.setAttribute('data-src', L.src); }
      else { pc.textContent = '—'; ec.textContent = '—'; pc.setAttribute('title', 'not shown on this page and not an engine value'); pc.removeAttribute('data-src'); }
    }
  }
  var api = { inner: inner, bind: bind, esc: esc, version: '1.0.0' };
  if (root) root.RZSpBlock = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : null);
