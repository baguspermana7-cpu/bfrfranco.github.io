/*
 * vfx.js — window.RZConvVfx: process-bound colour and motion for the Conventional HMI sheets
 * (PRD-CONV-LIVING-PLANT §3–§5, phase P1). Nothing here decorates: every painted property is a function of a point
 * the page already holds.
 *
 *   PURE (Node-tested, tools/test-conv-vfx-core.mjs)
 *   edgeState(flow, alarm, mismatch)  flow = running | stopped | unavailable | unknown (the sheet's own flow state);
 *                                     alarm = '1' critical | '2' warning | null  ->  running | warning | alarm |
 *                                     stopped | mismatch | unavailable
 *   nodeState(d)                      d = { state, alarm, mismatch, quality }  ->  the same vocabulary + standby
 *   dashSeconds(ratio)                ratio = flow / design flow of that line. Screen velocity = ratio * 2.0 m/s
 *                                     (declared design velocity for chilled-water mains), clamped to 0.2..3.0 m/s so
 *                                     a trickle still moves and a surge does not strobe; 1 m/s = 16 px/s, and one
 *                                     dash period is 16 px -> seconds per period = 16 / (16 * v) = 1 / v.
 *                                     ratio <= 0 or not a number -> null (no motion).
 *   rotorSeconds(speedPct)            100 % -> 1.0 s per turn; proportional; below 5 % -> null (does not turn).
 *   thermal(t, lo, hi)                °C -> 'rgb(r,g,b)' on a blue -> amber -> red ramp; outside the range clamps;
 *                                     not a number -> null.
 *
 *   DOM
 *   apply(svg, o)   o = { edges, flow(e), ratio(e), temp(e), tempRange:[lo,hi], speed(nodeId) }
 *                   writes data-vstate on every edge and node, the dash period on each running flow path, a rotor
 *                   on each pump, and the thermal colour. Call it after sheet.update().
 *   mode(frame, m)  state | thermal | medium | flat. Persisted per browser (convenience only).
 *   Motion pauses off screen (css/conv-hmi-depth.css .is-offscreen) and under prefers-reduced-motion
 *   (css/conv-vfx.css), where the state colour, the dash pattern and the direction arrows remain.
 */
