/* rz-cx-tree-ui.js — Cx Analysis K28: the plan editor opens into the commissioning program five deep
 * (level → system → subsystem → equipment → activity) as a keyboard treegrid under the L0–L6 editor.
 * Every number on a row is RZCxTree.programTree(cxReadInputs(), { plan: the editor's overrides, nodes }) — nothing is
 * computed here. Setting only a level (the editor above) moves every row under it; a weight (0–100, default 1) or an
 * exclusion on a node re-shares its siblings and the parent total holds (the engine's contract). Node overrides are
 * kept in localStorage 'rz-cx-tree' { version: 1, nodes: { path: { weight?, exclude? } } }; "Reset breakdown" and the
 * editor's "Reset to baseline" clear them. Keys: ↑/↓ rows, → open / first child, ← close / parent, Home/End.
 * Hooks into RZCxAnalysis. ES5. */
(function (root, doc) {
  'use strict';
  if (!doc) return;
  var A, S, P, T, NODES = {}, EXP = {}, DEPTH = 1, FIND = '', FOCUS = null, KEY = 'rz-cx-tree', TREE = null, BASE = null, ROWS = [];
  var KIND_N = { level: 1, system: 2, subsystem: 3, equipment: 4, activity: 5 };
  var DEPTHS = [['1', 'Level'], ['2', 'System'], ['3', 'Subsystem'], ['4', 'Equipment'], ['5', 'Activity']];
  function $(id) { return doc.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ── store ── */
  function clean(o) {
    var out = {}, k, c;
    for (k in o) if (Object.prototype.hasOwnProperty.call(o, k) && /^L[0-6](\/[a-z0-9_]+){1,4}$/.test(k) && o[k] && typeof o[k] === 'object') {
      c = {};
      if (typeof o[k].weight === 'number' && isFinite(o[k].weight) && o[k].weight >= 0 && o[k].weight <= 100 && o[k].weight !== 1) c.weight = o[k].weight;
      if (o[k].exclude === true) c.exclude = true;
      if (c.weight != null || c.exclude) out[k] = c;
    }
    return out;
  }
  function load() { try { var p = JSON.parse(root.localStorage.getItem(KEY) || 'null'); return p && p.version === 1 ? clean(p.nodes || {}) : {}; } catch (e) { return {}; } }
  function save() { try { if (Object.keys(NODES).length) root.localStorage.setItem(KEY, JSON.stringify({ version: 1, nodes: NODES })); else root.localStorage.removeItem(KEY); } catch (e) { /* private mode: the session still works */ } }

  /* ── markup ── */
  function build() {
    var ed = $('cxAnPlanPanel'); if (!ed || $('cxTrPanel')) return false;
    var p = doc.createElement('div'); p.className = 'cx-an-panel'; p.id = 'cxTrPanel';
    var seg = ''; for (var i = 0; i < DEPTHS.length; i++) seg += '<button type="button" data-depth="' + DEPTHS[i][0] + '" aria-pressed="' + (DEPTHS[i][0] === '1') + '">' + DEPTHS[i][1] + '</button>';
    p.innerHTML = '<div class="cx-an-panel-head"><h3>Program breakdown</h3><span class="cx-an-sub">Each level above, opened to system, subsystem, equipment and activity. Numbers are the engine\'s; set a level above and everything under it follows. A weight (×1 by default) or un-ticking "include" re-shares a node\'s siblings; the parent total holds.</span></div>' +
      '<div class="cx-an-actions cx-tr-bar"><div class="seg" role="group" aria-label="Open the breakdown to">' + seg + '</div>' +
      '<label class="cx-tr-find">Find <input type="search" id="cxTrFind" class="input-field" placeholder="e.g. chiller" aria-label="Find in the breakdown"></label>' +
      '<span class="spacer"></span><span class="cx-an-sub" id="cxTrCount" aria-live="polite"></span><button type="button" class="tool-btn" id="cxTrReset" title="Reset breakdown: drop every weight and include edit" disabled>Reset</button></div>' +
      '<div class="cx-an-tablewrap"><table class="cx-an-table cx-tr-grid" id="cxTrGrid" role="treegrid" aria-label="Commissioning program breakdown"><thead><tr>' +
      '<th data-col="name">Item</th><th class="num cx-tr-opt">Qty</th><th class="num cx-tr-opt">Share</th><th class="cx-tr-opt">Window</th><th class="num cx-tr-opt">Crew</th><th class="num cx-tr-mh">Man-hours</th><th class="num">Cost</th><th class="num">Weight</th><th title="Include">Incl.</th></tr></thead><tbody></tbody></table></div>';
    /* plan editor, then its calendar (rz-cx-ext, gate P5 wants it right under the editor), then this breakdown */
    var at = $('cxExPanel') || ed; at.parentNode.insertBefore(p, at.nextSibling);
    return true;
  }

  /* ── rows ── */
  function inputs() { return typeof root.cxReadInputs === 'function' ? root.cxReadInputs() : { itLoad: 2000 }; }
  function parentOf(path) { var i = path.lastIndexOf('/'); return i < 0 ? '' : path.slice(0, i); }
  function matches(n) { return !FIND || String(n.label || '').toLowerCase().indexOf(FIND) >= 0; }
  function visible(tree) {
    var out = [];
    function hit(n) { if (matches(n)) return true; for (var i = 0; n.children && i < n.children.length; i++) if (hit(n.children[i])) return true; return false; }
    /* the engine drops a node whose weight is 0 or that is excluded; keep it on screen as a ghost
       row (0, its inputs live) in its baseline place, so the edit can be undone where it was made */
    function withGhosts(ns, parent) {
      if (!BASE) return ns;
      var bp = parent ? T.find(BASE, parent) : null, bs = parent ? (bp && bp.children) || [] : BASE.levels, have = {}, list = [], i;
      for (i = 0; i < ns.length; i++) have[ns[i].path] = ns[i];
      for (i = 0; i < bs.length; i++) {
        var b = bs[i];
        if (have[b.path]) list.push(have[b.path]);
        else if (NODES[b.path]) list.push({ path: b.path, kind: b.kind, label: b.label, qty: b.qty, share: 0, cost: 0, manHours: 0, start: 0, finish: 0, crew: 0, ghost: true });
      }
      return list;
    }
    function go(ns, d, parent) {
      ns = withGhosts(ns, parent);
      for (var i = 0; i < ns.length; i++) {
        var n = ns[i], k = n.children && n.children.length;
        if (FIND && !hit(n)) continue;
        var open = !!k && (FIND ? true : !!EXP[n.path]);
        out.push({ n: n, d: d, k: !!k, open: open });
        if (open) go(n.children, d + 1, n.path);
      }
    }
    go(tree.levels, 1, '');
    return out;
  }
  function row(v, money) {
    var n = v.n, o = NODES[n.path] || {}, lvl = n.kind === 'level', off = o.exclude === true;
    var h = '<tr role="row" aria-level="' + v.d + '"' + (v.k ? ' aria-expanded="' + v.open + '"' : '') + ' tabindex="' + (n.path === FOCUS ? 0 : -1) + '" data-path="' + esc(n.path) + '" data-parent="' + esc(parentOf(n.path)) + '" data-kind="' + esc(n.kind) + '" data-cost="' + n.cost + '" data-mh="' + n.manHours + '" data-finish="' + n.finish + '"' + (n.ghost ? ' data-ghost="1"' : '') + (o.weight != null || off ? ' class="is-edited' + (n.ghost ? ' is-off' : '') + '"' : '') + '>';
    h += '<td role="gridcell" data-col="name" style="--d:' + (v.d - 1) + '"' + (lvl ? '' : ' title="' + esc(n.kind) + '"') + '>' + (v.k ? '<span class="cx-tr-caret" aria-hidden="true">' + (v.open ? '▾' : '▸') + '</span>' : '<span class="cx-tr-caret" aria-hidden="true"></span>') + '<span class="cx-tr-name">' + esc(n.label) + '</span>' + '' + '</td>';
    h += '<td role="gridcell" class="num cx-tr-opt">' + (n.qty != null ? P.fmtInt(n.qty) : '') + '</td>';
    h += '<td role="gridcell" class="num cx-tr-opt">' + (lvl ? '' : (Math.round(n.share * 1000) / 10).toFixed(1) + '%') + '</td>';
    h += '<td role="gridcell" class="cx-tr-opt">' + (n.ghost ? '—' : P.fmtMo(n.start) + '–' + P.fmtMo(n.finish)) + '</td>';
    h += '<td role="gridcell" class="num cx-tr-opt">' + (Math.round(n.crew * 10) / 10).toFixed(1) + '</td>';
    h += '<td role="gridcell" class="num cx-tr-mh" data-col="mh">' + P.fmtInt(n.manHours) + '</td>';
    h += '<td role="gridcell" class="num" data-col="cost">' + money(n.cost) + '</td>';
    h += '<td role="gridcell" class="num">' + (lvl ? '' : '<input type="number" class="input-field cx-an-in cx-tr-w" data-field="weight" min="0" max="100" step="0.1" tabindex="' + (n.path === FOCUS ? 0 : -1) + '" value="' + (o.weight != null ? o.weight : 1) + '" aria-label="Weight of ' + esc(n.label) + '"' + (off ? ' disabled' : '') + '>') + '</td>';
    h += '<td role="gridcell">' + (lvl ? '' : '<input type="checkbox" data-field="include" tabindex="' + (n.path === FOCUS ? 0 : -1) + '"' + (off ? '' : ' checked') + ' aria-label="Include ' + esc(n.label) + '">') + '</td>';
    return h + '</tr>';
  }
  function render() {
    var tb = $('cxTrGrid') && $('cxTrGrid').getElementsByTagName('tbody')[0]; if (!tb) return;
    TREE = T && T.programTree ? T.programTree(inputs(), { plan: S.overrides, nodes: NODES }) : null;
    BASE = TREE && Object.keys(NODES).length ? T.programTree(inputs(), { plan: S.overrides }) : null;
    if (!TREE) { tb.innerHTML = '<tr><td colspan="9" class="cx-an-sub">—</td></tr>'; ROWS = []; return; }
    ROWS = visible(TREE);
    if (!FOCUS || !ROWS.some(function (v) { return v.n.path === FOCUS; })) FOCUS = ROWS.length ? ROWS[0].n.path : null;
    /* a re-render from any source (a plan hook, an edit, a key) must not drop keyboard focus out of the grid */
    var ae = doc.activeElement, had = ae && tb.contains(ae), hadField = had && ae.getAttribute('data-field');
    var h = '', money = A.fmt.money; for (var i = 0; i < ROWS.length; i++) h += row(ROWS[i], money);
    tb.innerHTML = h || '<tr><td colspan="9" class="cx-an-sub">No row matches.</td></tr>';
    if (had) refocus(hadField);
    var c = $('cxTrCount'); if (c) c.textContent = ROWS.length + ' rows' + (Object.keys(NODES).length ? ' · ' + Object.keys(NODES).length + ' node edits' : '');
    var rb = $('cxTrReset'); if (rb) rb.disabled = !Object.keys(NODES).length;
  }
  /* look a row up by attribute value, never by building a selector from a path */
  function rowEl(path) { var g = $('cxTrGrid'), rs = g ? g.tBodies[0].rows : [], i; for (i = 0; i < rs.length; i++) if (rs[i].getAttribute('data-path') === path) return rs[i]; return null; }
  /* roving tab stop: the focused row and its two inputs take Tab, every other row and input is -1 */
  function rove(path) {
    var g = $('cxTrGrid'), els = g ? g.querySelectorAll('tbody tr[tabindex="0"], tbody input[tabindex="0"]') : [], i;
    for (i = 0; i < els.length; i++) els[i].setAttribute('tabindex', '-1');
    var r = rowEl(path); if (!r) return null;
    r.setAttribute('tabindex', '0'); var ins = r.getElementsByTagName('input'); for (i = 0; i < ins.length; i++) ins[i].setAttribute('tabindex', '0');
    FOCUS = path; return r;
  }
  function refocus(field) { var r = FOCUS && rowEl(FOCUS); if (!r) return; var f = field && r.querySelector('input[data-field="' + field + '"]'); (f || r).focus(); }

  /* ── events ── */
  function setDepth(d) {
    DEPTH = d; EXP = {};
    if (TREE) T.walk(TREE.levels, function (n) { if (KIND_N[n.kind] < d) EXP[n.path] = true; });
    var bs = doc.querySelectorAll('#cxTrPanel [data-depth]'); for (var i = 0; i < bs.length; i++) bs[i].setAttribute('aria-pressed', String(+bs[i].getAttribute('data-depth') === d));
    render();
  }
  function toggle(path, open) { if (open) EXP[path] = true; else delete EXP[path]; render(); }
  function edit(e) {
    var t = e.target, f = t && t.getAttribute && t.getAttribute('data-field'), tr = t && t.closest ? t.closest('tr[data-path]') : null; if (!f || !tr) return;
    var path = tr.getAttribute('data-path'), o = {}, k, cur = NODES[path] || {};
    for (k in cur) if (Object.prototype.hasOwnProperty.call(cur, k)) o[k] = cur[k];
    if (f === 'weight') { var v = parseFloat(t.value); if (isNaN(v)) { render(); return; } o.weight = Math.max(0, Math.min(100, v)); }
    else if (f === 'include') { if (t.checked) delete o.exclude; else o.exclude = true; }
    var next = {}; for (k in NODES) if (Object.prototype.hasOwnProperty.call(NODES, k)) next[k] = NODES[k]; next[path] = o;
    NODES = clean(next); FOCUS = path; save(); render(); refocus(f);
  }
  function key(e) {
    var tr = e.target && e.target.closest ? e.target.closest('tr[data-path]') : null; if (!tr || e.target !== tr) return;
    var path = tr.getAttribute('data-path'), i, idx = -1;
    for (i = 0; i < ROWS.length; i++) if (ROWS[i].n.path === path) idx = i;
    if (idx < 0) return;
    var v = ROWS[idx], go = null;
    if (e.key === 'ArrowDown') go = ROWS[Math.min(ROWS.length - 1, idx + 1)].n.path;
    else if (e.key === 'ArrowUp') go = ROWS[Math.max(0, idx - 1)].n.path;
    else if (e.key === 'Home') go = ROWS[0].n.path;
    else if (e.key === 'End') go = ROWS[ROWS.length - 1].n.path;
    /* while Find is on every match's path is forced open, so open/close does nothing and is not attempted */
    else if (e.key === 'ArrowRight') { if (v.k && !v.open && !FIND) { FOCUS = path; toggle(path, true); refocus(); e.preventDefault(); return; } var nx = ROWS[idx + 1]; if (v.open && nx && parentOf(nx.n.path) === path) go = nx.n.path; }
    else if (e.key === 'ArrowLeft') { if (v.open && !FIND) { FOCUS = path; toggle(path, false); refocus(); e.preventDefault(); return; } if (parentOf(path)) go = parentOf(path); }
    else if ((e.key === 'Enter' || e.key === ' ') && v.k) { e.preventDefault(); if (!FIND) { FOCUS = path; toggle(path, !v.open); refocus(); } return; }
    if (go == null) return;
    e.preventDefault();
    var r = rove(go); if (r) r.focus();
  }
  function click(e) {
    var d = e.target.closest ? e.target.closest('[data-depth]') : null; if (d) { setDepth(+d.getAttribute('data-depth')); return; }
    if (e.target.closest && e.target.closest('input')) return;
    var tr = e.target.closest ? e.target.closest('#cxTrGrid tr[data-path]') : null; if (!tr) return;
    var path = tr.getAttribute('data-path'); FOCUS = path;
    if (!FIND && tr.hasAttribute('aria-expanded') && e.target.closest('[data-col="name"]')) { toggle(path, tr.getAttribute('aria-expanded') !== 'true'); refocus(); }
    else rove(path);
  }
  function reset() { NODES = {}; save(); render(); }

  function init() {
    A = root.RZCxAnalysis; P = root.RZCxPlan; T = root.RZCxTree; if (!A || !P || !T || !A.state || !A.state.hooks) return;
    S = A.state; if (!build()) return;
    NODES = load();
    var panel = $('cxTrPanel');
    panel.addEventListener('click', click);
    panel.addEventListener('change', edit);
    panel.addEventListener('keydown', key);
    $('cxTrFind').addEventListener('input', function () { FIND = this.value.trim().toLowerCase(); render(); });
    $('cxTrReset').addEventListener('click', reset);
    var rb = $('cxAnReset'); if (rb) rb.addEventListener('click', reset);
    S.hooks.push(function (plan, month) { if (!month) render(); });
    A.render();
  }
  root.RZCxTreeUI = { nodes: function () { return clean(NODES); }, render: function () { render(); }, version: '1.0.0' };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})(typeof window !== 'undefined' ? window : this, typeof document !== 'undefined' ? document : null);
