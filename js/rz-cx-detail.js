/* rz-cx-detail.js — K29: a block on the Cx schematic opens the inside of that system in a modal. The
 * modal holds the system's own one-line / P&ID (RZCxSubsheets), its L1–L5 gate months at the viewed
 * month (RZCxPlan.statusAt — the same numbers as the status table), the handbook test ladder with each
 * row's anchor, a component card on click, and the neighbours along the giant sheet's edges
 * (one hop along RZCxSchematic.EDGES) so a reader can walk the plant block by block. Native <dialog>: focus is trapped
 * by the browser, Escape closes, focus returns to the block that opened it. Hooks into RZCxAnalysis. ES5. */
(function (root, doc) {
  'use strict';
  if (!doc) return;
  var A, P, SS, SC, S, DLG = null, TRIGGER = null, CUR = null;
  var SEQ = ['L1', 'L2', 'L3', 'L4', 'L5'], TAGOF = { L1: 'red', L2: 'yellow', L3: 'green', L4: 'blue', L5: 'white' };
  var SHEET = { electrical: 'Sheet A · Electrical', mechanical: 'Sheet B · Mechanical / P&ID', controls: 'Sheet C · Controls & life safety' };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function sys(id) { for (var i = 0; i < P.SYSTEMS.length; i++) if (P.SYSTEMS[i].id === id) return P.SYSTEMS[i]; return null; }
  function rowAt(id) { if (!S.plan) return null; var st = P.statusAt(S.plan, S.month); for (var i = 0; i < st.systems.length; i++) if (st.systems[i].id === id) return st.systems[i]; return null; }
  function mo(v) { return v == null ? '—' : P.fmtMo(v); }

  function build() {
    if (DLG) return DLG;
    DLG = doc.createElement('dialog'); DLG.className = 'cx-dt'; DLG.id = 'cxDetail'; DLG.setAttribute('aria-labelledby', 'cxDtTitle');
    DLG.innerHTML = '<div class="cx-dt-head"><div><p class="cx-dt-eyebrow" id="cxDtEyebrow"></p><h2 id="cxDtTitle"></h2><p class="cx-dt-state" id="cxDtState"></p></div>' +
      '<button type="button" class="cx-dt-close" data-cx-dt-close aria-label="Close">×</button></div>' +
      '<ol class="cx-dt-gates" id="cxDtGates" aria-label="Gate months"></ol>' +
      '<p class="cx-dt-note" id="cxDtNote"></p>' +
      '<figure class="cx-an-sheet cx-dt-sheet" id="cxDtSheet"></figure>' +
      '<p class="cx-dt-hint">Click a component to see what it does.</p>' +
      '<div class="cx-dt-comp" id="cxDtComp" hidden></div>' +
      '<h3 class="cx-dt-h3">Test ladder</h3><table class="cx-an-table cx-dt-tests"><thead><tr><th>Level</th><th>What is tested</th><th>Gate</th><th>Source</th></tr></thead><tbody id="cxDtTests"></tbody></table>' +
      '<div class="cx-dt-walk" id="cxDtWalk"></div>';
    doc.body.appendChild(DLG);
    DLG.addEventListener('click', function (e) {
      if (e.target === DLG || (e.target.closest && e.target.closest('[data-cx-dt-close]'))) { close(); return; }
      var go = e.target.closest ? e.target.closest('[data-cx-dt-go]') : null; if (go) { open(go.getAttribute('data-cx-dt-go'), TRIGGER); return; }
      var hit = e.target.closest ? e.target.closest('[data-rzd-hit]') : null; if (hit) comp(hit.getAttribute('data-rzd-hit'));
    });
    DLG.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var hit = e.target.closest ? e.target.closest('[data-rzd-hit]') : null; if (!hit) return; e.preventDefault(); comp(hit.getAttribute('data-rzd-hit'));
    });
    DLG.addEventListener('close', function () { CUR = null; if (TRIGGER && TRIGGER.focus && doc.contains(TRIGGER)) { try { TRIGGER.focus(); } catch (x) {} } });
    return DLG;
  }
  function comp(cid) {
    var d = SS.get(CUR), k = null, box = doc.getElementById('cxDtComp');
    for (var i = 0; d && i < d.comps.length; i++) if (d.comps[i].id === cid) k = d.comps[i];
    if (!k) return;
    var nodes = DLG.querySelectorAll('#cxDtSheet [data-rzd-node]');
    for (var j = 0; j < nodes.length; j++) { if (nodes[j].getAttribute('data-rzd-node') === cid) nodes[j].setAttribute('data-cx-selected', '1'); else nodes[j].removeAttribute('data-cx-selected'); }
    box.innerHTML = '<b>' + esc(k.name) + '</b> <span class="cx-dt-tag">' + esc(k.tag || '') + '</span><p>' + esc(k.does) + '</p>';
    box.hidden = false; box.setAttribute('data-comp', cid);
  }
  function fill(id) {
    var d = SS.get(id), s = sys(id), r = rowAt(id), g = r ? r.gates : {}, h = '', i;
    doc.getElementById('cxDtEyebrow').textContent = (SHEET[s.block] || s.block) + ' · M' + S.month;
    doc.getElementById('cxDtTitle').textContent = d.title;
    doc.getElementById('cxDtState').innerHTML = r ? '<i class="cx-tag cx-tag-' + (r.tag || 'none') + '"></i> ' + (r.level === 'L5' ? 'L5 · IST passed' : r.inTest ? (r.level || '—') + ' · in test for ' + r.next : r.level ? r.level + ' passed · next ' + r.next + ' at ' + mo(g[r.next]) : 'planned · first gate ' + r.next + ' at ' + mo(g[r.next])) : 'no plan';
    for (i = 0; i < SEQ.length; i++) {
      var L = SEQ[i], gm = g[L], done = gm != null && gm <= S.month;
      h += '<li data-level="' + L + '" data-state="' + (done ? 'passed' : 'ahead') + '"><i class="cx-tag cx-tag-' + (done ? TAGOF[L] : 'none') + '"></i><b>' + L + '</b> ' + mo(gm) + '</li>';
    }
    doc.getElementById('cxDtGates').innerHTML = h;
    doc.getElementById('cxDtNote').textContent = d.note;
    var sh = SS.render(id, {}); doc.getElementById('cxDtSheet').innerHTML = sh.svg;
    var nodes = DLG.querySelectorAll('#cxDtSheet [data-rzd-hit]'); for (i = 0; i < nodes.length; i++) nodes[i].setAttribute('aria-describedby', 'cxDtComp');
    h = '';
    for (i = 0; i < d.tests.length; i++) {
      var t = d.tests[i], tm = g[t.level], ok = tm != null && tm <= S.month;
      h += '<tr data-level="' + t.level + '" class="' + (ok ? 'is-passed' : '') + '"><th scope="row"><i class="cx-tag cx-tag-' + (ok ? TAGOF[t.level] : 'none') + '"></i> ' + t.level + '</th><td>' + esc(t.text) + '</td><td class="num">' + (tm == null ? '—' : (ok ? 'passed ' : 'due ') + mo(tm)) + '</td><td><a href="' + esc(t.cite) + '" target="_blank" rel="noopener">Handbook ' + esc(t.cite.replace(/^.*#s/, '').replace(/-/g, '.')) + '</a></td></tr>';
    }
    doc.getElementById('cxDtTests').innerHTML = h;
    var E = SC && SC.EDGES ? (SC.EDGES[s.block] || []) : [], up = [], dn = [];   /* one hop: a closed liquid loop makes a transitive trace list half the plant */
    for (i = 0; i < E.length; i++) { if (E[i][1] === id && up.indexOf(E[i][0]) < 0) up.push(E[i][0]); if (E[i][0] === id && dn.indexOf(E[i][1]) < 0) dn.push(E[i][1]); }
    function btns(list) { return list.length ? list.map(function (x) { var q = sys(x); return q ? '<button type="button" class="tool-btn" data-cx-dt-go="' + x + '">' + esc(q.label) + '</button>' : ''; }).join('') : '<span class="cx-dt-none">none on this sheet</span>'; }
    doc.getElementById('cxDtWalk').innerHTML = '<p><span>Fed by</span>' + btns(up.slice(0, 4)) + '</p><p><span>Feeds</span>' + btns(dn.slice(0, 4)) + '</p>';
    var cb = doc.getElementById('cxDtComp'); cb.hidden = true; cb.innerHTML = ''; cb.removeAttribute('data-comp');
    DLG.setAttribute('data-system', id);
  }
  function open(id, trigger) {
    if (!SS || !SS.get(id) || !sys(id)) return false;
    build(); CUR = id; if (trigger) TRIGGER = trigger;
    fill(id);
    if (!DLG.open) { if (DLG.showModal) DLG.showModal(); else DLG.setAttribute('open', ''); }
    DLG.scrollTop = 0;
    var c = DLG.querySelector('[data-cx-dt-close]'); if (c) c.focus();
    return true;
  }
  function close() { if (DLG && DLG.open) { if (DLG.close) DLG.close(); else { DLG.removeAttribute('open'); CUR = null; } } }
  function hook() { if (CUR && DLG && DLG.open) fill(CUR); }
  function init() {
    A = root.RZCxAnalysis; P = root.RZCxPlan; SS = root.RZCxSubsheets; SC = root.RZCxSchematic;
    if (!A || !P || !SS || !A.state || !A.state.hooks) return;
    S = A.state; S.hooks.push(hook);
    var host = doc.getElementById('cxAnSheets'); if (!host) return;
    host.addEventListener('click', function (e) {
      var hit = e.target.closest ? e.target.closest('[data-rzd-hit]') : null; if (!hit) return;
      var id = hit.getAttribute('data-rzd-hit'); root.setTimeout(function () { var again = host.querySelector('[data-rzd-hit="' + id + '"]'); open(id, again || hit); }, 0);
    });
    host.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var hit = e.target.closest ? e.target.closest('[data-rzd-hit]') : null; if (!hit) return;
      var id = hit.getAttribute('data-rzd-hit'); root.setTimeout(function () { var again = host.querySelector('[data-rzd-hit="' + id + '"]'); open(id, again || hit); }, 0);
    });
  }
  root.RZCxDetail = { version: '3.33.0', open: open, close: close, current: function () { return CUR; } };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})(typeof window !== 'undefined' ? window : this, typeof document !== 'undefined' ? document : null);