(function (root) {
  'use strict';

  var DESIGN_V = 2.0, V_MIN = 0.2, V_MAX = 3.0, PX_PER_M = 16, DASH_PERIOD_PX = 16;
  var MODES = ['state', 'thermal', 'medium', 'flat'], MODE_KEY = 'rz_conv_vfx_mode';

  function isNum(n) { return typeof n === 'number' && isFinite(n); }

  function edgeState(flow, alarm, mismatch) {
    if (flow === 'unavailable' || flow === 'unknown' || !flow) return 'unavailable';
    if (mismatch) return 'mismatch';
    if (alarm === '1') return 'alarm';
    if (flow === 'stopped') return 'stopped';
    if (alarm === '2') return 'warning';
    if (flow === 'standby') return 'standby';
    return 'running';
  }
  /* restState(flow, charged): a line with no flow that is held ready (charged main, supervised gas) reads standby */
  function restState(flow, charged) { return flow === 'stopped' && charged ? 'standby' : flow; }

  var RUN = { running: 1, open: 1, on: 1, energized: 1, up: 1, online: 1, modulating: 1, normal: 1, connected: 1, clean: 1, float: 1 };
  var STBY = { standby: 1, ready: 1, available: 1, auto: 1, armed: 1 };
  function nodeState(d) {
    d = d || {};
    if (d.quality === 'bad' || d.quality === 'nodata' || d.state == null) return 'unavailable';
    if (d.mismatch) return 'mismatch';
    if (d.alarm === '1' || d.state === 'fault' || d.state === 'trip' || d.state === 'tripped') return 'alarm';
    if (d.alarm === '2') return 'warning';
    if (RUN[d.state]) return 'running';
    if (STBY[d.state]) return 'standby';
    return 'stopped';
  }

  function dashSeconds(ratio) {
    if (!isNum(ratio) || ratio <= 0) return null;
    var v = Math.max(V_MIN, Math.min(V_MAX, ratio * DESIGN_V));
    return Math.round(DASH_PERIOD_PX / (PX_PER_M * v) * 1000) / 1000;
  }

  function rotorSeconds(pct) {
    if (!isNum(pct) || pct < 5) return null;
    return Math.round(100 / Math.min(pct, 120) * 1000) / 1000;
  }

  var RAMP = [[0, [59, 130, 246]], [0.5, [232, 181, 99]], [1, [239, 68, 68]]];
  function thermal(t, lo, hi) {
    if (!isNum(t) || !isNum(lo) || !isNum(hi) || hi <= lo) return null;
    var x = Math.max(0, Math.min(1, (t - lo) / (hi - lo))), a = RAMP[0], b = RAMP[1];
    if (x > 0.5) { a = RAMP[1]; b = RAMP[2]; }
    var k = (x - a[0]) / (b[0] - a[0]);
    return 'rgb(' + [0, 1, 2].map(function (i) { return Math.round(a[1][i] + (b[1][i] - a[1][i]) * k); }).join(',') + ')';
  }

  /* ---- DOM ------------------------------------------------------------------------------------------- */
  var NS = 'http://www.w3.org/2000/svg';
  function setA(el, k, v) { if (v == null) { if (el.hasAttribute(k)) el.removeAttribute(k); } else if (el.getAttribute(k) !== String(v)) el.setAttribute(k, v); }
  function setS(el, k, v) { if (el.style.getPropertyValue(k) !== (v || '')) { if (v) el.style.setProperty(k, v); else el.style.removeProperty(k); } }
  function endsOf(p) { return (p.getAttribute('data-ends') || '|').split('|'); }

  /* a tower cell's fan sits in its stack (symbol units: hub at 24,3 of the 48-unit box), a pump's rotor inside its
     casing circle; both are the same broken ring, turned by CSS on the compositor (PRD-CONV-OPS-DEPTH 01 P2) */
  function fanRotor(g) {
    var r = g.querySelector('.vfx-rotor'); if (r) return r;
    var b = g.querySelector('path.b'); if (!b) return null;
    r = root.document.createElementNS(NS, 'circle');
    r.setAttribute('class', 'vfx-rotor vfx-fan'); r.setAttribute('aria-hidden', 'true');
    r.setAttribute('cx', '24'); r.setAttribute('cy', '3'); r.setAttribute('r', '4.5');
    b.parentNode.insertBefore(r, b.nextSibling);
    return r;
  }
  function rotor(g) {
    var r = g.querySelector('.vfx-rotor'); if (r) return r;
    var b = g.querySelector('circle.b'); if (!b) return null;
    r = root.document.createElementNS(NS, 'circle');
    r.setAttribute('class', 'vfx-rotor'); r.setAttribute('aria-hidden', 'true');
    r.setAttribute('cx', b.getAttribute('cx')); r.setAttribute('cy', b.getAttribute('cy'));
    r.setAttribute('r', String(Math.max(2, parseFloat(b.getAttribute('r')) - 3.5)));
    b.parentNode.insertBefore(r, b.nextSibling);
    return r;
  }

  function apply(svg, o) {
    if (!svg || !o) return;
    var nodeEl = {}, worst = {};
    svg.querySelectorAll('.hmi-node[data-node]').forEach(function (g) {
      var id = g.getAttribute('data-node'); nodeEl[id] = g;
      var st = nodeState({ state: g.getAttribute('data-state'), alarm: g.getAttribute('data-alarm'),
        mismatch: g.hasAttribute('data-mismatch'), quality: g.getAttribute('data-quality') });
      /* a symbol that carries no state of its own (junction, vent, connector) takes none */
      setA(g, 'data-vstate', g.getAttribute('data-state') == null && !g.getAttribute('data-alarm') ? null : st);
      worst[id] = g.hasAttribute('data-mismatch') ? 'm' : g.getAttribute('data-alarm');
      var sym = g.getAttribute('data-sym') || g.getAttribute('class') || '', fan = /coolingTowerCell/.test(sym);
      if (fan || (g.querySelector('circle.b') && /pump/i.test(sym))) {
        var rt = fan ? fanRotor(g) : rotor(g), sec = st === 'running' || st === 'warning' ? rotorSeconds(o.speed ? o.speed(id) : null) : null;
        if (rt) { setA(rt, 'data-spin', sec ? '1' : null); setS(rt, 'animation-duration', sec ? sec + 's' : ''); }
      }
    });
    var byId = {};
    (o.edges || []).forEach(function (e) { byId[e.id] = e; });
    svg.querySelectorAll('path[data-edge]').forEach(function (p) {
      var id = p.getAttribute('data-edge'), e = byId[id]; if (!e) return;
      var flow = o.flow ? o.flow(e) : p.getAttribute('data-flow');
      if (o.rest) flow = restState(flow, !!o.rest(e));
      if (flow == null) { setA(p, 'data-vstate', null); return; }   /* a line that carries no flow model (signal, tap) */
      var ends = endsOf(p), al = null, mm = false;
      ends.forEach(function (n) { var w = worst[n]; if (w === 'm') mm = true; else if (w === '1') al = '1'; else if (w === '2' && al !== '1') al = '2'; });
      var st = edgeState(flow, al, mm && flow !== 'running');
      var col = o.temp ? thermal(o.temp(e), (o.tempRange || [])[0], (o.tempRange || [])[1]) : null;
      /* motion follows the water, not the colour: a line beside an alarmed asset still flows and still moves */
      var moving = flow === 'running', sec = moving ? dashSeconds(o.ratio ? o.ratio(e) : 1) : null;
      setA(p, 'data-vstate', st); setS(p, '--vfx-t', col);
      svg.querySelectorAll('path[data-edge-flow="' + id + '"]').forEach(function (f) {
        setA(f, 'data-vstate', st); setS(f, '--vfx-t', col);
        setA(f, 'data-vmove', moving ? '1' : null);
        setS(f, 'animation-duration', sec ? sec + 's' : '');
        setA(f, 'data-vfx-speed', sec ? String(sec) : null);
      });
    });
  }

  function storedMode() {
    try { var m = root.localStorage.getItem(MODE_KEY); return MODES.indexOf(m) >= 0 ? m : 'state'; } catch (e) { return 'state'; }
  }
  function mode(frame, m, keep) {
    if (!frame) return null;
    if (m && MODES.indexOf(m) >= 0) {
      frame.setAttribute('data-vfx-mode', m);
      if (!keep) try { root.localStorage.setItem(MODE_KEY, m); } catch (e) { /* private window: the mode simply does not persist */ }
      frame.querySelectorAll('[data-vfx-set]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-vfx-set') === m ? 'true' : 'false'); });
      var lg = frame.querySelector('.vfx-legend'); if (lg) lg.setAttribute('data-mode', m);
    }
    return frame.getAttribute('data-vfx-mode');
  }

  var LEGEND = [['running', 'Running'], ['warning', 'Warning'], ['alarm', 'Alarm / trip'], ['standby', 'Standby'], ['stopped', 'Stopped'], ['mismatch', 'Cmd ≠ Fb'], ['unavailable', 'No data']];
  /* mount(frame, { tempRange, tempUnit }) adds the view-mode buttons and the legend to a rendered sheet frame */
  function mount(frame, o) {
    if (!frame || frame.querySelector('.vfx-bar')) return;
    var doc = root.document, bar = doc.createElement('div');
    bar.className = 'vfx-bar';
    var labels = { state: 'State', thermal: 'Thermal', medium: 'Medium', flat: 'Flat' };
    var tips = { state: 'Line colour = condition: running, warning, alarm, stopped', thermal: 'Line colour = water temperature',
      medium: 'Line colour = medium (chilled water, condenser water …)', flat: 'Grey lines; colour only on abnormal (ISA-101 practice)' };
    var h = '<span class="vfx-bar-k">View</span><span class="vfx-modes" role="group" aria-label="Line colour mode">';
    var noT = o && o.thermal === false;   /* a sheet with no temperature points offers no Thermal view */
    MODES.forEach(function (m) { if (noT && m === 'thermal') return; h += '<button type="button" class="vfx-mode" data-vfx-set="' + m + '" aria-pressed="false" title="' + tips[m] + '">' + labels[m] + '</button>'; });
    h += '</span><span class="vfx-legend" aria-label="Legend">';
    /* swatches are CSS, not <svg>: page code and gates take the first <svg> under the sheet host to be the sheet */
    LEGEND.forEach(function (l) { h += '<span class="vfx-lg" data-vstate="' + l[0] + '"><i class="vfx-lg-line" data-vstate="' + l[0] + '" aria-hidden="true"></i>' + l[1] + '</span>'; });
    var r = (o && o.tempRange) || null, u = (o && o.tempUnit) || '°C';
    h += '<span class="vfx-lg vfx-lg-ramp"><span class="vfx-ramp" aria-hidden="true"></span>' + (r ? r[0] + ' → ' + r[1] + ' ' + u : 'cold → warm') + '</span></span>';
    bar.innerHTML = h;
    var host = frame.querySelector('.hmi-bar');
    if (host && host.nextSibling) frame.insertBefore(bar, host.nextSibling); else frame.appendChild(bar);
    bar.addEventListener('click', function (ev) {
      var b = ev.target.closest && ev.target.closest('[data-vfx-set]'); if (b) mode(frame, b.getAttribute('data-vfx-set'));
    });
    if (noT && storedMode() === 'thermal') mode(frame, 'state', true); else mode(frame, storedMode(), true);
  }

  /* bind(host, sheet, flow[, rest]): the whole binding for a sheet that has line states but no temperature or speed points */
  function bind(host, sheet, flow, rest) {
    if (!host || !sheet) return;
    var frame = host.querySelector('.hmi-frame'), svg = host.querySelector('svg.hmi-svg');
    if (!frame || !svg) return;
    mount(frame, { thermal: false });
    apply(svg, { edges: sheet.edges, flow: flow, rest: rest || null });
  }

  var API = { edgeState: edgeState, restState: restState, nodeState: nodeState, dashSeconds: dashSeconds, rotorSeconds: rotorSeconds, thermal: thermal,
    apply: apply, mode: mode, mount: mount, bind: bind, MODES: MODES, DESIGN_V: DESIGN_V, V_MIN: V_MIN, V_MAX: V_MAX, version: '1.0.0' };
  if (root) root.RZConvVfx = Object.freeze(API);
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : null);
