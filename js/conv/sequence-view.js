/* ============================================================================
 * sequence-view.js — the "Sequence of operations" block of the Conventional equipment modal (RZConvSequence 1.0.0)
 * PRD-SETPOINT-SIM P3 (documentation/prd/PRD_SETPOINT_SIM.md §B2.5).
 *
 *   RZConvSequence.block(classKey) -> markup | ''   every mode (entry, ordered actions, exit) of the class's sequence
 *                                                     from js/rz-sequences.js, a scenario picker, the scenario's path
 *                                                     drawn through RZDiagram, and the step table
 *   RZConvSequence.bind(host)                         wires Simulate / Reset once per block (data-seq-bound)
 *
 * Every number comes from the generated twin (thresholds from the limits registry or the engine, steps walked on the
 * engine's plant quantities). Steps are steady states labelled SIMULATED; nothing is stored. Simulate reveals one step
 * at a time; with reduced motion, or from the keyboard, every step shows at once (MOTION_STANDARD frequency rule).
 * ==========================================================================*/
(function (root) {
  'use strict';
  var doc = root.document;
  var STEP_MS = 900;
  var NODE_W = 176;
  var KIND = { normal: 'Normal', transition: 'Transition', protection: 'Protection', emergency: 'Emergency' };
  var OPS = { '>': '>', '>=': '≥', '<': '<', '<=': '≤' };
  var BAND = { lo_alarm: 'LL', lo_warn: 'L', hi_warn: 'H', hi_alarm: 'HH' };
  var CSS =
    '.rz-cvm-seq{--bg1:var(--cvm-panel);--bg3:var(--cvm-bg);--t1:var(--cvm-text);--t2:var(--cvm-mute);--t3:var(--cvm-mute);--bd:var(--cvm-line);--bd2:var(--cvm-line)}' +
    '.rz-cvm-seq-note{color:var(--cvm-mute);font-size:12px;margin:0 0 10px;line-height:1.5}' +
    '.rz-cvm-seq-ctl{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin:0 0 10px}' +
    '.rz-cvm-seq-ctl select,.rz-cvm-seq-ctl button{min-height:44px;font:inherit;font-size:13px;color:var(--cvm-text);background:var(--cvm-bg);border:1px solid var(--cvm-line);border-radius:4px;padding:0 12px}' +
    '.rz-cvm-seq-ctl button:hover,.rz-cvm-seq-ctl select:hover{border-color:var(--cvm-acc)}' +
    '.rz-cvm-seq-fig{margin:4px 0 12px}.rz-cvm-seq-fig svg{display:block;width:100%;height:auto}' +
    '.rz-cvm-seq-fig [data-rzd-state="on"]{stroke:var(--cvm-acc);stroke-width:2}' +
    '.rz-cvm-seq-t tr[data-seq-i][hidden]{display:none}.rz-cvm-seq-t tr[data-seq-on] th,.rz-cvm-seq-t tr[data-seq-on] td{color:var(--cvm-text);background:var(--cvm-bg)}' +
    '.rz-cvm-seq-t caption{text-align:left;color:var(--cvm-mute);font-size:11px;padding:0 0 4px}.rz-cvm-seq-t td{font-family:"IBM Plex Mono","JetBrains Mono",monospace}' +
    '.rz-cvm-seq-modes details{border-bottom:1px solid var(--cvm-line);padding:6px 0}.rz-cvm-seq-modes summary{cursor:pointer;min-height:32px;display:flex;align-items:center;gap:8px;font-size:13px}' +
    '.rz-cvm-seq-modes summary small{color:var(--cvm-mute);font-size:11px}' +
    '.rz-cvm-seq-modes dl{margin:6px 0 4px;font-size:12px;line-height:1.5}.rz-cvm-seq-modes dt{color:var(--cvm-mute);margin-top:6px}.rz-cvm-seq-modes dd{margin:0}' +
    '.rz-cvm-seq-modes ol,.rz-cvm-seq-modes ul{margin:2px 0;padding-left:18px}' +
    '@media (max-width:600px){.rz-cvm-seq-t{font-size:11px}.rz-cvm-seq-t th,.rz-cvm-seq-t td{padding:6px 3px;white-space:normal}.rz-cvm-seq-t td[data-k=\"t\"]{white-space:nowrap}.rz-cvm-seq-t [data-k="avail"],.rz-cvm-seq-t [data-k="cap"],.rz-cvm-seq-t [data-k="pl"]{display:none}}';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function css() { if (!doc || doc.getElementById('rz-cvm-seq-css')) return; var st = doc.createElement('style'); st.id = 'rz-cvm-seq-css'; st.textContent = CSS; doc.head.appendChild(st); }
  function short(label) { return String(label).split(' — ')[0]; }
  function n(v) { return typeof v === 'number' ? (Math.round(v) === v ? String(v) : v.toFixed(1)) : '—'; }
  function reduced() { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function phone() { return !!(root.matchMedia && root.matchMedia('(max-width: 600px)').matches); }

  function human(k) { var f = k.split(' '); return f[0] === 'delay_s' ? 'delay ' + f[1] + ' s' : f[0] === 'stagger_s' ? 'stagger ' + f[1] + ' s' : 'threshold ' + f[1]; }
  function assumedFor(m, key) { return !!(m.assumed && m.assumed[key]); }
  function cond(c, m, S) {
    var t;
    if (c.kind === 'limit') t = c.label + ' ' + (OPS[c.op] || c.op) + ' ' + n(c.value) + ' ' + c.unit + ' (' + BAND[c.band] + ', ' + c.evidenceClass + ')';
    else if (c.kind === 'param') t = (c.text || c.point) + ': ' + (OPS[c.op] || c.op) + ' ' + n(c.value) + ' ' + c.unit + ' (engine, ' + c.evidenceClass + ')';
    else if (c.kind === 'derived') t = (c.text || c.point) + ': ' + (OPS[c.op] || c.op) + ' ' + n(c.value) + ' ' + c.unit + (assumedFor(m, 'value ' + c.value) ? ' (assumed)' : '');
    else t = c.text || '';
    if (typeof c.delay_s === 'number') t += ' for ' + c.delay_s + ' s' + (assumedFor(m, 'delay_s ' + c.delay_s) ? ' (assumed)' : '');
    if (c.to) { var to = S.modes.filter(function (x) { return x.id === c.to; })[0]; t += ' → ' + (to ? short(to.label) : c.to); }
    return '<li data-seq-cond="' + esc(c.kind) + '"' + (typeof c.value === 'number' ? ' data-seq-value="' + c.value + '"' : '') + '>' + esc(t) + '</li>';
  }

  function modeList(S) {
    return '<div class="rz-cvm-seq-modes">' + S.modes.map(function (m) {
      var notes = [];
      Object.keys(m.assumed || {}).forEach(function (k) { notes.push('Assumed — ' + human(k) + ': ' + m.assumed[k]); });
      if (m.notModelled) notes.push('Not modelled — ' + m.notModelled);
      return '<details data-seq-mode="' + esc(m.id) + '"><summary>' + esc(m.label) + ' <small>' + esc(KIND[m.kind] || m.kind) + '</small></summary><dl>' +
        '<dt>Entry</dt><dd><ul>' + m.entry.map(function (c) { return cond(c, m, S); }).join('') + '</ul></dd>' +
        '<dt>Actions, in order</dt><dd><ol>' + m.actions.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') +
        (m.stagger_s ? '<li>' + esc('restart stagger ' + m.stagger_s + ' s' + (assumedFor(m, 'stagger_s ' + m.stagger_s) ? ' (assumed)' : '')) + '</li>' : '') + '</ol></dd>' +
        '<dt>Exit</dt><dd><ul>' + m.exit.map(function (c) { return cond(c, m, S); }).join('') + '</ul></dd>' +
        (notes.length ? '<dt>Notes</dt><dd><ul>' + notes.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></dd>' : '') +
        '</dl></details>';
    }).join('') + '</div>';
  }

  /* the scenario's path: its distinct modes in order, drawn through RZDiagram (row on a desktop, column on a phone) */
  function figure(S, sc, slug, narrow) {
    var D = root.RZDiagram; if (!D) return '<p class="rz-cvm-seq-note">Diagram engine not loaded.</p>';
    var order = [], seen = {};
    sc.steps.forEach(function (s) { if (!seen[s.mode]) { seen[s.mode] = 1; order.push(s.mode); } });
    var vert = narrow || phone(), ctx = D.create({ width: 960, height: 400, slug: slug, title: sc.label, desc: 'Sequence path: ' + order.join(' → ') });
    var box = {}, X = 16, Y = 16, G = vert ? 36 : 56;
    order.forEach(function (id) {
      var m = S.modes.filter(function (x) { return x.id === id; })[0];
      /* one width for every node so a straight connector meets each box at its centre; only the lit step is amber */
      var b = ctx.node(X, Y, { id: 'seq-' + id, name: short(m.label), tag: KIND[m.kind] || m.kind, state: 'off', w: NODE_W });
      box[id] = b; if (vert) Y += b.h + G; else X += b.w + G;
    });
    function pt(b, side) { return side === 'right' ? { x: b.x + b.w, y: b.y + b.h / 2 } : side === 'left' ? { x: b.x, y: b.y + b.h / 2 } : side === 'top' ? { x: b.x + b.w / 2, y: b.y } : { x: b.x + b.w / 2, y: b.y + b.h }; }
    for (var i = 1; i < sc.steps.length; i++) {
      var a = sc.steps[i - 1].mode, z = sc.steps[i].mode; if (a === z) continue;
      var back = order.indexOf(z) < order.indexOf(a), fs, ts;
      if (vert) { fs = back ? 'left' : 'bottom'; ts = back ? 'left' : 'top'; } else { fs = back ? 'bottom' : 'right'; ts = back ? 'bottom' : 'left'; }
      ctx.edge(pt(box[a], fs), pt(box[z], ts), { fromId: 'seq-' + a, toId: 'seq-' + z, tier: 2, fromSide: fs, toSide: ts });
    }
    ctx.fit(16);
    /* drawn at its own size (1 unit = 1 px), never stretched to the panel: a scaled-up figure reads as a poster */
    return '<div class="rz-cvm-seq-fig" data-seq-fig data-seq-warnings="' + ctx.warnings.length + '" style="max-width:' + ctx.width + 'px">' + ctx.render() + '</div>';
  }

  var SRC = { utility: 'utility', gen: 'generators', none: 'UPS battery / none' };
  function steps(S, sc) {
    var P = S.quantities, label = {}; S.modes.forEach(function (m) { label[m.id] = short(m.label); });
    var timed = sc.steps.some(function (s) { return s.t_s > 0; });
    var stag = S.modes.filter(function (m) { return m.stagger_s; })[0];
    /* P7: an engine sweep (DC AI) shows the input it set and the engine's own result per step */
    var eng = sc.steps[0] && sc.steps[0].engine ? sc.steps[0] : null;
    function big(v) { return typeof v === 'number' ? (Math.abs(v) >= 1000 ? Math.round(v).toLocaleString('en-US') : n(v)) : '—'; }
    var engTh = eng ? '<th scope="col" data-k="set">' + esc(eng.set.label + (eng.set.unit ? ' ' + eng.set.unit : '')) + '</th>' +
      eng.engine.map(function (e) { return '<th scope="col" data-k="eng">' + esc(e.label + (e.unit ? ' ' + e.unit : '')) + '</th>'; }).join('') : '';
    function engTd(s) { return eng ? '<td data-k="set">' + big(s.set.value) + '</td>' + s.engine.map(function (e) { return '<td data-k="eng">' + big(e.value) + '</td>'; }).join('') : ''; }
    return '<div class="rz-cvm-sp-wrap"><table class="rz-cvm-sp rz-cvm-seq-t" data-seq-steps><caption>SIMULATED · steady state per step</caption><thead><tr><th scope="col">Step</th>' + engTh +
      (timed ? '<th scope="col" data-k="t">Time</th>' : '') + (P.source ? '<th scope="col" data-k="src">Load on</th>' : '') + '<th scope="col">Running</th>' +
      '<th scope="col" data-k="avail">Available</th><th scope="col" data-k="cap">' + esc('Capacity ' + P.unitLabel) + '</th><th scope="col" data-k="pl">' + (P.unitBasis ? 'Load / usable' : 'Part load') + '</th><th scope="col">' + esc('Short ' + P.unitLabel) + '</th><th scope="col">' + esc(P.pv.label) + '</th></tr></thead><tbody>' +
      sc.steps.map(function (s, i) {
        return '<tr data-seq-i="' + i + '" data-seq-step-mode="' + esc(s.mode) + '" data-seq-running="' + s.running + '" data-seq-short="' + s.short + '" data-seq-t="' + s.t_s + '" hidden>' +
          '<th scope="row">' + esc((i + 1) + '. ' + (s.note ? s.note : label[s.mode])) + '</th>' + engTd(s) + (timed ? '<td data-k="t">' + (s.note ? '+' + s.t_s + ' s' : '—') + '</td>' : '') +
          (P.source ? '<td data-k="src">' + esc(SRC[s.source] || '—') + '</td>' : '') +
          '<td>' + s.running + '</td><td data-k="avail">' + s.available + '</td>' +
          '<td data-k="cap">' + big(s.capacity) + '</td><td data-k="pl">' + (s.part_load_pct === null ? '—' : n(s.part_load_pct) + ' %') + '</td><td>' + big(s.short) + '</td><td>' + esc(s.pv) + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      (timed && stag ? '<p class="rz-cvm-seq-note">' + esc('Time counts from the return of supply; ' + stag.stagger_s + ' s between two chiller starts (assumed). How long the supply is lost is not modelled.') + '</p>' : '');
  }

  /* narrow: the host is a side panel (the DC AI inspector, ~320 px) whatever the viewport: the path is drawn as a column */
  function scenarioBody(S, sc, k, narrow) { return figure(S, sc, 'seq-' + k + '-' + sc.id, narrow) + steps(S, sc); }

  function block(classKey, opts) {
    var narrow = !!(opts && opts.narrow);
    var Q = root.RZSequences, S = Q && Q.get ? Q.get(classKey) : null; if (!S) return '';
    css();
    var P = S.quantities, sc = S.scenarios[0];
    return '<section class="rz-cvm-sec rz-cvm-seq" data-rz-cvm-seq="' + esc(classKey) + '"' + (narrow ? ' data-seq-narrow' : '') + '><h3>Sequence of operations</h3>' +
      '<p class="rz-cvm-seq-note">' + esc('Structure: ' + S.basis.ref + ' (' + S.basis.evidenceClass + '). Thresholds from this plant\'s limits registry and engine. Plant now: load ' +
        n(P.load) + ' ' + P.unitLabel + ', ' + P.running + ' of ' + P.total + ' ' + P.noun + ' running, ' + n(P.unit) + ' ' + P.unitLabel + ' each' + (P.unitBasis ? ' (' + P.unitBasis + ')' : P.unitPer ? ' (' + P.unitPer + ' halls)' : '') + (P.source === 'utility' ? '; on the utility, every set on standby' : '') + '.') + '</p>' +
      '<div class="rz-cvm-seq-ctl"><label>Scenario <select data-seq-scn>' + S.scenarios.map(function (x) { return '<option value="' + esc(x.id) + '">' + esc(x.label) + '</option>'; }).join('') + '</select></label>' +
      '<button type="button" data-seq-sim>Simulate</button><button type="button" data-seq-reset>Reset</button></div>' +
      '<div data-seq-body>' + scenarioBody(S, sc, classKey, narrow) + '</div>' + modeList(S) + '</section>';
  }

  function bind(host) {
    var boxes = host ? host.querySelectorAll('[data-rz-cvm-seq]:not([data-seq-bound])') : [];
    Array.prototype.forEach.call(boxes, function (box) {
      box.setAttribute('data-seq-bound', '1');
      var k = box.getAttribute('data-rz-cvm-seq'), S = root.RZSequences.get(k), timer = null;
      function cur() { var id = box.querySelector('[data-seq-scn]').value; return S.scenarios.filter(function (x) { return x.id === id; })[0]; }
      function stop() { if (timer) { root.clearInterval(timer); timer = null; } }
      function show(i) {
        var rows = box.querySelectorAll('tr[data-seq-i]');
        Array.prototype.forEach.call(rows, function (r, j) { if (j <= i) r.removeAttribute('hidden'); else r.setAttribute('hidden', ''); if (j === i) r.setAttribute('data-seq-on', ''); else r.removeAttribute('data-seq-on'); });
        var on = i >= 0 && rows[i] ? rows[i].getAttribute('data-seq-step-mode') : null;
        Array.prototype.forEach.call(box.querySelectorAll('[data-seq-fig] rect[data-rzd-node]'), function (r) { r.setAttribute('data-rzd-state', r.getAttribute('data-rzd-node') === 'seq-' + on ? 'on' : 'off'); });
        box.setAttribute('data-seq-at', String(i));
      }
      function reset() { stop(); show(-1); }
      /* each cell carries its column name (data-l) so a narrow host (the DC AI inspector) can stack a step as label · value */
      function lab() {
        Array.prototype.forEach.call(box.querySelectorAll('table[data-seq-steps]'), function (t) {
          var h = Array.prototype.map.call(t.querySelectorAll('thead th'), function (x) { return x.textContent; });
          Array.prototype.forEach.call(t.querySelectorAll('tbody tr'), function (r) { Array.prototype.forEach.call(r.children, function (c, j) { if (h[j]) c.setAttribute('data-l', h[j]); }); });
        });
      }
      lab();
      box.querySelector('[data-seq-scn]').addEventListener('change', function () { reset(); box.querySelector('[data-seq-body]').innerHTML = scenarioBody(S, cur(), k, box.hasAttribute('data-seq-narrow')); lab(); show(-1); });
      box.querySelector('[data-seq-reset]').addEventListener('click', reset);
      box.querySelector('[data-seq-sim]').addEventListener('click', function (e) {
        stop(); var last = cur().steps.length - 1;
        if (reduced() || e.detail === 0) { show(last); return; }
        var i = 0; show(0);
        timer = root.setInterval(function () { if (!box.isConnected || i >= last) { stop(); return; } show(++i); }, STEP_MS);
      });
      show(-1);
    });
  }

  root.RZConvSequence = { block: block, bind: bind, version: '1.0.0' };
})(typeof window !== 'undefined' ? window : this);
