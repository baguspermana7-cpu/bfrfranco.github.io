/* rz-fmea-sim.js — the interactive layer over an incident page's FMEA.
 *
 * The static page already carries the RPN bars, the criticality matrix and the
 * worksheet; this file only upgrades them. Three tools, each computed from the
 * dossier's own scores (#fmea-sim-data), never from anything typed here:
 *
 *   Replay    steps through the sequence of events and lights each failure mode at
 *             the first event its evidence cites. Modes citing no timed event are
 *             "latent" and light at the end.
 *   Scenario  re-scores every mode at once: as found, after the published actions,
 *             or two labelled what-ifs (detection at onset, D capped at 6; cause
 *             guarded by design, O capped at 2) that show which lever carries the risk.
 *   What-if   drag one mode's S, O and D; the rubric and the analyst's rationale for
 *             that score sit under each slider, and the matrix draws where it moves.
 *
 * Motion: bar lengths and matrix markers retarget with transitions (state
 * indication, 200ms, --rz-ease-in-out); nothing animates under reduced motion
 * except opacity. */
(function () {
  'use strict';
  var dataEl = document.getElementById('fmea-sim-data');
  var sim = document.querySelector('[data-fm-sim]');
  if (!dataEl || !sim) return;
  var D;
  try { D = JSON.parse(dataEl.textContent); } catch (e) { console.error('[fmea-sim] unreadable data', e); return; }
  if (!D || !D.modes || !D.modes.length) return;

  var NS = 'http://www.w3.org/2000/svg';
  var PRIO_VAR = { high: 'var(--red)', medium: 'var(--amber)', low: 'var(--green)' };
  var PRIO_LABEL = { high: 'High', medium: 'Medium', low: 'Low' };
  var L = 44, T = 14, CELL = 28;
  var byId = {};
  D.modes.forEach(function (m) { byId[m.id] = m; });
  var lastStep = D.soe.length - 1;
  var state = { scn: 'found', step: lastStep, sel: null, over: {}, timer: null };

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function svg(tag, attrs) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }
  function rpn(s) { return s.S * s.O * s.D; }
  function priority(s) {
    var r = rpn(s);
    if ((s.S >= 9 && (s.O >= 4 || s.D >= 7)) || r >= 300) return 'high';
    if (r >= 120 || s.S >= 7) return 'medium';
    return 'low';
  }
  function base(m) { return { S: m.S, O: m.O, D: m.D }; }
  function scenarioScore(m) {
    var s = base(m);
    if (state.scn === 'actions' && m.rev) s = { S: m.rev.S, O: m.rev.O, D: m.rev.D };
    if (state.scn === 'detect') s.D = Math.min(s.D, 6);
    if (state.scn === 'guard') s.O = Math.min(s.O, 2);
    return s;
  }
  function score(m) { return state.over[m.id] || scenarioScore(m); }
  function firstStep(m) { return m.soe.length ? m.soe[0] : lastStep; }
  function inPlay(m) { return state.step >= lastStep || firstStep(m) <= state.step; }
  function fmt(n) { return n.toLocaleString('en-US'); }

  /* ── scenario bar + readout ─────────────────────────────────────────────── */
  var SCN = [
    ['found', 'As found', 'Scores as the incident found the system.'],
    ['actions', 'Published actions', 'Revised scores where the operator published an action; the rest stay.'],
    ['detect', 'What-if: detect at onset', 'Hypothetical. Every D capped at 6 — the fault is seen when it starts.'],
    ['guard', 'What-if: guard the cause', 'Hypothetical. Every O capped at 2 — the cause is guarded by design.']
  ];
  var scnBox = sim.querySelector('.fm-scn');
  var seg = el('div', 'fm-seg');
  seg.setAttribute('role', 'radiogroup');
  seg.setAttribute('aria-label', 'Scoring scenario');
  var scnNote = el('p', 'fm-scn-note');
  var readout = el('p', 'metabar fm-readout');
  readout.setAttribute('aria-live', 'polite');
  SCN.forEach(function (s) {
    var b = el('button', null, s[1]);
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.dataset.scn = s[0];
    b.addEventListener('click', function () { state.scn = s[0]; state.over = {}; render(); });
    seg.appendChild(b);
  });
  scnBox.appendChild(seg);
  scnBox.appendChild(scnNote);
  scnBox.appendChild(readout);
  scnBox.hidden = false;

  function renderScenario() {
    [].forEach.call(seg.children, function (b) { b.setAttribute('aria-checked', String(b.dataset.scn === state.scn)); });
    var meta = SCN.filter(function (s) { return s[0] === state.scn; })[0];
    var edited = Object.keys(state.over).length;
    scnNote.textContent = meta[2] + (edited ? ' Plus your edit to ' + Object.keys(state.over).join(', ') + '.' : '');
    var t0 = 0, t1 = 0, hi = 0;
    D.modes.forEach(function (m) {
      t0 += rpn(base(m));
      var s = score(m);
      t1 += rpn(s);
      if (priority(s) === 'high') hi++;
    });
    var d = t0 ? Math.round(100 * (t1 - t0) / t0) : 0;
    readout.textContent = '';
    [['total RPN ', fmt(t1)], ['', (d > 0 ? '+' : d < 0 ? '−' : '±') + Math.abs(d) + '%', ' vs as found'],
      ['', hi + ' of ' + D.modes.length, ' high priority']].forEach(function (r, n) {
      if (n) readout.appendChild(el('span', 'sep', '/'));
      var w = el('span', null, r[0]);
      w.appendChild(el('b', null, r[1]));
      if (r[2]) w.appendChild(document.createTextNode(r[2]));
      readout.appendChild(w);
    });
  }

  /* ── RPN bars ───────────────────────────────────────────────────────────── */
  var pb = sim.querySelector('.fm-pb');
  var scale = Number(pb && pb.dataset.scale) || 1000;
  var cap = sim.querySelector('.fm-pb-cap');
  var rows = pb ? [].slice.call(pb.querySelectorAll('.fm-pb-row')) : [];
  rows.forEach(function (r) {
    var m = byId[r.dataset.id];
    if (!m) return;
    r.tabIndex = 0;
    r.setAttribute('role', 'button');
    r.setAttribute('aria-label', m.id + ' ' + m.fm + ' — open in what-if');
    var track = r.querySelector('.fm-pb-track');
    var ghost = track.querySelector('.fm-pb-rev') || el('i', 'fm-pb-rev');
    var none = track.querySelector('.fm-pb-none');
    if (none) none.remove();
    ghost.classList.add('fm-pb-ref');
    track.appendChild(ghost);
    r.addEventListener('click', function () { select(m.id); });
    r.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(m.id); } });
  });

  function renderBars() {
    var changed = state.scn !== 'found' || Object.keys(state.over).length;
    if (cap) cap.textContent = changed ? 'RPN under this scenario. Thin bar: as found.' : 'RPN = S × O × D, worst first. Select a row to test it.';
    rows.forEach(function (r) {
      var m = byId[r.dataset.id];
      if (!m) return;
      var s = score(m), r1 = rpn(s), r0 = rpn(base(m));
      var bar = r.querySelector('.fm-pb-bar'), ghost = r.querySelector('.fm-pb-ref');
      bar.style.transform = 'scaleX(' + Math.min(1, r1 / scale) + ')';
      bar.style.background = PRIO_VAR[priority(s)];
      ghost.style.transform = 'scaleX(' + Math.min(1, r0 / scale) + ')';
      ghost.style.opacity = r1 === r0 ? '0' : '';
      r.querySelector('.fm-pb-val').textContent = r1 === r0 ? String(r0) : r0 + ' → ' + r1;
      r.classList.toggle('is-dim', !inPlay(m));
      r.setAttribute('aria-current', String(state.sel === m.id));
    });
  }

  /* ── matrix ─────────────────────────────────────────────────────────────── */
  var mx = sim.querySelector('.fm-matrix');
  var pts = mx && mx.querySelector('.fm-pts');
  function gx(o) { return L + (o - 0.5) * CELL; }
  function gy(s) { return T + (10.5 - s) * CELL; }

  // Same search as tools/incidents_fmea.matrix_svg: above, below, right, left —
  // first slot clear of every marker and label already placed.
  function renderMatrix() {
    if (!pts) return;
    var ae = document.activeElement, keep = ae && pts.contains(ae) ? ae.getAttribute('data-ids') : null;
    while (pts.firstChild) pts.removeChild(pts.firstChild);
    var cells = {};
    D.modes.forEach(function (m) {
      var s = score(m), k = s.S + ':' + s.O;
      (cells[k] = cells[k] || { S: s.S, O: s.O, ms: [] }).ms.push(m);
    });
    var list = Object.keys(cells).map(function (k) { return cells[k]; });
    var placed = list.map(function (c) { var x = gx(c.O), y = gy(c.S); return [x - 6, y - 6, x + 6, y + 6]; });
    function clash(b) { return placed.some(function (q) { return b[0] < q[2] && q[0] < b[2] && b[1] < q[3] && q[1] < b[3]; }); }
    var rank = { high: 0, medium: 1, low: 2 };
    list.sort(function (a, b) { return b.S - a.S || a.O - b.O; });
    if (state.sel) {
      var m0 = byId[state.sel], a = scenarioScore(m0), b = score(m0);
      if (a.S !== b.S || a.O !== b.O) {
        pts.appendChild(svg('line', { 'class': 'fm-wi-path', x1: gx(a.O), y1: gy(a.S), x2: gx(b.O), y2: gy(b.S) }));
        pts.appendChild(svg('circle', { 'class': 'fm-wi-from', cx: gx(a.O), cy: gy(a.S), r: 8 }));
      }
    }
    list.forEach(function (c) {
      var ms = c.ms.slice().sort(function (p, q) { return p.id < q.id ? -1 : 1; });
      var worst = ms.reduce(function (w, m) { return rank[priority(score(m))] < rank[priority(score(w))] ? m : w; });
      var live = ms.some(inPlay);
      var cx = gx(c.O), cy = gy(c.S);
      var ids = ms.map(function (m) { return m.id.replace('FM-', ''); }).join(', ');
      var dot = svg('circle', { 'class': 'fm-pt' + (live ? '' : ' is-dim') + (ms.some(function (m) { return m.id === state.sel; }) ? ' is-sel' : ''),
        cx: cx, cy: cy, r: 6, fill: PRIO_VAR[priority(score(worst))], tabindex: 0, role: 'button',
        'data-ids': ms.map(function (m) { return m.id; }).join(' ') });
      var tip = svg('title', {});
      tip.textContent = ms.map(function (m) { var s = score(m); return m.id + ' ' + m.fm + ' (S' + s.S + ' O' + s.O + ' D' + s.D + ')'; }).join('; ');
      dot.appendChild(tip);
      dot.addEventListener('click', function () { cycle(ms); });
      dot.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cycle(ms); } });
      pts.appendChild(dot);
      var w = 6 * ids.length + 2;
      var slots = [
        [cx, cy - 10, 'middle', [cx - w / 2, cy - 20, cx + w / 2, cy - 8]],
        [cx, cy + 18, 'middle', [cx - w / 2, cy + 8, cx + w / 2, cy + 20]],
        [cx + 9, cy + 4, 'start', [cx + 9, cy - 6, cx + 9 + w, cy + 6]],
        [cx - 9, cy + 4, 'end', [cx - 9 - w, cy - 6, cx - 9, cy + 6]]
      ];
      var sl = slots.filter(function (z) { return !clash(z[3]); })[0] || slots[0];
      placed.push(sl[3]);
      var t = svg('text', { 'class': 'fm-pt-l' + (live ? '' : ' is-dim'), x: sl[0], y: sl[1], 'text-anchor': sl[2] });
      t.textContent = ids;
      pts.appendChild(t);
    });
    if (keep) { var back = pts.querySelector('[data-ids="' + keep + '"]'); if (back) back.focus(); }
  }
  function cycle(ms) {
    var i = ms.map(function (m) { return m.id; }).indexOf(state.sel);
    select(ms[(i + 1) % ms.length].id);
  }

  /* ── what-if inspector ──────────────────────────────────────────────────── */
  var wi = sim.querySelector('.fm-wi');
  var LEVER = { S: 'Severity', O: 'Occurrence', D: 'Detection' };
  function rubricText(k, v) {
    var rows = D.rubric[k], exact = null, lo = null, hi = null;
    rows.forEach(function (r) { if (r[0] === v) exact = r; if (r[0] < v && (!lo || r[0] > lo[0])) lo = r; if (r[0] > v && (!hi || r[0] < hi[0])) hi = r; });
    if (exact) return exact[1];
    return 'Between ' + (lo ? lo[0] : 1) + ' and ' + (hi ? hi[0] : 10) + ': ' + (lo ? lo[1] : '');
  }
  function select(id, noScroll) {
    state.sel = id;
    render();
    if (!noScroll && wi.getBoundingClientRect().top > window.innerHeight || wi.getBoundingClientRect().bottom < 0) {
      wi.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
  }
  // Built once per selection and updated in place: rebuilding on every `input`
  // would replace the range under the pointer and end the drag.
  var ui = null;
  function buildInspector(m) {
    wi.innerHTML = '';
    ui = { id: m.id, rows: {} };
    var head = el('div', 'fm-wi-head');
    head.appendChild(el('span', 'fm-wi-id', m.id));
    head.appendChild(el('span', 'fm-wi-title', m.fm));
    var close = el('button', 'fm-wi-x', 'Close');
    close.type = 'button';
    close.addEventListener('click', function () { delete state.over[m.id]; state.sel = null; render(); });
    head.appendChild(close);
    wi.appendChild(head);
    ui.out = el('p', 'fm-wi-out');
    ui.out.setAttribute('aria-live', 'polite');
    wi.appendChild(ui.out);
    ['S', 'O', 'D'].forEach(function (k) {
      var row = el('div', 'fm-wi-row');
      var lab = el('label', 'fm-wi-k');
      lab.htmlFor = 'fmwi-' + k;
      var inp = el('input');
      inp.type = 'range'; inp.min = 1; inp.max = 10; inp.step = 1; inp.id = 'fmwi-' + k;
      inp.addEventListener('input', function () {
        var cur = score(m), next = { S: cur.S, O: cur.O, D: cur.D };
        next[k] = Number(inp.value);
        state.over[m.id] = next;
        render();
      });
      var rub = el('p', 'fm-wi-rub');
      row.appendChild(lab); row.appendChild(inp); row.appendChild(rub);
      row.appendChild(el('p', 'fm-wi-why', 'Analyst, at ' + m[k] + ': ' + (m.why[k] || '')));
      wi.appendChild(row);
      ui.rows[k] = { lab: lab, inp: inp, rub: rub };
    });
    var acts = el('div', 'fm-wi-acts');
    if (m.rev) {
      var ap = el('button', null, 'Apply published action (S' + m.rev.S + ' O' + m.rev.O + ' D' + m.rev.D + ')');
      ap.type = 'button';
      ap.addEventListener('click', function () { state.over[m.id] = { S: m.rev.S, O: m.rev.O, D: m.rev.D }; render(); });
      acts.appendChild(ap);
    } else {
      acts.appendChild(el('span', 'fm-residual', 'No published action — residual risk.'));
    }
    ui.reset = el('button', null, 'Reset');
    ui.reset.type = 'button';
    ui.reset.addEventListener('click', function () { delete state.over[m.id]; render(); });
    acts.appendChild(ui.reset);
    wi.appendChild(acts);
  }
  function renderInspector() {
    if (!state.sel) { wi.hidden = true; ui = null; return; }
    var m = byId[state.sel];
    if (!ui || ui.id !== m.id) buildInspector(m);
    wi.hidden = false;
    var s = score(m), a = scenarioScore(m), r0 = rpn(a), r1 = rpn(s), p = priority(s);
    ui.out.textContent = '';
    ui.out.appendChild(document.createTextNode('RPN '));
    ui.out.appendChild(el('b', null, r0 === r1 ? String(r1) : r0 + ' → ' + r1));
    ui.out.appendChild(document.createTextNode(' · '));
    var dot = el('i', 'fm-dot');
    dot.style.background = PRIO_VAR[p];
    ui.out.appendChild(dot);
    ui.out.appendChild(document.createTextNode(PRIO_LABEL[p] + ' priority'));
    ['S', 'O', 'D'].forEach(function (k) {
      var r = ui.rows[k];
      r.lab.textContent = LEVER[k] + ' ';
      r.lab.appendChild(el('b', null, String(s[k])));
      if (s[k] !== m[k]) r.lab.appendChild(el('span', 'fm-wi-was', 'scored ' + m[k]));
      if (Number(r.inp.value) !== s[k]) r.inp.value = s[k];
      r.rub.textContent = rubricText(k, s[k]);
    });
    ui.reset.disabled = !state.over[m.id];
  }

  /* ── replay ─────────────────────────────────────────────────────────────── */
  var rp = sim.querySelector('.fm-replay');
  var newAt = {};
  D.modes.forEach(function (m) { var k = firstStep(m); (newAt[k] = newAt[k] || []).push(m); });
  var renderReplay = null;
  var latent = D.modes.filter(function (m) { return !m.soe.length; });
  if (D.soe.length > 1) {
    var bar = el('div', 'fm-rp-bar');
    var play = el('button', 'fm-rp-play', 'Replay');
    play.type = 'button';
    var prev = el('button', 'fm-rp-step', '‹'); prev.type = 'button'; prev.setAttribute('aria-label', 'Previous event');
    var next = el('button', 'fm-rp-step', '›'); next.type = 'button'; next.setAttribute('aria-label', 'Next event');
    var range = el('input', 'fm-rp-range');
    range.type = 'range'; range.min = 0; range.max = lastStep; range.step = 1;
    range.setAttribute('aria-label', 'Sequence of events step');
    var ticks = el('div', 'fm-rp-ticks');
    ticks.setAttribute('aria-hidden', 'true');
    D.soe.forEach(function (e, i) {
      var t = el('i');
      if (newAt[i] && !(i === lastStep && newAt[i].every(function (m) { return !m.soe.length; }))) t.className = 'has-new';
      ticks.appendChild(t);
    });
    var meta = el('p', 'fm-rp-meta');
    var ev = el('p', 'fm-rp-ev');
    var news = el('ul', 'fm-rp-new');
    var count = el('p', 'fm-rp-count');
    count.setAttribute('aria-live', 'polite');
    bar.appendChild(play); bar.appendChild(prev); bar.appendChild(next);
    var trackWrap = el('div', 'fm-rp-track');
    trackWrap.appendChild(range); trackWrap.appendChild(ticks);
    bar.appendChild(trackWrap);
    rp.appendChild(bar); rp.appendChild(meta); rp.appendChild(ev); rp.appendChild(news); rp.appendChild(count);
    rp.hidden = false;

    var go = function (k) { state.step = Math.max(0, Math.min(lastStep, k)); render(); };
    var stop = function () { clearInterval(state.timer); state.timer = null; play.textContent = state.step >= lastStep ? 'Replay' : 'Resume'; };
    play.addEventListener('click', function () {
      if (state.timer) { stop(); return; }
      if (state.step >= lastStep) state.step = 0;
      render();
      play.textContent = 'Pause';
      state.timer = setInterval(function () {
        if (state.step >= lastStep) { stop(); return; }
        go(state.step + 1);
        if (state.step >= lastStep) stop();
      }, 2200);
    });
    prev.addEventListener('click', function () { go(state.step - 1); stop(); });
    next.addEventListener('click', function () { go(state.step + 1); stop(); });
    range.addEventListener('input', function () { go(Number(range.value)); stop(); });

    renderReplay = function () {
      var k = state.step, e = D.soe[k];
      range.value = k;
      [].forEach.call(ticks.children, function (t, i) { t.classList.toggle('is-past', i <= k); });
      meta.textContent = 'Event ' + (k + 1) + ' of ' + D.soe.length + ' · ' + (e.ph || '—') + ' · ' + e.t;
      ev.textContent = e.ev;
      news.innerHTML = '';
      var fresh = (newAt[k] || []).filter(function (m) { return m.soe.length; });
      if (k >= lastStep && latent.length) fresh = fresh.concat(latent);
      fresh.forEach(function (m) {
        var li = el('li');
        var b = el('button', null);
        b.type = 'button';
        b.appendChild(el('span', 'fm-rp-id', m.id + (m.soe.length ? '' : ' · latent')));
        b.appendChild(document.createTextNode(m.fm));
        b.addEventListener('click', function () { stop(); select(m.id); });
        li.appendChild(b);
        news.appendChild(li);
      });
      if (!fresh.length) news.appendChild(el('li', 'fm-rp-none', 'No new failure mode at this event.'));
      var live = D.modes.filter(inPlay), r = 0, all = 0;
      live.forEach(function (m) { r += rpn(score(m)); });
      D.modes.forEach(function (m) { all += rpn(score(m)); });
      count.textContent = 'In play: ' + live.length + ' of ' + D.modes.length + ' failure modes · RPN ' + fmt(r) + ' of ' + fmt(all);
    };
  }

  /* ── worksheet hooks ────────────────────────────────────────────────────── */
  [].forEach.call(document.querySelectorAll('.fm-wi-open'), function (b) {
    b.hidden = false;
    b.addEventListener('click', function () { select(b.dataset.id); });
  });

  function render() {
    renderScenario();
    renderBars();
    renderMatrix();
    renderInspector();
    if (renderReplay) renderReplay();
  }
  sim.classList.add('is-live');
  render();

  // Deep link from the library-wide view: #FM-03 opens that worksheet row, scrolls
  // to it, and loads the mode in the what-if without stealing the scroll.
  function fromHash() {
    var id = decodeURIComponent(location.hash.slice(1));
    if (!byId[id]) return;
    var row = document.getElementById(id);
    if (row && row.tagName === 'DETAILS') { row.open = true; row.scrollIntoView({ block: 'start' }); }
    select(id, true);
  }
  fromHash();
  window.addEventListener('hashchange', fromHash);
})();
