/* rz-cx-analysis.js — the "Cx Analysis" tab on cx-calculator.html (v3.26.0, WI-CX-SUPERAPP-001, PRD v1.1 §6–7,
 * §12, §17–23). Zero-build ES5. Reads the calculator's inputs (cxReadInputs), computes through
 * RZCxPlan.compute → RZEngine.models.commissioning.programPlan (the only arithmetic), and draws:
 *   · tab strip (Calculator | Cx Analysis) in .tool-bar; the Calculator tab's DOM is untouched
 *   · KPI strip, plan editor (L0–L6: start / months / crew / shift), site crew cap
 *   · level timeline (baseline ghost + scenario), monthly cost, cumulative, crew histogram
 *   · month scrubber + per-system status table (RZCxPlan.statusAt) — the data the schematic (P2) draws
 *   · inspector for the selected level / system with handbook links
 * State: overrides + site cap in localStorage (RZCxPlan.store); month, tab, selection in the URL hash.
 * No number is computed here: every figure is read from the plan object. */
(function (root, doc) {
  'use strict';
  if (!doc || !root.RZCxPlan) return;
  var P = root.RZCxPlan;
  var S = { plan: null, overrides: {}, cap: null, month: 0, sel: null, charts: {}, tab: 'calc', ready: false, dirty: false, sheet: 'electrical', extra: { calendar: { anchor: null, slot: false }, lines: [] }, hooks: [] };
  var store = P.store((function () { try { return root.localStorage; } catch (e) { return null; } })());
  var AMBER = '#D49A2A', GREY = '#7D8794', GREY2 = '#A0AEC0', GRID = 'rgba(148,163,184,0.08)';

  /* ── helpers ── */
  function $(id) { return doc.getElementById(id); }
  function el(tag, cls, html) { var e = doc.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function money(v) { return (typeof root.cxFmtCur === 'function' && root.cxSelectedCurrency && root.cxSelectedCurrency !== 'USD') ? root.cxFmtCur(v) : P.fmtUsd(v); }
  function delta(v, fmt) { if (!v) return '±0'; return (v > 0 ? '+' : '−') + fmt(Math.abs(v)); }
  function one(v) { return (Math.round(v * 10) / 10).toFixed(1); }
  function inputs() { return typeof root.cxReadInputs === 'function' ? root.cxReadInputs() : { itLoad: 2000 }; }
  function sysById(id) { for (var i = 0; i < P.SYSTEMS.length; i++) if (P.SYSTEMS[i].id === id) return P.SYSTEMS[i]; return null; }
  function lvById(id) { for (var i = 0; i < P.LEVELS.length; i++) if (P.LEVELS[i].id === id) return P.LEVELS[i]; return null; }
  function planLevel(id) { if (!S.plan) return null; for (var i = 0; i < S.plan.levels.length; i++) if (S.plan.levels[i].id === id) return S.plan.levels[i]; return null; }

  /* ── compute ── */
  function recompute() {
    var over = S.overrides;
    S.plan = P.compute(inputs(), over);
    if (S.plan && S.cap != null) S.plan.siteCrewCap = S.cap;
    if (S.plan && S.month > S.plan.finishMonth) S.month = Math.floor(S.plan.finishMonth);
    return S.plan;
  }

  /* ── markup ── */
  function build() {
    var bar = doc.querySelector('.tool-bar'); var bench = doc.querySelector('.tool-bench');
    if (!bar || !bench || $('cxTabAnalysis')) return false;
    // tab strip: the register's own .tool-tabs row (amber underline), its own row ABOVE the bar so the bar keeps its 6 controls (register T13 counts .seg buttons one by one)
    var seg = el('div', 'tool-tabs cx-tabs'); seg.setAttribute('role', 'tablist'); seg.setAttribute('aria-label', 'Page view');
    seg.innerHTML = '<button type="button" id="cxTabBtnCalc" role="tab" aria-selected="true" aria-controls="cxTabCalc">Calculator</button>' +
      '<button type="button" id="cxTabBtnAnalysis" role="tab" aria-selected="false" aria-controls="cxTabAnalysis">Cx Analysis</button>';
    bar.parentNode.insertBefore(seg, bar);
    // wrap the calculator (DOM inside untouched)
    var wrapCalc = el('div'); wrapCalc.id = 'cxTabCalc'; wrapCalc.setAttribute('role', 'tabpanel');
    bench.parentNode.insertBefore(wrapCalc, bench); wrapCalc.appendChild(bench);
    var below = bench.parentNode.parentNode.querySelector('.cx-below'); if (below) wrapCalc.appendChild(below);
    // the reference / glossary .wrap blocks that follow the tool wrap belong to the calculator view too
    S.extras = []; var sib = wrapCalc.parentNode.nextElementSibling;
    while (sib && sib.tagName !== 'FOOTER') { if (sib.classList.contains('wrap') || sib.classList.contains('tool-ref')) S.extras.push(sib); sib = sib.nextElementSibling; }
    var panel = el('section', 'cx-an'); panel.id = 'cxTabAnalysis'; panel.setAttribute('role', 'tabpanel'); panel.hidden = true;
    panel.innerHTML =
      '<div class="cx-an-head res-head"><h2>Cx Analysis</h2><span class="basis">source: <a href="cx-handbook/index.html">Cx Field Manual</a> ch 02 (levels, gates, tags, durations), 07, 11, 28, 30 · numbers: RZEngine commissioning.programPlan · months relative to program start (M0)</span></div>' +
      '<p class="cx-an-note" id="cxAnEngineNote" hidden>Engine not loaded — the plan cannot be computed. <button type="button" class="tool-btn" id="cxAnRetry">Retry</button></p>' +
      '<div class="cx-an-kpis" id="cxAnKpis" data-rz-fact-list></div>' +
      '<div class="cx-an-panel" id="cxAnSchematic"><div class="cx-an-panel-head"><h3>Giant schematic</h3><span class="cx-an-sub" id="cxAnSchematicSub">three sheets, one per block · node colour = Cx tag at the viewed month (handbook <a href="' + P.CITES.tags + '">02.6</a>) · a halo marks a gate passed in that month · click a node to inspect · Representative, conceptual</span></div>' +
      '<div class="cx-an-sheet-tabs seg" role="tablist" aria-label="Schematic sheet"><button type="button" data-sheet="electrical" aria-pressed="true">A · Electrical</button><button type="button" data-sheet="mechanical" aria-pressed="false">B · Mechanical / P&amp;ID</button><button type="button" data-sheet="controls" aria-pressed="false">C · Controls</button></div>' +
      '<div class="cx-an-sheet-zoom seg" role="group" aria-label="Sheet zoom"><button type="button" data-zoom="fit" aria-pressed="true">Fit</button><button type="button" data-zoom="150" aria-pressed="false">150 %</button><button type="button" data-zoom="200" aria-pressed="false">200 %</button></div>' +
      '<div class="cx-an-sheets" id="cxAnSheets" data-zoom="fit" data-rz-series-meaning="handbook tag colours and service mediums"></div></div>' +
      '<div class="cx-an-panel" id="cxAnCampus"><div class="cx-an-panel-head"><h3>3D plant</h3><span class="cx-an-sub">representative campus from the site basis · equipment tinted by its system\'s Cx tag at the viewed month · click a building to lift its roof, click the ground or press 0 to return · drag to orbit, wheel to zoom, keys 1–4 presets</span></div>' +
      '<div class="cx-3d-bar"><div class="seg" role="group" aria-label="Camera preset"><button type="button" data-cam="campus">Campus</button><button type="button" data-cam="hall">Hall</button><button type="button" data-cam="plant">Plant</button><button type="button" data-cam="sub">Substation</button></div>' +
      '<button type="button" class="tool-btn" data-roof>Roof off</button><button type="button" class="tool-btn" data-pause aria-pressed="false">Pause flows</button><span class="cx-3d-crumb" aria-live="polite"></span></div>' +
      '<div class="cx-3d-stage"><canvas tabindex="0" aria-label="3D plant: orbit with the pointer or arrow keys"></canvas></div>' +
      '<p class="cx-an-sub cx-3d-note"></p></div>' +
      '<div class="cx-an-grid">' +
      '<div class="cx-an-main">' +
      '<div class="cx-an-panel" id="cxAnPlanPanel"><div class="cx-an-panel-head"><h3>Plan editor</h3><span class="cx-an-sub">Edit start, duration, crew or shift per level. Successors carry serially (handbook 02.4). A pure date shift keeps the total; duration and crew change the labour line only.</span></div>' +
      '<div class="cx-an-tablewrap"><table class="cx-an-table" id="cxAnPlanTable"><thead><tr><th>Level</th><th>Start</th><th>Months</th><th>Crew</th><th>Shift</th><th class="num">Crew needed</th><th class="num">Man-hours</th><th class="num">Cost</th><th class="num">Δ</th></tr></thead><tbody></tbody></table></div>' +
      '<div class="cx-an-actions"><label class="cx-an-cap">Site crew cap <input type="number" id="cxAnCap" min="1" max="1000" step="1" class="input-field" aria-label="Site crew cap"></label>' +
      '<span class="spacer"></span><span class="cx-an-state" id="cxAnState" aria-live="polite"></span>' +
      '<button type="button" class="tool-btn" id="cxAnRevert">Revert</button><button type="button" class="tool-btn" id="cxAnReset">Reset to baseline</button><button type="button" class="tool-btn is-primary" id="cxAnSave">Save scenario</button></div></div>' +
      '<div class="cx-an-panel"><div class="cx-an-panel-head"><h3>Level timeline</h3><span class="cx-an-sub">grey = approved baseline · amber = scenario · month scrubber sets the status month</span></div><div id="cxAnTimeline" class="cx-an-timeline" aria-label="Level timeline"></div>' +
      '<div class="cx-an-scrub"><label for="cxAnMonth">Month</label><input type="range" id="cxAnMonth" min="0" max="20" step="1" value="0" aria-label="Status month"><output id="cxAnMonthOut" for="cxAnMonth">M0</output><button type="button" class="tool-btn" id="cxAnPrev" aria-label="Previous month">‹</button><button type="button" class="tool-btn" id="cxAnNext" aria-label="Next month">›</button><button type="button" class="tool-btn" id="cxAnPlay" aria-pressed="false">Play</button></div></div>' +
      '<div class="cx-an-panel"><div class="cx-an-panel-head"><h3>Status by system</h3><span class="cx-an-sub" id="cxAnStatusSub">tag = last level whose gate falls on or before the month (handbook <a href="' + P.CITES.tags + '">02.6</a>); order inside a window per <a href="' + P.CITES.durations + '">02.4.8</a></span></div>' +
      '<div class="cx-an-counts" id="cxAnCounts" data-rz-series-meaning="handbook tag colours"></div>' +
      '<div class="cx-an-tablewrap"><table class="cx-an-table cx-an-status" id="cxAnStatusTable" data-rz-series-meaning="handbook tag colours"><thead><tr><th>System</th><th>Block</th><th>Level</th><th>Tag</th><th>Next gate</th><th>State</th></tr></thead><tbody></tbody></table></div></div>' +
      '<div class="cx-an-panel"><div class="cx-an-panel-head"><h3>Monthly cost</h3><span class="cx-an-sub">cost profile (incurrence), uniform inside each level window · baseline vs scenario</span></div><div class="cx-an-chart"><canvas id="cxAnChartMonthly" height="220"></canvas></div></div>' +
      '<div class="cx-an-two"><div class="cx-an-panel"><div class="cx-an-panel-head"><h3>Cumulative cost</h3></div><div class="cx-an-chart"><canvas id="cxAnChartCum" height="200"></canvas></div></div>' +
      '<div class="cx-an-panel"><div class="cx-an-panel-head"><h3>Crew on site per month</h3><span class="cx-an-sub">line = site crew cap</span></div><div class="cx-an-chart"><canvas id="cxAnChartCrew" height="200"></canvas></div></div></div>' +
      '</div>' +
      '<aside class="cx-an-inspector" id="cxAnInspector" aria-label="Inspector"><div class="cx-an-panel-head"><h3 id="cxAnInsTitle">Inspector</h3></div><div id="cxAnInsBody" class="cx-an-ins-body"><p class="cx-an-sub">Select a level row or a system row.</p></div></aside>' +
      '</div>';
    wrapCalc.parentNode.insertBefore(panel, wrapCalc.nextSibling);
    return true;
  }

  /* ── tab switching ── */
  function setTab(tab, push) {
    S.tab = tab;
    var a = tab === 'analysis';
    $('cxTabCalc').hidden = a; $('cxTabAnalysis').hidden = !a;
    for (var i = 0; i < (S.extras || []).length; i++) S.extras[i].hidden = a;
    $('cxTabBtnCalc').setAttribute('aria-selected', String(!a)); $('cxTabBtnAnalysis').setAttribute('aria-selected', String(a));
    if (push !== false) { try { var u = new URL(root.location.href); if (a) u.searchParams.set('tab', 'analysis'); else u.searchParams.delete('tab'); root.history.replaceState(null, '', u.toString()); } catch (e) { /* no history */ } }
    if (a) render();
  }

  /* ── render ── */
  function render() {
    if (!$('cxTabAnalysis') || $('cxTabAnalysis').hidden) return;
    var plan = recompute();
    $('cxAnEngineNote').hidden = !!plan;
    renderKpis(plan); renderPlanTable(plan); renderTimeline(plan); renderSchematic(plan); renderStatus(plan); renderCharts(plan); renderInspector(plan); syncCampus();
    for (var hk = 0; hk < S.hooks.length; hk++) { try { S.hooks[hk](plan); } catch (e) { /* an extension never breaks the tab */ } }
    $('cxAnState').textContent = !plan ? '' : (S.dirty ? 'Unsaved scenario' : (hasOverrides() ? 'Saved scenario' : 'Approved baseline'));
  }
  function hasOverrides() { for (var k in S.overrides) if (S.overrides.hasOwnProperty(k)) return true; return false; }

  function kpi(label, value, sub, key) { return '<div class="cx-kpi-card' + (key ? ' is-key' : '') + '"><div class="cx-kpi-value">' + value + '</div><div class="cx-kpi-label">' + label + '</div><div class="cx-kpi-sub">' + (sub || '') + '</div></div>'; }
  function renderKpis(plan) {
    var h = $('cxAnKpis');
    if (!plan) { h.innerHTML = kpi('Finish', '—') + kpi('Total Cx cost', '—') + kpi('Man-hours', '—') + kpi('Peak month', '—'); return; }
    var maxCrew = 0, over = 0, cap = plan.siteCrewCap || plan.siteCrewCapDefault;
    for (var i = 0; i < plan.monthly.crew.length; i++) { if (plan.monthly.crew[i] > maxCrew) maxCrew = plan.monthly.crew[i]; if (plan.monthly.crew[i] > cap) over++; }
    h.innerHTML =
      kpi('Finish', P.fmtMo(plan.finishMonth), delta(plan.finishMonth - plan.baselineFinish, function (v) { return one(v) + ' mo'; }) + ' vs baseline ' + P.fmtMo(plan.baselineFinish), true) +
      kpi('Total Cx cost', money(plan.total), delta(plan.totalDelta, money) + ' vs baseline ' + money(plan.baselineTotal)) +
      kpi('Man-hours', P.fmtInt(plan.manHours), delta(plan.manHours - plan.baselineManHours, P.fmtInt) + ' · 8 h per crew-day') +
      kpi('Peak month', P.fmtMo(plan.peak.month), money(plan.peak.cost) + ' in that month') +
      kpi('Peak crew on site', P.fmtInt(maxCrew), over ? over + ' month' + (over > 1 ? 's' : '') + ' above the cap of ' + cap : 'within the cap of ' + cap) +
      kpi('Region factor', '× ' + plan.region.mult.toFixed(2), esc(plan.region.name));
  }

  function renderPlanTable(plan) {
    var tb = $('cxAnPlanTable').getElementsByTagName('tbody')[0]; tb.innerHTML = '';
    if (!plan) return;
    for (var i = 0; i < plan.levels.length; i++) {
      var L = plan.levels[i], meta = lvById(L.id), o = S.overrides[L.id] || {};
      var tr = el('tr', (meta.primary ? '' : 'is-muted') + (S.sel === 'level:' + L.id ? ' is-selected' : '') + (L.edited ? ' is-edited' : ''));
      tr.setAttribute('data-cx-level', L.id); tr.tabIndex = 0;
      tr.innerHTML =
        '<th scope="row"><button type="button" class="cx-an-link" data-sel="level:' + L.id + '"><span class="cx-an-lv">' + L.id + '</span> ' + esc(meta.label) + '</button>' + (meta.primary ? '' : '<span class="cx-an-ws">workstream</span>') + '</th>' +
        '<td><input type="number" class="input-field cx-an-in" data-level="' + L.id + '" data-field="start" step="0.1" min="0" max="120" value="' + one(L.start) + '" aria-label="' + L.id + ' start month"></td>' +
        '<td><input type="number" class="input-field cx-an-in" data-level="' + L.id + '" data-field="months" step="0.1" min="0.1" max="60" value="' + one(L.months) + '" aria-label="' + L.id + ' months"></td>' +
        '<td><input type="number" class="input-field cx-an-in" data-level="' + L.id + '" data-field="crew" step="0.5" min="0.5" max="200" value="' + L.crew + '" aria-label="' + L.id + ' crew"></td>' +
        '<td><select class="input-field cx-an-in" data-level="' + L.id + '" data-field="shift" aria-label="' + L.id + ' shift"><option value="1x8"' + (L.shift === '1x8' ? ' selected' : '') + '>1×8 h</option><option value="2x12"' + (L.shift === '2x12' ? ' selected' : '') + '>2×12 h</option></select></td>' +
        '<td class="num">' + one(L.crewNeeded) + '</td><td class="num">' + P.fmtInt(L.manHours) + '</td><td class="num">' + money(L.cost) + '</td><td class="num">' + delta(L.costDelta, money) + '</td>';
      tb.appendChild(tr);
    }
    var cap = $('cxAnCap'); if (doc.activeElement !== cap) cap.value = plan.siteCrewCap || plan.siteCrewCapDefault;
  }

  function renderTimeline(plan) {
    var h = $('cxAnTimeline');
    if (!plan) { h.innerHTML = ''; return; }
    var W = 820, rowH = 22, pad = 196, n = plan.levels.length, maxM = Math.max(plan.finishMonth, plan.baselineFinish, 1), H = n * rowH + 30;
    var sx = function (m) { return pad + (m / maxM) * (W - pad - 10); };
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="Level windows, baseline and scenario" data-rz-series-meaning="baseline grey, scenario amber">';
    for (var m = 0; m <= Math.ceil(maxM); m += (maxM > 30 ? 6 : 3)) s += '<line x1="' + sx(m) + '" y1="6" x2="' + sx(m) + '" y2="' + (H - 18) + '" stroke="' + GRID + '" stroke-width="1"/><text x="' + sx(m) + '" y="' + (H - 4) + '" font-size="10" text-anchor="middle" fill="currentColor" opacity=".7">M' + m + '</text>';
    for (var i = 0; i < n; i++) {
      var L = plan.levels[i], y = 8 + i * rowH, b = L.baseline;
      s += '<text x="0" y="' + (y + 14) + '" font-size="11" fill="currentColor">' + L.id + ' ' + esc(lvById(L.id).label.length > 24 ? lvById(L.id).label.slice(0, 23) + '…' : lvById(L.id).label) + '</text>';
      s += '<rect x="' + sx(b.start) + '" y="' + (y + 3) + '" width="' + Math.max(1, sx(b.end) - sx(b.start)) + '" height="6" fill="' + GREY + '" opacity=".6"/>';
      s += '<rect x="' + sx(L.start) + '" y="' + (y + 10) + '" width="' + Math.max(1, sx(L.end) - sx(L.start)) + '" height="8" fill="' + (L.edited ? AMBER : GREY2) + '"' + (L.edited ? '' : ' opacity=".9"') + '/>';
    }
    s += '<line x1="' + sx(S.month) + '" y1="4" x2="' + sx(S.month) + '" y2="' + (H - 16) + '" stroke="' + AMBER + '" stroke-width="1.5"/>';
    s += '</svg>';
    h.innerHTML = s;
    var r = $('cxAnMonth'); r.max = Math.ceil(maxM); if (+r.value !== S.month) r.value = S.month; $('cxAnMonthOut').textContent = 'M' + S.month;
  }

  function renderSchematic(plan) {
    var host = $('cxAnSheets'); if (!host) return;
    if (!plan || !root.RZCxSchematic) { host.innerHTML = '<p class="cx-an-sub">' + (plan ? 'Diagram engine not loaded.' : '—') + '</p>'; return; }
    var st = P.statusAt(plan, S.month), sheets = root.RZCxSchematic.sheets(st), h = '';
    for (var i = 0; i < sheets.length; i++) h += '<figure class="cx-an-sheet" data-block="' + sheets[i].block + '"' + (sheets[i].block === S.sheet ? '' : ' hidden') + '>' + sheets[i].svg + '</figure>';
    host.innerHTML = h;
    for (var j = 0; j < st.systems.length; j++) {
      var x = st.systems[j], rect = host.querySelector('[data-rzd-node="' + x.id + '"]');
      if (!rect) continue;
      if (x.changed) rect.setAttribute('data-cx-changed', '1');
      if (x.inTest) rect.setAttribute('data-cx-intest', '1');
      if (S.sel === 'sys:' + x.id) rect.setAttribute('data-cx-selected', '1');
    }
    var sub = $('cxAnSchematicSub'); if (sub) { var c = st.systems.filter(function (q) { return q.changed; }).length; sub.setAttribute('data-month', 'M' + S.month); }
  }
  function setSheet(block) {
    S.sheet = block;
    var tabs = doc.querySelectorAll('.cx-an-sheet-tabs [data-sheet]');
    for (var i = 0; i < tabs.length; i++) tabs[i].setAttribute('aria-pressed', String(tabs[i].getAttribute('data-sheet') === block));
    var figs = doc.querySelectorAll('#cxAnSheets .cx-an-sheet');
    for (var j = 0; j < figs.length; j++) figs[j].hidden = figs[j].getAttribute('data-block') !== block;
  }
  function renderStatus(plan) {
    var tb = $('cxAnStatusTable').getElementsByTagName('tbody')[0], counts = $('cxAnCounts'); tb.innerHTML = '';
    if (!plan) { counts.innerHTML = ''; return; }
    var st = P.statusAt(plan, S.month);
    var c = st.counts, order = ['none', 'L1', 'L2', 'L3', 'L4', 'L5'], tagOf = { L1: 'red', L2: 'yellow', L3: 'green', L4: 'blue', L5: 'white' }, ch = '';
    for (var k = 0; k < order.length; k++) { var key = order[k]; ch += '<span class="cx-an-count"><i class="cx-tag cx-tag-' + (tagOf[key] || 'none') + '"></i>' + (key === 'none' ? 'no tag' : key) + ' <b>' + (c[key] || 0) + '</b></span>'; }
    counts.innerHTML = ch + '<span class="cx-an-count">changed this month <b>' + st.systems.filter(function (x) { return x.changed; }).length + '</b></span>';
    for (var i = 0; i < st.systems.length; i++) {
      var x = st.systems[i], tr = el('tr', (x.changed ? 'is-changed' : '') + (S.sel === 'sys:' + x.id ? ' is-selected' : ''));
      tr.setAttribute('data-cx-asset', x.id);
      var state = x.inTest ? 'in test for ' + x.next : (x.level === 'L5' ? 'IST passed' : (x.level ? 'awaiting ' + x.next : 'planned'));
      tr.innerHTML = '<th scope="row"><button type="button" class="cx-an-link" data-sel="sys:' + x.id + '">' + esc(x.label) + '</button></th><td>' + x.block + '</td><td>' + (x.level || '—') + '</td><td><i class="cx-tag cx-tag-' + (x.tag || 'none') + '" title="' + (x.tag || 'no tag') + '"></i> ' + (x.tag || '—') + '</td><td>' + (x.next ? x.next + ' at ' + P.fmtMo(x.gates[x.next]) : '—') + '</td><td>' + state + (x.changed ? ' · <b>changed</b>' : '') + '</td>';
      tb.appendChild(tr);
    }
  }

  function chart(id, cfg) {
    if (!root.Chart) return;
    if (S.charts[id]) { S.charts[id].destroy(); S.charts[id] = null; }
    var c = $(id); if (!c) return;
    S.charts[id] = new root.Chart(c.getContext('2d'), cfg);
  }
  function renderCharts(plan) {
    if (!plan) return;
    var labels = [], i; for (i = 0; i < plan.monthly.cost.length; i++) labels.push('M' + i);
    var tip = { callbacks: { label: function (c) { return c.dataset.label + ': ' + money(c.raw); } } };
    chart('cxAnChartMonthly', { type: 'bar', data: { labels: labels, datasets: [
      { label: 'Baseline', data: plan.monthly.baselineCost, backgroundColor: GREY, borderRadius: 0 },
      { label: 'Scenario', data: plan.monthly.cost, backgroundColor: AMBER, borderRadius: 0 }] },
      options: { responsive: true, interaction: { mode: 'index', intersect: false }, plugins: { legend: { display: true }, tooltip: tip }, scales: { y: { ticks: { callback: function (v) { return money(v); } }, grid: { color: GRID } }, x: { grid: { display: false } } } } });
    var cumB = [], acc = 0; for (i = 0; i < plan.monthly.baselineCost.length; i++) { acc += plan.monthly.baselineCost[i]; cumB.push(acc); }
    chart('cxAnChartCum', { type: 'line', data: { labels: labels, datasets: [
      { label: 'Baseline', data: cumB, borderColor: GREY, backgroundColor: GREY, pointRadius: 0, borderWidth: 1.5, borderDash: [4, 3] },
      { label: 'Scenario', data: plan.cumulative, borderColor: AMBER, backgroundColor: AMBER, pointRadius: 0, borderWidth: 2 }] },
      options: { responsive: true, interaction: { mode: 'index', intersect: false }, plugins: { legend: { display: true }, tooltip: tip }, scales: { y: { ticks: { callback: function (v) { return money(v); } }, grid: { color: GRID } }, x: { grid: { display: false } } } } });
    var cap = plan.siteCrewCap || plan.siteCrewCapDefault, capLine = []; for (i = 0; i < labels.length; i++) capLine.push(cap);
    chart('cxAnChartCrew', { type: 'bar', data: { labels: labels, datasets: [
      { type: 'line', label: 'Site crew cap', data: capLine, borderColor: GREY2, pointRadius: 0, borderWidth: 1.5, borderDash: [4, 3] },
      { label: 'Crew on site', data: plan.monthly.crew, backgroundColor: AMBER, borderRadius: 0 }] },
      options: { responsive: true, interaction: { mode: 'index', intersect: false }, plugins: { legend: { display: true }, tooltip: { callbacks: { label: function (c) { return c.dataset.label + ': ' + one(c.raw); } } } }, scales: { y: { grid: { color: GRID } }, x: { grid: { display: false } } } } });
  }

  function renderInspector(plan) {
    var t = $('cxAnInsTitle'), b = $('cxAnInsBody');
    if (!plan || !S.sel) { t.textContent = 'Inspector'; b.innerHTML = '<p class="cx-an-sub">Select a level row or a system row.</p>'; return; }
    var kind = S.sel.split(':')[0], id = S.sel.split(':')[1], h = '';
    if (kind === 'level') {
      var L = planLevel(id), meta = lvById(id); if (!L) return;
      t.textContent = id + ' · ' + meta.label;
      h += '<dl class="cx-an-dl"><dt>Window</dt><dd>' + P.fmtMo(L.start) + ' → ' + P.fmtMo(L.end) + ' (' + one(L.months) + ' mo)</dd>' +
        '<dt>Baseline</dt><dd>' + P.fmtMo(L.baseline.start) + ' → ' + P.fmtMo(L.baseline.end) + '</dd>' +
        '<dt>Labour</dt><dd>' + P.fmtInt(L.laborDays) + ' crew-days · crew ' + L.crew + ' · ' + L.shift + ' · needed on site ' + one(L.crewNeeded) + '</dd>' +
        '<dt>Man-hours</dt><dd>' + P.fmtInt(L.manHours) + '</dd><dt>Cost</dt><dd>' + money(L.cost) + ' (' + delta(L.costDelta, money) + ')</dd>' +
        '<dt>Tag</dt><dd>' + (meta.tag ? '<i class="cx-tag cx-tag-' + meta.tag + '"></i> ' + meta.tag + ' (handbook 02.6)' : 'no tag — workstream') + '</dd></dl>';
      h += '<p class="cx-an-sub">Handbook: <a href="' + meta.cite + '">' + id + ' definition</a> · <a href="' + P.CITES.gates + '">gate records</a> · <a href="' + P.CITES.durations + '">planning durations</a>' + (id === 'L5' ? ' · <a href="' + P.CITES.ist + '">IST (ch 28)</a>' : '') + '</p>';
      if (id !== 'L0' && id !== 'L6') {
        var g = P.gateMonths(plan), rows = P.SYSTEMS.slice().sort(function (a, c) { return g[a.id][id] - g[c.id][id]; });
        h += '<table class="cx-an-table cx-an-mini"><thead><tr><th>System</th><th>Gate ' + id + '</th></tr></thead><tbody>';
        for (var i = 0; i < rows.length; i++) h += '<tr><td><button type="button" class="cx-an-link" data-sel="sys:' + rows[i].id + '">' + esc(rows[i].label) + '</button></td><td class="num">' + P.fmtMo(g[rows[i].id][id]) + '</td></tr>';
        h += '</tbody></table>';
      }
    } else {
      var sys = sysById(id); if (!sys) return;
      var st = P.statusAt(plan, S.month), row = null; for (var j = 0; j < st.systems.length; j++) if (st.systems[j].id === id) row = st.systems[j];
      t.textContent = sys.label;
      h += '<dl class="cx-an-dl"><dt>Block</dt><dd>' + sys.block + '</dd><dt>Operating state</dt><dd>not connected</dd>' +
        '<dt>At M' + S.month + '</dt><dd>' + (row.level ? row.level + ' accepted · <i class="cx-tag cx-tag-' + row.tag + '"></i> ' + row.tag : 'no gate accepted yet') + (row.inTest ? ' · in test for ' + row.next : '') + '</dd></dl>';
      h += '<table class="cx-an-table cx-an-mini"><thead><tr><th>Gate</th><th>Month</th><th>State at M' + S.month + '</th></tr></thead><tbody>';
      var ids = ['L1', 'L2', 'L3', 'L4', 'L5'];
      for (var k = 0; k < ids.length; k++) { var gm = row.gates[ids[k]], stt = gm <= S.month ? 'accepted (planned)' : (row.next === ids[k] && row.inTest ? 'in test' : 'planned'); h += '<tr><td>' + ids[k] + ' <i class="cx-tag cx-tag-' + lvById(ids[k]).tag + '"></i></td><td class="num">' + P.fmtMo(gm) + '</td><td>' + stt + '</td></tr>'; }
      h += '</tbody></table>';
      h += '<p class="cx-an-sub">Handbook: ' + (sys.ladder ? '<a href="' + P.CITES.ladders[sys.ladder] + '">' + sys.ladder.toUpperCase() + ' ladder (02.7)</a> · ' : '') + '<a href="' + P.CITES.holdWitness + '">hold and witness points (ch 07)</a> · <a href="' + P.CITES.tags + '">tag scheme (02.6)</a></p>';
      h += '<p class="cx-an-sub"><button type="button" class="tool-btn" data-sel="sys:' + id + '" data-show="1">Show in schematic</button> <button type="button" class="tool-btn" data-campus="' + id + '">Show in campus</button></p>';
      h += '<p class="cx-an-sub">Gate months are planned dates derived from the level windows; no acceptance record is held here (Tier 1).</p>';
    }
    b.innerHTML = h;
  }

  /* ── events ── */
  function onEdit(e) {
    var t = e.target; if (!t || !t.getAttribute || !t.getAttribute('data-level')) return;
    var lv = t.getAttribute('data-level'), f = t.getAttribute('data-field'), v = f === 'shift' ? t.value : parseFloat(t.value);
    var o = S.overrides[lv] ? JSON.parse(JSON.stringify(S.overrides[lv])) : {};
    if (f !== 'shift' && isNaN(v)) return;
    o[f] = v; var next = {}; for (var k in S.overrides) if (S.overrides.hasOwnProperty(k)) next[k] = S.overrides[k]; next[lv] = o;
    S.overrides = P.sanitize(next); S.dirty = true;
    var focus = doc.activeElement && doc.activeElement.getAttribute ? [doc.activeElement.getAttribute('data-level'), doc.activeElement.getAttribute('data-field')] : null;
    render();
    if (focus && focus[0]) { var q = doc.querySelector('.cx-an-in[data-level="' + focus[0] + '"][data-field="' + focus[1] + '"]'); if (q) q.focus(); }
  }
  function bind() {
    $('cxTabBtnCalc').addEventListener('click', function () { setTab('calc'); });
    $('cxTabBtnAnalysis').addEventListener('click', function () { setTab('analysis'); });
    $('cxAnPlanTable').addEventListener('change', onEdit);
    $('cxAnCap').addEventListener('change', function () { var v = parseFloat(this.value); S.cap = isNaN(v) ? null : v; S.dirty = true; render(); });
    $('cxAnSave').addEventListener('click', function () { store.save(S.overrides, S.cap, S.extra); S.dirty = false; render(); });
    $('cxAnRevert').addEventListener('click', function () { var p = store.load(); S.overrides = p.overrides; S.cap = p.siteCrewCap; S.extra = { calendar: p.calendar, lines: p.lines }; S.dirty = false; render(); });
    $('cxAnReset').addEventListener('click', function () { S.overrides = {}; S.cap = null; S.extra = { calendar: { anchor: null, slot: false }, lines: [] }; store.clear(); S.dirty = false; render(); });
    $('cxAnRetry').addEventListener('click', render);
    $('cxAnMonth').addEventListener('input', function () { S.month = +this.value; renderTimeline(S.plan); renderSchematic(S.plan); renderStatus(S.plan); renderInspector(S.plan); syncCampus(); });
    $('cxAnPrev').addEventListener('click', function () { step(-1); }); $('cxAnNext').addEventListener('click', function () { step(1); });
    $('cxAnPlay').addEventListener('click', function () { if (S.timer) stopPlay(); else { if (S.plan && S.month >= Math.ceil(S.plan.finishMonth)) S.month = 0; this.setAttribute('aria-pressed', 'true'); this.textContent = 'Pause'; S.timer = root.setInterval(function () { if (!S.plan || S.month >= Math.ceil(S.plan.finishMonth)) { stopPlay(); return; } step(1); }, 1200); } });
    $('cxTabAnalysis').addEventListener('click', function (e) {
      var tab = e.target.closest ? e.target.closest('[data-sheet]') : null; if (tab) { setSheet(tab.getAttribute('data-sheet')); return; }
      var z = e.target.closest ? e.target.closest('[data-zoom]') : null; if (z && z.tagName === 'BUTTON') { var zs = doc.querySelectorAll('.cx-an-sheet-zoom [data-zoom]'); for (var zi = 0; zi < zs.length; zi++) zs[zi].setAttribute('aria-pressed', String(zs[zi] === z)); $('cxAnSheets').setAttribute('data-zoom', z.getAttribute('data-zoom')); return; }
      var cb = e.target.closest ? e.target.closest('[data-campus]') : null; if (cb) { var ch = $('cxAnCampus'); if (ch && ch.__rzCampus) { ch.__rzCampus.select(cb.getAttribute('data-campus')); ch.scrollIntoView({ block: 'center', behavior: 'smooth' }); } return; }
      var hit = e.target.closest ? e.target.closest('[data-rzd-hit]') : null;
      if (hit) { var id = hit.getAttribute('data-rzd-hit'); if (sysById(id)) { S.sel = 'sys:' + id; render(); } return; }
      var b = e.target.closest ? e.target.closest('[data-sel]') : null; if (!b) return;
      S.sel = b.getAttribute('data-sel'); var sys = S.sel.indexOf('sys:') === 0 ? sysById(S.sel.slice(4)) : null; if (sys && b.hasAttribute('data-show')) setSheet(sys.block);
      render();
    });
    $('cxTabAnalysis').addEventListener('keydown', function (e) { if (e.key !== 'Enter' && e.key !== ' ') return; var hit = e.target.closest ? e.target.closest('[data-rzd-hit]') : null; if (!hit) return; e.preventDefault(); var id = hit.getAttribute('data-rzd-hit'); if (sysById(id)) { S.sel = 'sys:' + id; render(); } });
    var grid = $('cxInputsGrid'); if (grid) grid.addEventListener('change', function () { if (S.tab === 'analysis') render(); });
    if (typeof root.cxCalculate === 'function') { var orig = root.cxCalculate; root.cxCalculate = function () { var r = orig.apply(this, arguments); if (S.tab === 'analysis') render(); return r; }; }
    if (typeof root.cxSetCurrency === 'function') { var oc = root.cxSetCurrency; root.cxSetCurrency = function (c) { var r = oc.apply(this, arguments); if (S.tab === 'analysis') render(); return r; }; }
  }
  function step(d) { if (!S.plan) return; var max = Math.ceil(S.plan.finishMonth); S.month = Math.min(max, Math.max(0, S.month + d)); $('cxAnMonth').value = S.month; renderTimeline(S.plan); renderSchematic(S.plan); renderStatus(S.plan); renderInspector(S.plan); syncCampus(); }
  function stopPlay() { if (S.timer) root.clearInterval(S.timer); S.timer = null; var b = $('cxAnPlay'); if (b) { b.setAttribute('aria-pressed', 'false'); b.textContent = 'Play'; } }

  /* The 3D plant's site basis (K18): the engine's own mapped input (kW, cooling type, rack density → kW per rack) and its
   * equipScale counts. RZCxCampus.layout() turns this into what is drawn and what each callout says; nothing is typed. */
  function campusBasis(plan) {
    var src = plan ? plan.input : inputs(), out = { itKw: src && src.itLoad, rackKw: null, coolingType: src && (src.coolingType || src.cooling), es: null };
    try {
      var E = root.RZEngine, C = E && E.models.commissioning, inp = C && C.mapInput && C.mapInput(src);
      if (inp) {
        out.itKw = inp.itLoad; out.coolingType = inp.coolingType;
        var R = E.data && E.data.commissioning && E.data.commissioning.cx && E.data.commissioning.cx.rich, den = R && R.density && (R.density[inp.rackDensity] || R.density.standard);
        out.rackKw = den ? den.kw : null; out.es = C.equipScale ? C.equipScale(inp) : null;
      }
    } catch (e) { /* layout() falls back to the engine's published rules */ }
    return out;
  }
  function campusKey(b) { return [b.itKw, b.rackKw, b.coolingType, b.es && b.es.racks, b.es && b.es.cooling_units, b.es && b.es.chillers].join('|'); }
  function bootCampus() {
    var host = $('cxAnCampus'); if (!host || !root.RZCxCampus) return;
    var plan = S.plan || recompute(), b = campusBasis(plan); S.campusKey = campusKey(b);
    root.RZCxCampus.boot(host, {
      basis: b,
      status: function () { return S.plan ? P.statusAt(S.plan, S.month) : null; },
      onSelect: function (id) { if (sysById(id)) { S.sel = 'sys:' + id; render(); } }
    });
  }
  function syncCampus() {
    var host = $('cxAnCampus'); if (!(host && host.__rzCampus && S.plan)) return;
    var b = campusBasis(S.plan), key = campusKey(b);
    if (key !== S.campusKey) { S.campusKey = key; host.__rzCampus.setBasis(b); }
    host.__rzCampus.setStatus(P.statusAt(S.plan, S.month));
  }
  function init() {
    if (S.ready || !build()) return; S.ready = true;
    var p = store.load(); S.overrides = p.overrides; S.cap = p.siteCrewCap; S.extra = { calendar: p.calendar, lines: p.lines };
    bind();
    bootCampus();
    var want = 'calc'; try { if (new URL(root.location.href).searchParams.get('tab') === 'analysis') want = 'analysis'; } catch (e) { /* keep calc */ }
    setTab(want, false);
  }
  root.RZCxAnalysis = { init: init, render: render, setTab: setTab, state: S, store: store, fmt: { money: money, one: one, delta: delta, esc: esc }, version: '3.26.1' };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})(typeof window !== 'undefined' ? window : this, typeof document !== 'undefined' ? document : null);
