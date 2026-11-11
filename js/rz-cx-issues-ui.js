/* rz-cx-issues-ui.js — Cx Analysis: the Tier 1 issue register panel, gate readiness in the inspector, and the
 * blocked marker on the schematic and the status table (K22; PRD v1.1 §14, §15–16, journey 2, T9).
 * Rules and numbers: RZCxIssues (DOM-free, tools/test-cx-issues.mjs). Hooks into RZCxAnalysis (state, render hooks).
 * User text (issue titles) only ever reaches the page through esc() or textContent. ES5. */
(function (root, doc) {
  'use strict';
  if (!doc) return;
  var A, S, P, I, R;
  function $(id) { return doc.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function sysLabel(id) { for (var i = 0; i < P.SYSTEMS.length; i++) if (P.SYSTEMS[i].id === id) return P.SYSTEMS[i].label; return id; }
  function say(t) { var o = $('cxIsMsg'); if (o) o.textContent = t; }

  function build() {
    var anchor = $('cxAnStatusTable'); if (!anchor || $('cxIsPanel')) return false;
    var statusPanel = anchor.closest ? anchor.closest('.cx-an-panel') : null; if (!statusPanel) return false;
    var opts = P.SYSTEMS.map(function (s) { return '<option value="' + s.id + '">' + esc(s.label) + '</option>'; }).join('');
    var p = doc.createElement('div'); p.className = 'cx-an-panel'; p.id = 'cxIsPanel';
    p.innerHTML = '<div class="cx-an-panel-head"><h3>Issues</h3><span class="cx-an-sub">local register, this browser · handbook 02.5.4: A blocks the gate; B blocks unless the CxM and EoR record the next level is not affected; C is a condition</span></div>' +
      '<div class="cx-is-intake" id="cxIsIntake" role="status" hidden><span id="cxIsIntakeText"></span>' +
      '<button type="button" class="cx-is-intake-btn" id="cxIsIntakeAdd">Add to register</button>' +
      '<button type="button" class="cx-is-intake-btn" id="cxIsIntakeDismiss">Dismiss</button></div>' +
      '<form class="cx-is-form" id="cxIsForm" novalidate>' +
      '<label>Title <input type="text" id="cxIsTitle" maxlength="120" class="input-field" placeholder="e.g. UPS-A1 bypass breaker fails to close"></label>' +
      '<label>Category <select id="cxIsSev" class="input-field"><option value="A">A · critical</option><option value="B">B · major</option><option value="C">C · minor</option></select></label>' +
      '<label>System <select id="cxIsSys" class="input-field">' + opts + '</select></label>' +
      '<label>Blocks gate <select id="cxIsGate" class="input-field"><option>L1</option><option>L2</option><option>L3</option><option selected>L4</option><option>L5</option></select></label>' +
      '<label>Owner <select id="cxIsOwner" class="input-field">' + I.ROLES.map(function (r) { return '<option>' + r + '</option>'; }).join('') + '</select></label>' +
      '<label>Due <input type="number" id="cxIsDue" min="0" max="120" step="0.5" class="input-field" placeholder="month" aria-label="Due month"></label>' +
      '<button type="submit" class="tool-btn is-primary" id="cxIsAdd">Add issue</button></form>' +
      '<p class="cx-an-sub cx-wb-msg" id="cxIsMsg" aria-live="polite"></p><div id="cxIsList"></div>';
    statusPanel.parentNode.insertBefore(p, statusPanel.nextSibling);
    return true;
  }

  function titleCell(x) {
    var rec = SRC ? SRC.get(x.id) : null, u = rec && root.RZHandoffCx ? root.RZHandoffCx.safeUrl(rec.url) : null;
    return u ? '<a href="' + esc(u) + '" title="Open the readiness gap in the RFS workbench">' + esc(x.title) + '</a>' : esc(x.title);
  }
  function renderList() {
    var h = $('cxIsList'); if (!h) return;
    var reg = R.load(), open = reg.items.filter(function (x) { return x.status === 'open'; }).length;
    if (!reg.items.length) { h.innerHTML = '<p class="cx-an-sub">No issues logged. An issue added here marks its system blocked on the schematic and the status table until it is closed.</p>'; return; }
    var t = '<div class="cx-an-tablewrap"><table class="cx-an-table cx-is-table"><caption class="cx-an-sub">' + reg.items.length + ' logged · ' + open + ' open' + (R.persisted() ? '' : ' · storage blocked: kept in this tab only') + '</caption><thead><tr><th>ID</th><th>Cat</th><th>Issue</th><th>System</th><th>Gate</th><th>Status</th></tr></thead><tbody>';
    for (var i = 0; i < reg.items.length; i++) {
      var x = reg.items[i], blocks = x.status === 'open' && (x.severity === 'A' || (x.severity === 'B' && !x.waiver));
      t += '<tr data-is="' + x.id + '"' + (x.status === 'closed' ? ' class="is-closed"' : '') + '><th scope="row">' + x.id + '</th><td><span class="cx-is-cat" data-cat="' + x.severity + '">' + x.severity + '</span></td>' +
        '<td><span class="cx-is-title">' + titleCell(x) + '</span><span class="cx-an-sub cx-is-meta">owner ' + (x.owner || '—') + ' · due ' + (x.due == null ? '—' : 'M' + x.due.toFixed(1)) + '</span></td>' +
        '<td><button type="button" class="cx-an-link" data-sel="sys:' + x.system + '">' + esc(sysLabel(x.system)) + '</button></td><td>' + x.gate + '</td>' +
        '<td class="cx-is-acts">' + (x.status === 'closed' ? 'closed' : (blocks ? '<b class="cx-is-blocks">open · blocks ' + x.gate + '</b>' : 'open · condition')) +
        (x.severity === 'B' && x.status === 'open' ? '<label class="cx-is-waive"><input type="checkbox" data-is-waive="' + x.id + '"' + (x.waiver ? ' checked' : '') + '> CxM + EoR: next level not affected</label>' : '') +
        '<span class="cx-is-btns"><button type="button" class="tool-btn" data-is-toggle="' + x.id + '">' + (x.status === 'closed' ? 'Reopen' : 'Close') + '</button> <button type="button" class="tool-btn" data-is-del="' + x.id + '" aria-label="Delete ' + x.id + '">Delete</button></span></td></tr>';
    }
    h.innerHTML = t + '</tbody></table></div>';
  }

  function decorate(plan) {
    if (!plan) return;
    var st = I.overlay(P.statusAt(plan, S.month), R.load()); if (!st) return;
    for (var i = 0; i < st.systems.length; i++) {
      var x = st.systems[i];
      var nodes = doc.querySelectorAll('#cxAnSheets [data-rzd-node="' + x.id + '"]');
      for (var j = 0; j < nodes.length; j++) {
        if (x.blocked) { nodes[j].setAttribute('data-cx-blocked', '1'); marker(nodes[j], x); }
        else nodes[j].removeAttribute('data-cx-blocked');
      }
      var tr = doc.querySelector('#cxAnStatusTable tr[data-cx-asset="' + x.id + '"]');
      if (tr && x.blocked) { tr.classList.add('is-blocked'); var td = tr.lastElementChild; if (td && !td.querySelector('.cx-is-blocks')) td.insertAdjacentHTML('beforeend', ' · <b class="cx-is-blocks">blocked ' + x.blockers.join(', ') + '</b>'); }
    }
    var counts = $('cxAnCounts');
    if (counts && !counts.querySelector('[data-cx-blocked-count]')) counts.insertAdjacentHTML('beforeend', '<span class="cx-an-count" data-cx-blocked-count>blocked <b>' + st.counts.blocked + '</b></span>');
  }
  /* static marker beside the node: a square with an × and the issue ids (PRD §2: marker statis, ikon + teks) */
  function marker(rect, x) {
    var svg = rect.ownerSVGElement; if (!svg || svg.querySelector('[data-cx-blocked-mark="' + x.id + '"]')) return;
    var xx = +rect.getAttribute('x'), yy = +rect.getAttribute('y'), w = +rect.getAttribute('width'); if (!isFinite(xx) || !isFinite(yy)) return;
    var ns = 'http://www.w3.org/2000/svg', g = doc.createElementNS(ns, 'g'); g.setAttribute('data-cx-blocked-mark', x.id); g.setAttribute('class', 'cx-is-mark');
    g.setAttribute('transform', 'translate(' + (xx + w - 10) + ',' + (yy - 7) + ')');
    var r = doc.createElementNS(ns, 'rect'); r.setAttribute('width', '14'); r.setAttribute('height', '14'); r.setAttribute('rx', '1');
    var p = doc.createElementNS(ns, 'path'); p.setAttribute('d', 'M3.5 3.5 L10.5 10.5 M10.5 3.5 L3.5 10.5');
    var t = doc.createElementNS(ns, 'title'); t.textContent = 'Blocked: ' + x.blockers.join(', ') + ' open against ' + x.next;
    g.appendChild(t); g.appendChild(r); g.appendChild(p); svg.appendChild(g);
  }

  function readinessBlock(plan) {
    var b = $('cxAnInsBody'); if (!b || !plan || !S.sel || S.sel.indexOf('sys:') !== 0) return;
    var sys = S.sel.slice(4), rd = I.readiness(plan, S.month, sys, R.load());
    var h = '<section class="cx-is-ready" data-ready="' + (rd.gate ? String(rd.ready) : 'done') + '"><h4 class="cx-wb-h4">Readiness' + (rd.gate ? ' for the ' + rd.gate + ' gate at M' + S.month : '') + '</h4>' +
      '<p class="cx-is-verdict">' + esc(rd.reason) + '</p>';
    if (rd.gate) {
      h += '<ul class="cx-is-items">' + rd.items.map(function (it) {
        return '<li><label><input type="checkbox" data-is-check="' + sys + ':' + rd.gate + ':' + it.key + '"' + (it.done ? ' checked' : '') + '> ' + esc(it.text) + '</label> <span class="cx-an-sub">' + it.role + ' · <a href="' + it.cite + '">handbook</a></span></li>';
      }).join('') + '</ul>';
      if (rd.blockers.length) h += '<p class="cx-an-sub">Blocking: ' + rd.blockers.map(function (x) { return esc(x.id + ' (' + x.severity + ') ' + x.title); }).join(' · ') + '</p>';
      if (rd.conditions.length) h += '<p class="cx-an-sub">Conditions: ' + rd.conditions.map(function (x) { return esc(x.id + ' (' + x.severity + ') ' + x.title); }).join(' · ') + '</p>';
      h += '<p class="cx-an-sub">' + esc(rd.note) + ' Ticks are kept in this browser.</p>';
    }
    b.insertAdjacentHTML('beforeend', h + '</section>');
  }

  function rerender() { A.render(); }
  function bind() {
    $('cxIsForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var due = parseFloat($('cxIsDue').value);
      var r = R.add({ title: $('cxIsTitle').value, severity: $('cxIsSev').value, system: $('cxIsSys').value, gate: $('cxIsGate').value, owner: $('cxIsOwner').value, due: isNaN(due) ? null : due });
      if (!r.ok) { say(r.code === 'TITLE' ? 'Give the issue a title (1–120 characters)' : 'Pick a category, system and gate'); return; }
      $('cxIsTitle').value = ''; $('cxIsDue').value = '';
      say(r.issue.id + ' added' + (r.issue.severity === 'C' ? ' as a condition on ' : ' — blocks ') + r.issue.gate + ' for ' + sysLabel(r.issue.system));
      rerender();
    });
    $('cxTabAnalysis').addEventListener('change', function (e) {
      var t = e.target; if (!t || !t.getAttribute) return;
      var k = t.getAttribute('data-is-check'), w = t.getAttribute('data-is-waive');
      if (k) { var p = k.split(':'); R.check(p[0], p[1], p[2], t.checked); rerender(); restoreFocus('[data-is-check="' + k + '"]'); }
      else if (w) { R.setWaiver(w, t.checked); rerender(); restoreFocus('[data-is-waive="' + w + '"]'); }
    });
    $('cxIsList').addEventListener('click', function (e) {
      var t = e.target; if (!t || !t.getAttribute) return;
      var tg = t.getAttribute('data-is-toggle'), d = t.getAttribute('data-is-del');
      if (tg) { var it = R.load().items.filter(function (x) { return x.id === tg; })[0]; if (it) { R.setStatus(tg, it.status === 'open' ? 'closed' : 'open'); say(tg + (it.status === 'open' ? ' closed' : ' reopened')); rerender(); } }
      else if (d) { R.remove(d); say(d + ' deleted'); rerender(); }
    });
  }
  /* P13 part B: readiness gaps queued by the RFS workbench (RZHandoffCx, key rz_handoff_cx) wait here until the user
   * adds them (one issue each, title suffixed "(RFS)", source link in rz-cx-issue-sources) or dismisses them. */
  var Q = null, SRC = null;
  function renderIntake() {
    var box = $('cxIsIntake'); if (!box || !Q) return;
    var st = Q.load(), n = st.items.length;
    box.hidden = !n;
    $('cxIsIntakeText').textContent = n ? n + ' readiness gap' + (n > 1 ? 's' : '') + ' waiting' : '';
    box.title = n ? st.items.map(function (x) { return x.title + ' · ' + x.severity + ' · ' + sysLabel(x.system) + ' · ' + x.gate; }).join('\n') : '';
    if (st.expired) say(st.expired + ' queued gap' + (st.expired > 1 ? 's' : '') + ' older than 7 days discarded');
  }
  function bindIntake() {
    var st = null; try { st = root.localStorage; } catch (e) { st = null; }
    if (!root.RZHandoffCx || !st) return;
    Q = root.RZHandoffCx.queue(st); SRC = root.RZHandoffCx.sources(st);
    $('cxIsIntakeAdd').addEventListener('click', function () {
      var r = root.RZHandoffCx.intake(Q, R, SRC);
      say(r.added.length + ' added' + (r.added.length ? ' (' + r.added.map(function (x) { return x.id; }).join(', ') + ')' : '') +
          (r.refused.length ? ' · ' + r.refused.length + ' refused: ' + r.refused.map(function (x) { return x.gap_id + ' ' + x.code; }).join(', ') : ''));
      rerender(); renderIntake();
    });
    $('cxIsIntakeDismiss').addEventListener('click', function () { Q.clear(); say('Queued gaps dismissed'); renderIntake(); });
    renderIntake();
  }
  function restoreFocus(sel) { var q = doc.querySelector(sel); if (q) q.focus(); }
  function hook(plan) { renderList(); decorate(plan); readinessBlock(plan); }
  function init() {
    A = root.RZCxAnalysis; P = root.RZCxPlan; I = root.RZCxIssues;
    if (!A || !P || !I || !A.state || !A.state.hooks) return;
    S = A.state; var st = null; try { st = root.localStorage; } catch (e) { st = null; }
    R = I.store(st); if (!build()) return;
    bind(); bindIntake(); S.hooks.push(hook); A.render();
  }
  root.RZCxIssuesUI = { version: '3.33.0' };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})(typeof window !== 'undefined' ? window : this, typeof document !== 'undefined' ? document : null);
