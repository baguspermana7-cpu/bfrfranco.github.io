/* rz-cx-tables.js — Cx Analysis §23 (K22): the gate heatmap (system × L1–L5 at the viewed month) and the table
 * equivalent of the three charts (monthly cost, cumulative cost, crew on site) with a CSV. Every number is read from
 * the engine plan (programPlan monthly / cumulative / crew) and RZCxPlan.statusAt; nothing is computed here except
 * the per-month difference shown beside the two engine series. Tag colours are handbook 02.6 (semantic, instrument
 * only, data-rz-series-meaning). Hooks into RZCxAnalysis. ES5. */
(function (root, doc) {
  'use strict';
  if (!doc) return;
  var A, S, P, OPEN = false;
  var TAGC = { L1: '#ef4444', L2: '#d49a2a', L3: '#22c55e', L4: '#3b82f6', L5: '#f4f4f5' }, SEQ = ['L1', 'L2', 'L3', 'L4', 'L5'];
  function $(id) { return doc.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function money(v) { return A.fmt.money(v); }

  function build() {
    var crew = $('cxAnChartCrew'); if (!crew || $('cxTbHeat')) return false;
    var two = crew.closest ? crew.closest('.cx-an-two') : null; if (!two) return false;
    var heat = doc.createElement('div'); heat.className = 'cx-an-panel'; heat.id = 'cxTbHeat';
    heat.innerHTML = '<div class="cx-an-panel-head"><h3>Gate heatmap</h3><span class="cx-an-sub" id="cxTbHeatSub">system × level at the viewed month · filled = gate passed (planned), outline = gate still ahead, number = gate month · colours are the handbook tags (02.6)</span></div><div id="cxTbHeatBody" class="cx-an-tablewrap"></div>';
    var tb = doc.createElement('div'); tb.className = 'cx-an-panel'; tb.id = 'cxTbData';
    tb.innerHTML = '<div class="cx-an-panel-head"><h3>Chart data</h3><span class="cx-an-sub">the numbers behind the three charts above, per month · engine programPlan</span></div>' +
      '<div class="cx-an-actions"><button type="button" class="tool-btn" id="cxTbToggle" aria-expanded="false" aria-controls="cxTbBody">Show table</button><button type="button" class="tool-btn" id="cxTbCsv">CSV</button></div><div id="cxTbBody" class="cx-an-tablewrap" hidden></div>';
    two.parentNode.insertBefore(tb, two.nextSibling);
    two.parentNode.insertBefore(heat, tb);
    return true;
  }

  function heatmap(plan) {
    var h = $('cxTbHeatBody'); if (!h) return;
    if (!plan) { h.innerHTML = '<p class="cx-an-sub">—</p>'; return; }
    var st = P.statusAt(plan, S.month), rows = st.systems, cw = 64, rh = 20, lw = 230, W = lw + cw * 5 + 8, H = 26 + rows.length * rh + 8, blocks = '', s;
    s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="max-width:' + W + 'px" role="img" aria-label="Gate heatmap at M' + S.month + '" data-rz-series-meaning="handbook tags: L1 red, L2 yellow, L3 green, L4 blue, L5 white">';
    for (var k = 0; k < SEQ.length; k++) s += '<text x="' + (lw + k * cw + cw / 2) + '" y="16" font-size="11" text-anchor="middle" fill="currentColor" font-family="var(--rzt-mono, monospace)">' + SEQ[k] + '</text>';
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i], y = 26 + i * rh;
      if (r.block !== blocks) { blocks = r.block; if (i) s += '<line x1="0" x2="' + W + '" y1="' + (y - 1) + '" y2="' + (y - 1) + '" stroke="currentColor" stroke-opacity=".25"/>'; }
      s += '<text x="0" y="' + (y + 14) + '" font-size="11" fill="currentColor"><tspan opacity=".6" font-family="var(--rzt-mono, monospace)">' + r.block.charAt(0).toUpperCase() + ' </tspan>' + esc(r.label.length > 32 ? r.label.slice(0, 31) + '…' : r.label) + '</text>';
      for (var j = 0; j < SEQ.length; j++) {
        var L = SEQ[j], gm = r.gates[L], done = gm != null && gm <= S.month, x = lw + j * cw + 4, now = done && gm > S.month - 1;
        s += '<g data-cx-heat="' + r.id + ':' + L + '" data-state="' + (done ? 'passed' : 'ahead') + '"><title>' + esc(r.label) + ' ' + L + ': ' + (gm == null ? 'no gate' : 'M' + gm.toFixed(1) + (done ? ' · passed (planned)' : ' · ahead')) + '</title>' +
          '<rect x="' + x + '" y="' + (y + 2) + '" width="' + (cw - 8) + '" height="' + (rh - 4) + '" rx="2" fill="' + (done ? TAGC[L] : 'none') + '" fill-opacity="' + (done ? (L === 'L5' ? 1 : 0.85) : 0) + '" stroke="' + (done ? (L === 'L5' ? '#a1a1aa' : TAGC[L]) : 'currentColor') + '" stroke-opacity="' + (done ? 1 : 0.35) + '" stroke-width="' + (now ? 2 : 1) + '"' + (done ? '' : ' stroke-dasharray="3 2"') + '/>' +
          '<text x="' + (x + (cw - 8) / 2) + '" y="' + (y + 14) + '" font-size="10" text-anchor="middle" font-family="var(--rzt-mono, monospace)" fill="' + (done ? '#111' : 'currentColor') + '"' + (done ? '' : ' opacity=".7"') + '>' + (gm == null ? '—' : 'M' + gm.toFixed(1)) + '</text></g>';
      }
    }
    h.innerHTML = s + '</svg>';
    var sub = $('cxTbHeatSub'); if (sub) sub.setAttribute('data-month', 'M' + S.month);
  }

  function rows(plan) {
    var m = plan.monthly, out = [], n = m.cost.length;
    for (var i = 0; i < n; i++) out.push({ m: i, base: m.baselineCost[i], scen: m.cost[i], d: m.cost[i] - m.baselineCost[i], cum: plan.cumulative[i], crew: m.crew[i], mh: m.manHours[i] });
    return out;
  }
  function table(plan) {
    var h = $('cxTbBody'); if (!h || !OPEN) return;
    if (!plan) { h.innerHTML = '<p class="cx-an-sub">—</p>'; return; }
    var cap = S.cap != null ? S.cap : plan.siteCrewCapDefault, t = '<table class="cx-an-table cx-tb-table"><thead><tr><th>Month</th><th class="num">Baseline cost</th><th class="num">Scenario cost</th><th class="num">Δ</th><th class="num">Cumulative</th><th class="num">Crew on site</th><th class="num">Man-hours</th></tr></thead><tbody>';
    var rs = rows(plan);
    for (var i = 0; i < rs.length; i++) {
      var r = rs[i];
      t += '<tr' + (r.m === S.month ? ' class="is-selected"' : '') + '><th scope="row">M' + r.m + '</th><td class="num">' + money(r.base) + '</td><td class="num">' + money(r.scen) + '</td><td class="num">' + (Math.abs(r.d) < 1 ? '±0' : (r.d > 0 ? '+' : '−') + money(Math.abs(r.d))) + '</td><td class="num">' + money(r.cum) + '</td><td class="num' + (r.crew > cap ? ' is-over' : '') + '">' + r.crew.toFixed(1) + (r.crew > cap ? ' <span class="cx-an-sub">over cap ' + cap + '</span>' : '') + '</td><td class="num">' + P.fmtInt(r.mh) + '</td></tr>';
    }
    h.innerHTML = t + '</tbody><tfoot><tr><th scope="row">Total</th><td class="num">' + money(plan.baselineTotal) + '</td><td class="num">' + money(plan.total) + '</td><td class="num">' + (plan.totalDelta ? (plan.totalDelta > 0 ? '+' : '−') + money(Math.abs(plan.totalDelta)) : '±0') + '</td><td></td><td></td><td class="num">' + P.fmtInt(plan.manHours) + '</td></tr></tfoot></table>';
  }
  function csv() {
    var plan = S.plan; if (!plan) return;
    var out = 'month,baseline_cost_usd,scenario_cost_usd,delta_usd,cumulative_usd,crew_on_site,man_hours\n' + rows(plan).map(function (r) { return 'M' + r.m + ',' + r.base + ',' + r.scen + ',' + r.d + ',' + r.cum + ',' + r.crew + ',' + r.mh; }).join('\n') + '\n';
    try {
      var url = root.URL.createObjectURL(new root.Blob([out], { type: 'text/csv' })), a = doc.createElement('a');
      a.href = url; a.download = 'cx-chart-data.csv'; doc.body.appendChild(a); a.click(); a.remove();
      root.setTimeout(function () { root.URL.revokeObjectURL(url); }, 2000);
    } catch (e) { /* no Blob: the table above is the fallback */ }
  }
  function hook(plan) { heatmap(plan); table(plan); }
  function init() {
    A = root.RZCxAnalysis; P = root.RZCxPlan; if (!A || !P || !A.state || !A.state.hooks) return;
    S = A.state; if (!build()) return;
    $('cxTbToggle').addEventListener('click', function () { OPEN = !OPEN; this.setAttribute('aria-expanded', String(OPEN)); this.textContent = OPEN ? 'Hide table' : 'Show table'; $('cxTbBody').hidden = !OPEN; table(S.plan); });
    $('cxTbCsv').addEventListener('click', csv);
    S.hooks.push(hook); A.render();
  }
  root.RZCxTables = { version: '3.33.0', rows: function () { return S && S.plan ? rows(S.plan) : []; } };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})(typeof window !== 'undefined' ? window : this, typeof document !== 'undefined' ? document : null);
