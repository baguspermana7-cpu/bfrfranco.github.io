/* js/conv/loops-card.js — the Loops table of a Conventional page (PRD-SETPOINT-SIM §C P10, law S11c).
 *
 * A host <div data-rz-loops-host data-sheets="ch-m-101 ch-m-102 int-chiller"> ("none" = loops with no drawing) gets RZSpBlock.loops() for every registry
 * loop drawn on those sheets or inside those machines (RZControlPoints.loopRows('conv', sheets)): SP from the registry,
 * Live = the value this page shows for the loop's PV (else the engine's), OUT and authority left from the engine snapshot.
 * The table is rebuilt only when the engine snapshot changes (a MAINT slider, a scenario); Live / Error refresh every 2 s
 * while the tab is visible. Nothing is stored; no number is typed here.
 */
(function (root) {
  'use strict';
  var doc = root.document;
  var CSS =
    '[data-rz-loops-host] .rz-cvm-sp-wrap{overflow-x:auto;max-width:100%}' +
    '[data-rz-loops-host] .rz-loops{border-collapse:collapse;width:100%;font-family:"JetBrains Mono",monospace;font-size:10px;font-variant-numeric:tabular-nums}' +
    /* the caption names the table; a host under its own heading (data-caption-off) keeps it for screen readers only */
    '[data-rz-loops-host] .rz-loops caption{caption-side:top;text-align:left;padding:0 0 4px;font-size:10px}' +
    '[data-rz-loops-host][data-caption-off] .rz-loops caption{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}' +
    '[data-rz-loops-host] .rz-loops th,[data-rz-loops-host] .rz-loops td{padding:4px 3px;font-size:10px;line-height:1.3;text-align:left;white-space:nowrap;font-weight:400;border-bottom:1px dashed rgba(148,163,184,.26)}' +
    '[data-rz-loops-host] .rz-loops tbody th{font-weight:600}' +
    '[data-rz-loops-host] .rz-loops td[data-sat]{color:var(--rz-pt-warn);font-weight:600}[data-rz-loops-host] .rz-loops td[data-k="state"]{white-space:normal}' +
    /* a 344 px side column (the page's phone patch sets every table to a 0.8 rem scrolling block with 8 x 12 px cells; this
       one table opts out, !important against its !important): Error (Live − SP) stays in the cell for the gates but is not shown (the equipment modal's setpoint table shows it); on a phone SP too */
    /* Left (100 − OUT) is not a registry point: on a conv page it rides in the OUT cell's tooltip; the cell stays for the gates */
    '[data-rz-loops-host] .rz-loops [data-k="err"],[data-rz-loops-host] .rz-loops thead th:nth-child(4),[data-rz-loops-host] .rz-loops [data-k="left"],[data-rz-loops-host] .rz-loops thead th:nth-child(6){display:none}' +
    '@media (max-width:600px){[data-rz-loops-host] .rz-loops [data-k="sp"],[data-rz-loops-host] .rz-loops thead th:nth-child(2){display:none}[data-rz-loops-host] .rz-loops{display:table !important;font-size:10px !important}[data-rz-loops-host] .rz-loops th,[data-rz-loops-host] .rz-loops td{padding:4px 3px !important}}';
  function style() {
    if (doc.getElementById('rz-loops-css')) return;
    var st = doc.createElement('style'); st.id = 'rz-loops-css'; st.textContent = CSS; doc.head.appendChild(st);
  }
  function engineOf(id) {
    var o = root.CONV_CALC && root.CONV_CALC.snapshot, k = String(id).split('.');
    for (var i = 0; o != null && i < k.length; i++) o = o[k[i]];
    return typeof o === 'number' && isFinite(o) ? o : NaN;
  }
  function live(pv) {
    var node = doc.querySelector('[data-point="' + pv + '"][data-pt-value]'), raw = node ? node.getAttribute('data-pt-value') : '', v = raw !== '' && raw !== null ? +raw : NaN;
    if (isFinite(v)) return { v: v, src: 'page', title: 'the value this page shows' };
    return { v: engineOf(pv), src: 'engine', title: 'the engine value (this page does not show the point)' };
  }
  function mount(host) {
    var B = root.RZSpBlock, C = root.RZControlPoints, last = null;
    if (!B || !B.loops || !C || !C.loopRows) return;
    var sheets = (host.getAttribute('data-sheets') || '').split(/\s+/).filter(Boolean).map(function (t) { return t === 'none' ? null : t; });   /* none = not drawn */
    style();
    function tick() {
      if (doc.hidden) return;
      var snap = root.CONV_CALC && root.CONV_CALC.snapshot; if (!snap) return;
      if (snap !== last) { host.innerHTML = B.loops(C.loopRows('conv', sheets), { snapshot: snap }); last = snap; }
      B.bind(host, { live: live });
    }
    tick();
    root.setInterval(tick, 2000);
  }
  function start() { var h = doc.querySelectorAll('[data-rz-loops-host]'); for (var i = 0; i < h.length; i++) mount(h[i]); }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start); else start();
})(window);
