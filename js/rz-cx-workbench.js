/* rz-cx-workbench.js — Cx Analysis workbench (K21, WI-CX-SUPERAPP-001; PRD v1.1 §17, §22, §23).
 * Makes the plan editor behave like an application rather than a form:
 *   - drag a level bar on the timeline to move it, drag its right end to stretch it (0.1 month steps, Esc cancels);
 *     the same on the keyboard (focused bar: arrows move, Shift+arrows change the duration);
 *   - undo / redo of every plan change (buttons, Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z or Ctrl+Y);
 *   - impact panel: what changed against the approved baseline, why each level moved, Δ finish / cost / man-hours /
 *     peak crew, warnings (overlap with the predecessor, months over the site crew cap), the monthly Δ bars, CSV;
 *   - named scenarios (max 5, this browser): Save as, Load, Delete, and a comparison table against the baseline.
 * Numbers: RZCxPlan.compute (RZEngine commissioning.programPlan) and RZCxPlan.impact (differences of two engine
 * plans). This file draws and edits; it computes nothing. Hooks into RZCxAnalysis (state, render hooks). ES5. */
(function (root, doc) {
  'use strict';
  if (!doc) return;
  var A, S, P, W = { hist: [], at: -1, drag: null, quiet: false, focus: null, msg: '' };
  var AMBER = '#D49A2A', GREY = '#7D8794', STEP = 0.1, HMAX = 50;
  function $(id) { return doc.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function money(v) { return A.fmt.money(v); }
  function sgn(v, f) { return !v ? '±0' : (v > 0 ? '+' : '−') + f(Math.abs(v)); }
  function mo(v) { return v.toFixed(1) + ' mo'; }
  function inputs() { return typeof root.cxReadInputs === 'function' ? root.cxReadInputs() : { itLoad: 2000 }; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function snap() { return { overrides: clone(S.overrides || {}), cap: S.cap == null ? null : S.cap, lines: clone((S.extra && S.extra.lines) || []) }; }
  function key(s) { return JSON.stringify(s); }
  function store() { var st = null; try { st = root.localStorage; } catch (e) { st = null; } return P.scenarios(st); }

  /* ── history ── */
  function record() {
    if (W.quiet || W.drag) return;
    var s = snap();
    if (W.at >= 0 && key(W.hist[W.at]) === key(s)) return;
    W.hist = W.hist.slice(0, W.at + 1); W.hist.push(s);
    if (W.hist.length > HMAX) W.hist.shift();
    W.at = W.hist.length - 1;
  }
  function restore(s) {
    S.overrides = clone(s.overrides); S.cap = s.cap; S.extra = S.extra || {}; S.extra.lines = clone(s.lines); S.dirty = true;
    W.quiet = true; try { A.render(); } finally { W.quiet = false; }
    paintHist();
  }
  function undo() { if (W.at > 0) { W.at--; restore(W.hist[W.at]); say('Undone'); } }
  function redo() { if (W.at < W.hist.length - 1) { W.at++; restore(W.hist[W.at]); say('Redone'); } }
  function paintHist() {
    var u = $('cxWbUndo'), r = $('cxWbRedo'); if (!u) return;
    u.disabled = !(W.at > 0); r.disabled = !(W.at < W.hist.length - 1);
    u.title = 'Undo (Ctrl+Z) · ' + W.at + ' step' + (W.at === 1 ? '' : 's') + ' back'; r.title = 'Redo (Ctrl+Shift+Z)';
  }
  function say(t) { W.msg = t; var o = $('cxWbMsg'); if (o) o.textContent = t; }

  /* ── one level change through the same override path the table uses ── */
  function setLevel(id, patch) {
    var next = clone(S.overrides || {}), o = next[id] || {};
    for (var k in patch) if (patch.hasOwnProperty(k)) o[k] = patch[k];
    next[id] = o; S.overrides = P.sanitize(next); S.dirty = true;
  }
  function levelOf(plan, id) { for (var i = 0; plan && i < plan.levels.length; i++) if (plan.levels[i].id === id) return plan.levels[i]; return null; }
  function clamp(v, lim) { return Math.min(lim[1], Math.max(lim[0], Math.round(v / STEP) * STEP)); }

  /* ── drag on the timeline (pointer capture on the stable host: the SVG is rebuilt on every render) ── */
  function scale(svg) {
    var w = +svg.getAttribute('data-cx-w'), pad = +svg.getAttribute('data-cx-pad'), maxM = +svg.getAttribute('data-cx-maxm');
    var px = svg.getBoundingClientRect().width || w;
    return (px * (w - pad - 10) / w) / maxM;   // screen px per month
  }
  var raf = root.requestAnimationFrame ? function (f) { return root.requestAnimationFrame(f); } : function (f) { return root.setTimeout(f, 16); };
  function onDown(e) {
    var t = e.target, id = t.getAttribute && (t.getAttribute('data-cx-edge') || t.getAttribute('data-cx-bar'));
    if (!id || !S.plan || (e.button != null && e.button !== 0)) return;
    var L = levelOf(S.plan, id), svg = t.ownerSVGElement; if (!L || !svg) return;
    e.preventDefault();
    W.drag = { id: id, mode: t.hasAttribute('data-cx-edge') ? 'stretch' : 'move', x0: e.clientX, pxm: scale(svg), start: L.start, months: L.months,
               before: snap(), moved: false, pid: e.pointerId, pending: false };
    var host = $('cxAnTimeline'); try { host.setPointerCapture(e.pointerId); } catch (x) { /* capture is a nicety */ }
    host.classList.add('is-dragging');
    say((W.drag.mode === 'move' ? 'Moving ' : 'Stretching ') + id + ' — release to apply, Esc to cancel');
  }
  function onMove(e) {
    var d = W.drag; if (!d || e.pointerId !== d.pid) return;
    var dm = (e.clientX - d.x0) / (d.pxm || 1);
    if (!d.moved && Math.abs(e.clientX - d.x0) < 3) return;
    d.moved = true;
    var patch = d.mode === 'move' ? { start: +clamp(d.start + dm, P.LIMITS.start).toFixed(2) } : { months: +clamp(d.months + dm, P.LIMITS.months).toFixed(2) };
    var o = (S.overrides && S.overrides[d.id]) || {};
    if ((patch.start != null && o.start === patch.start) || (patch.months != null && o.months === patch.months)) return;
    if (patch.start != null && patch.start === +d.start.toFixed(2) && o.start == null) return;
    setLevel(d.id, patch);
    if (!d.pending) { d.pending = true; raf(function () { if (W.drag) { W.drag.pending = false; A.render(); } }); }
  }
  function end(cancel) {
    var d = W.drag; if (!d) return;
    var host = $('cxAnTimeline'); host.classList.remove('is-dragging'); try { host.releasePointerCapture(d.pid); } catch (x) { /* already released */ }
    W.drag = null;
    if (cancel) { S.overrides = d.before.overrides; W.quiet = true; try { A.render(); } finally { W.quiet = false; } say('Drag cancelled'); return; }
    if (!d.moved) { say(''); return; }
    W.focus = d.id; A.render(); record(); paintHist();
    var L = levelOf(S.plan, d.id); say(d.id + (d.mode === 'move' ? ' moved to M' + L.start.toFixed(1) : ' now ' + L.months.toFixed(1) + ' months') + ' · Ctrl+Z to undo');
  }
  function onKey(e) {
    var t = e.target, id = t.getAttribute && t.getAttribute('data-cx-bar');
    if (W.drag && e.key === 'Escape') { e.preventDefault(); end(true); return; }
    if (id && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault(); var L = levelOf(S.plan, id); if (!L) return;
      var dir = e.key === 'ArrowRight' ? 1 : -1, big = e.altKey ? 10 : 1;
      if (e.shiftKey) setLevel(id, { months: +clamp(L.months + dir * STEP * big, P.LIMITS.months).toFixed(2) });
      else setLevel(id, { start: +clamp(L.start + dir * STEP * big, P.LIMITS.start).toFixed(2) });
      W.focus = id; A.render(); record(); paintHist();
      var N = levelOf(S.plan, id); say(id + ' M' + N.start.toFixed(1) + '–M' + N.end.toFixed(1) + ' (' + N.months.toFixed(1) + ' mo)');
      return;
    }
  }
  function onGlobalKey(e) {
    var tab = $('cxTabAnalysis'); if (!tab || tab.hidden) return;
    var mod = e.ctrlKey || e.metaKey; if (!mod) return;
    var tg = e.target, tn = tg && tg.tagName; if (tn === 'INPUT' && tg.type === 'text' || tn === 'TEXTAREA') return;
    var k = (e.key || '').toLowerCase();
    if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); redo(); }
  }

  /* ── impact panel ── */
  function renderImpact(plan) {
    var h = $('cxWbImpactBody'); if (!h) return;
    if (!plan) { h.innerHTML = '<p class="cx-an-sub">—</p>'; return; }
    var base = P.compute(inputs(), {}), im = P.impact(plan, base, S.cap != null ? S.cap : plan.siteCrewCapDefault);
    W.last = im; if (!im) { h.innerHTML = '<p class="cx-an-sub">—</p>'; return; }
    var changed = im.reasons.length > 0;
    var s = '<dl class="cx-wb-deltas" data-rz-fact-list>' +
      fact('Finish', 'M' + plan.finishMonth.toFixed(1), sgn(im.dFinish, mo)) +
      fact('Total Cx cost', money(plan.total), sgn(im.dCost, money)) +
      fact('Man-hours', P.fmtInt(plan.manHours), sgn(im.dManHours, P.fmtInt)) +
      fact('Peak crew on site', im.peakCrew.toFixed(1), sgn(im.dPeakCrew, function (v) { return v.toFixed(1); })) +
      fact('Months that change', String(im.changedMonths), 'of ' + im.monthly.length) + '</dl>';
    s += '<h4 class="cx-wb-h4">Why</h4>' + (changed
      ? '<ol class="cx-wb-reasons">' + im.reasons.map(function (r) { return '<li data-level="' + r.id + '">' + esc(r.text) + '</li>'; }).join('') + '</ol>'
      : '<p class="cx-an-sub">No change: the plan equals the approved baseline. Drag a bar on the timeline, or edit a row in the plan editor.</p>');
    if (im.warnings.length) s += '<h4 class="cx-wb-h4">Check</h4><ul class="cx-wb-warn">' + im.warnings.map(function (w) { return '<li class="state-' + (w.kind === 'over-cap' ? 'fault' : 'warn') + '" data-kind="' + w.kind + '">' + esc(w.text) + '</li>'; }).join('') + '</ul>';
    s += '<h4 class="cx-wb-h4">Monthly cost, scenario − baseline</h4>' + deltaBars(im.monthly);
    s += '<div class="cx-an-actions"><button type="button" class="tool-btn" id="cxWbCsv">Monthly CSV</button><span class="cx-an-sub">baseline, scenario and Δ per month · cost profile (incurrence)</span></div>';
    h.innerHTML = s;
  }
  function fact(label, value, d) { return '<div><dt>' + esc(label) + '</dt><dd><b>' + esc(value) + '</b> <span class="cx-wb-d">' + esc(d) + '</span></dd></div>'; }
  function deltaBars(rows) {
    var Wd = 820, H = 110, mid = 55, pad = 36, n = rows.length || 1, bw = (Wd - pad - 8) / n, max = 1, i;
    for (i = 0; i < rows.length; i++) max = Math.max(max, Math.abs(rows[i].d));
    var any = false; for (i = 0; i < rows.length; i++) if (Math.abs(rows[i].d) >= 1) any = true;
    var s = '<svg viewBox="0 0 ' + Wd + ' ' + H + '" width="100%" role="img" aria-label="Monthly cost change against the baseline" data-rz-series-meaning="amber = more cost that month, grey = less">';
    s += '<line x1="' + pad + '" y1="' + mid + '" x2="' + (Wd - 8) + '" y2="' + mid + '" stroke="currentColor" stroke-width="1" opacity=".35"/>';
    for (i = 0; i < rows.length; i++) {
      var r = rows[i], hgt = Math.abs(r.d) / max * (mid - 12), x = pad + i * bw;
      if (Math.abs(r.d) >= 1) s += '<rect x="' + (x + 1) + '" y="' + (r.d > 0 ? mid - hgt : mid) + '" width="' + Math.max(1, bw - 2) + '" height="' + Math.max(1, hgt) + '" fill="' + (r.d > 0 ? AMBER : GREY) + '"><title>M' + r.m + ': ' + money(r.scen) + ' vs ' + money(r.base) + ' (' + sgn(r.d, money) + ')</title></rect>';
      if (i % (n > 30 ? 6 : 3) === 0) s += '<text x="' + (x + bw / 2) + '" y="' + (H - 2) + '" font-size="10" text-anchor="middle" fill="currentColor" opacity=".7">M' + r.m + '</text>';
    }
    if (!any) return s + '<text x="' + ((Wd + pad) / 2) + '" y="' + (mid - 8) + '" font-size="11" text-anchor="middle" fill="currentColor" opacity=".75">no change in any month</text></svg>';
    s += '<text x="0" y="14" font-size="10" fill="currentColor" opacity=".7">+' + esc(money(max)) + '</text><text x="0" y="' + (H - 14) + '" font-size="10" fill="currentColor" opacity=".7">−' + esc(money(max)) + '</text></svg>';
    return s;
  }
  function csv() {
    var im = W.last; if (!im) return;
    var out = 'month,baseline_usd,scenario_usd,delta_usd\n' + im.monthly.map(function (r) { return 'M' + r.m + ',' + r.base + ',' + r.scen + ',' + r.d; }).join('\n') + '\n';
    try {
      var url = root.URL.createObjectURL(new root.Blob([out], { type: 'text/csv' })), a = doc.createElement('a');
      a.href = url; a.download = 'cx-monthly-scenario-vs-baseline.csv'; doc.body.appendChild(a); a.click(); a.remove();
      root.setTimeout(function () { root.URL.revokeObjectURL(url); }, 2000);
      say('Monthly CSV saved');
    } catch (e) { say('CSV not available in this browser'); }
  }

  /* ── named scenarios ── */
  function renderScenarios(plan) {
    var h = $('cxWbScenBody'); if (!h) return;
    var list = store().list(), base = P.compute(inputs(), {});
    var rows = [{ name: 'Approved baseline', plan: base, cur: false, saved: false }];
    for (var i = 0; i < list.length; i++) rows.push({ name: list[i].name, plan: P.compute(inputs(), list[i].overrides), cap: list[i].siteCrewCap, saved: true, at: list[i].savedAt });
    rows.push({ name: 'Current (in the editor)', plan: plan, cur: true, saved: false });
    var t = '<div class="cx-an-tablewrap"><table class="cx-an-table cx-wb-scen"><thead><tr><th>Scenario</th><th class="num">Finish</th><th class="num">Δ finish</th><th class="num">Cost</th><th class="num">Δ cost</th><th class="num">Man-hours</th><th class="num">Peak crew</th><th></th></tr></thead><tbody>';
    for (var j = 0; j < rows.length; j++) {
      var r = rows[j], p = r.plan;
      if (!p) { t += '<tr><th scope="row">' + esc(r.name) + '</th><td colspan="7">—</td></tr>'; continue; }
      var pk = Math.max.apply(null, p.monthly.crew.concat([0]));
      t += '<tr' + (r.cur ? ' class="is-current"' : '') + '><th scope="row">' + esc(r.name) + (r.at ? '<span class="cx-an-sub"> · ' + esc(r.at) + '</span>' : '') + '</th>' +
        '<td class="num">M' + p.finishMonth.toFixed(1) + '</td><td class="num">' + sgn(+(p.finishMonth - base.finishMonth).toFixed(1), mo) + '</td>' +
        '<td class="num">' + money(p.total) + '</td><td class="num">' + sgn(p.total - base.total, money) + '</td>' +
        '<td class="num">' + P.fmtInt(p.manHours) + '</td><td class="num">' + pk.toFixed(1) + '</td><td>' +
        (r.saved ? '<button type="button" class="tool-btn" data-wb-load="' + esc(r.name) + '">Load</button> <button type="button" class="tool-btn" data-wb-del="' + esc(r.name) + '" aria-label="Delete ' + esc(r.name) + '">Delete</button>' : '') + '</td></tr>';
    }
    t += '</tbody></table></div>';
    h.innerHTML = t;
    var full = list.length >= P.SCEN_MAX, n = $('cxWbScenCount'); if (n) n.textContent = list.length + ' of ' + P.SCEN_MAX + ' saved' + (full ? ' — delete one to save a new name' : '');
  }
  function saveAs() {
    var inp = $('cxWbName'), nm = inp ? inp.value : '';
    var r = store().save(nm, { overrides: S.overrides, siteCrewCap: S.cap, lines: (S.extra && S.extra.lines) || [] });
    say(r.ok ? (r.code === 'REPLACED' ? 'Scenario "' + nm.trim() + '" replaced' : 'Scenario "' + nm.trim() + '" saved') :
        r.code === 'NAME' ? 'Name it first (1–40 characters)' : r.code === 'FULL' ? P.SCEN_MAX + ' scenarios saved already: delete one, or reuse a name' : 'This browser blocks storage: the scenario stays in the editor only');
    if (r.ok && inp) inp.value = '';
    renderScenarios(S.plan);
  }
  function load(name) {
    var it = store().get(name); if (!it) return;
    S.overrides = it.overrides; S.cap = it.siteCrewCap; S.extra = S.extra || {}; S.extra.lines = it.lines; S.dirty = true;
    A.render(); record(); paintHist(); say('Loaded "' + name + '" into the editor · Save scenario keeps it as the working plan');
  }

  /* ── markup ── */
  function build() {
    var plan = $('cxAnPlanPanel'), tl = $('cxAnTimeline'); if (!plan || !tl || $('cxWbImpact')) return false;
    var acts = plan.querySelector('.cx-an-actions');
    if (acts) {
      var g = doc.createElement('span'); g.className = 'cx-wb-hist';
      g.innerHTML = '<button type="button" class="tool-btn" id="cxWbUndo" disabled>Undo</button><button type="button" class="tool-btn" id="cxWbRedo" disabled>Redo</button>';
      acts.insertBefore(g, acts.firstChild);
    }
    var msg = doc.createElement('p'); msg.className = 'cx-an-sub cx-wb-msg'; msg.id = 'cxWbMsg'; msg.setAttribute('aria-live', 'polite');
    tl.parentNode.insertBefore(msg, tl.nextSibling);
    var tlPanel = tl.closest ? tl.closest('.cx-an-panel') : tl.parentNode;
    var imp = doc.createElement('div'); imp.className = 'cx-an-panel'; imp.id = 'cxWbImpact';
    imp.innerHTML = '<div class="cx-an-panel-head"><h3>Impact</h3><span class="cx-an-sub">this scenario against the approved baseline · every figure is a difference of two engine plans (programPlan)</span></div><div id="cxWbImpactBody"></div>';
    var sc = doc.createElement('div'); sc.className = 'cx-an-panel'; sc.id = 'cxWbScen';
    sc.innerHTML = '<div class="cx-an-panel-head"><h3>Scenarios</h3><span class="cx-an-sub" id="cxWbScenCount"></span></div>' +
      '<div class="cx-an-actions"><label class="cx-an-cap">Name <input type="text" id="cxWbName" maxlength="40" class="input-field" placeholder="e.g. L3 slips one month" aria-label="Scenario name"></label><button type="button" class="tool-btn is-primary" id="cxWbSaveAs">Save as</button><span class="cx-an-sub">up to ' + P.SCEN_MAX + ' named copies, kept in this browser</span></div><div id="cxWbScenBody"></div>';
    tlPanel.parentNode.insertBefore(sc, tlPanel.nextSibling);
    tlPanel.parentNode.insertBefore(imp, tlPanel.nextSibling);
    return true;
  }
  function bind() {
    var host = $('cxAnTimeline');
    host.addEventListener('pointerdown', onDown);
    host.addEventListener('pointermove', onMove);
    host.addEventListener('pointerup', function (e) { if (W.drag && e.pointerId === W.drag.pid) end(false); });
    host.addEventListener('pointercancel', function () { end(true); });
    host.addEventListener('keydown', onKey);
    doc.addEventListener('keydown', function (e) { if (W.drag && e.key === 'Escape') { e.preventDefault(); end(true); } else onGlobalKey(e); });
    $('cxWbUndo').addEventListener('click', undo); $('cxWbRedo').addEventListener('click', redo);
    $('cxWbSaveAs').addEventListener('click', saveAs);
    $('cxWbName').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); saveAs(); } });
    $('cxWbImpact').addEventListener('click', function (e) { if (e.target && e.target.id === 'cxWbCsv') csv(); });
    $('cxWbScen').addEventListener('click', function (e) {
      var t = e.target; if (!t || !t.getAttribute) return;
      var l = t.getAttribute('data-wb-load'), d = t.getAttribute('data-wb-del');
      if (l) load(l);
      else if (d) { store().remove(d); say('Deleted "' + d + '"'); renderScenarios(S.plan); }
    });
  }
  function hook(plan, monthOnly) {
    if (monthOnly) return;   // impact and scenarios do not depend on the status month
    renderImpact(plan); renderScenarios(plan); record(); paintHist();
    if (W.focus) { var q = doc.querySelector('#cxAnTimeline [data-cx-bar="' + W.focus + '"]'); if (q && !W.drag) { q.focus(); W.focus = null; } }
  }
  function init() {
    A = root.RZCxAnalysis; P = root.RZCxPlan; if (!A || !P || !P.impact || !A.state || !A.state.hooks) return;
    S = A.state; if (!build()) return;
    bind(); S.hooks.push(hook); A.render();
  }
  root.RZCxWorkbench = { undo: undo, redo: redo, state: W, version: '3.31.0' };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})(typeof window !== 'undefined' ? window : this, typeof document !== 'undefined' ? document : null);
