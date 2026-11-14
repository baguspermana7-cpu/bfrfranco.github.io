/*
 * hmi-v2.js — datahallAI redraw, MOCK layer (R128–R134, PRD §12). Loaded only by dh-drawings-mock.html.
 * 1. shell: one nav row in the RZ register; reference actions in a Docs menu; "SIMULATED · ENGINE BASIS" → SIM chip
 * 2. sidebar: pinned / auto-hide / hidden, remembered per viewer
 * 3. drawings: Cooling (DH-M-103), Electrical DH-01 (DH-E-101), Rack (DH-R-101) from js/datahall-ai/hmi-sheets.js
 *    through js/rz-hmi-sheet.js; every number from RZDatahallAIHmiPayloads / the DCAI snapshot
 * 4. equipment modal (ISA-101 L3) for the CDU class, with Trace on the parent sheet
 * Existing ids and listeners are MOVED, never re-created, so every gate that binds them keeps working.
 */
(function (win, doc) {
  'use strict';
  if (!win || !doc || win.__rzDhHmiV2) return;
  win.__rzDhHmiV2 = true;
  var $ = function (s, r) { return (r || doc).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); };
  function el(tag, attrs, html) { var e = doc.createElement(tag); for (var k in attrs || {}) e.setAttribute(k, attrs[k]); if (html != null) e.innerHTML = html; return e; }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } return null; }

  /* ── 1. shell ─────────────────────────────────────────────────────────────────────────────────────── */
  function shell() {
    var hdr = $('header.hdr'); if (!hdr || hdr.getAttribute('data-dh2')) return;
    hdr.setAttribute('data-dh2', '1');
    var nav = el('nav', { class: 'dh2-nav', 'data-rz-shell-nav': '', 'aria-label': 'AI Data Hall' });
    var back = el('a', { class: 'dh2-back', href: 'datacenter-solutions.html', 'aria-label': 'Back to DC Solutions', title: 'Back to DC Solutions' }, '&#8592;');
    var title = el('span', { class: 'dh2-title' }, 'AI Data Hall');
    var chip = $('#datahallAuthorityChip');
    var sim = el('span', { class: 'dh2-sim', tabindex: '0', role: 'note',
      title: 'Simulated data on the engine basis: every value is computed by the DCAI engine from a locked set of inputs, not read from a live site. Independent personal research for education and estimation; not professional advice.' }, 'SIM');
    var ask = $('[data-rz-ask-slot]');
    var replay = $('#rzReplayTrig');
    var docs = el('details', { class: 'dh2-docs' });
    docs.appendChild(el('summary', { 'aria-label': 'Documents', title: 'PRD, manual, basis of design, FAQ, design pack' }, 'Docs'));
    var menu = el('div', { class: 'dh2-menu', role: 'menu' });
    $$('.hdr-main a.bbtn:not(.rz-public-contract-link)').forEach(function (a) { a.textContent = a.textContent.replace(/^\s*\u2190\s*/, ''); a.className = 'dh2-mi'; a.setAttribute('role', 'menuitem'); menu.appendChild(a); });
    ['#bodTrig', '#faqTrig', '#genDesignTrig'].forEach(function (s) { var b = $(s); if (b) { b.className = 'dh2-mi'; b.setAttribute('role', 'menuitem'); menu.appendChild(b); } });
    docs.appendChild(menu);
    var clk = $('#clk'), theme = $('#themeToggle');
    var sp = el('span', { class: 'dh2-sp' });
    var user = el('span', { class: 'dh2-user' });
    [back, title, chip, sim, sp, ask, replay, docs, clk, user, theme].forEach(function (n) { if (n) nav.appendChild(n); });
    hdr.insertBefore(nav, hdr.firstChild);
    var main = $('.hdr-main', hdr), right = $('.hdr-r', hdr);
    if (main) main.hidden = true;
    if (right) {
      right.hidden = true;
      // auth.js injects the account button into .hdr-r, before or after this runs: keep it in the nav row
      var adopt = function () { Array.prototype.slice.call(right.children).forEach(function (c) { user.appendChild(c); }); };
      adopt();
      if (win.MutationObserver) new MutationObserver(adopt).observe(right, { childList: true });
    }
    doc.addEventListener('click', function (e) { if (!docs.contains(e.target)) docs.removeAttribute('open'); });
    contractLinks(nav, docs, menu);
  }
  /* PRD and Manual stay public while the cockpit is locked: auth.js lifts them into a fixed layer placed over
     hidden slots in the header. Unlocked, they are ordinary items of the Docs menu; locked, their slots sit in
     the nav row at the nav's own size, so the lifted links land inside the bar instead of below it. */
  function contractLinks(nav, docs, menu) {
    function sync() {
      var locked = doc.body.classList.contains('locked');
      var slots = $$('.rz-public-contract-slot'), links = $$('a.rz-public-contract-link');
      slots.forEach(function (sl) { if (sl.parentNode !== nav) nav.insertBefore(sl, docs); sl.classList.add('dh2-slot'); sl.hidden = !locked; });
      var layer = $('.rz-public-contract-layer');
      links.forEach(function (a, i) {
        if (!locked) {
          if (a.parentNode !== menu) { a.removeAttribute('style'); a.className = 'dh2-mi rz-public-contract-link'; a.setAttribute('role', 'menuitem'); menu.insertBefore(a, menu.children[i] || null); }
        } else if (layer && a.parentNode !== layer) {
          a.className = 'dh2-slot-link rz-public-contract-link';
          a.style.cssText = 'position:fixed;z-index:1;pointer-events:auto';
          layer.appendChild(a);
          var r = slots[i] && slots[i].getBoundingClientRect(); if (r) { a.style.left = r.left + 'px'; a.style.top = r.top + 'px'; }
        }
      });
    }
    sync();
    new MutationObserver(sync).observe(doc.body, { attributes: true, attributeFilter: ['class'], childList: true });
  }

  /* ── 2. sidebar: pinned / auto-hide / hidden ─────────────────────────────────────────────────────── */
  var MODES = [['pinned', 'Keep the sidebar shown', '&#9646;&#9647;'], ['auto', 'Auto-hide the sidebar: it opens on hover or focus', '&#9647;&#9647;'], ['hidden', 'Hide the sidebar', '&#9647;']];
  function sidebar() {
    var head = $('aside.side .dh-head'); if (!head || $('[data-side-mode]')) return;
    var grp = el('div', { class: 'dh2-sidemodes', role: 'group', 'aria-label': 'Sidebar' });
    MODES.forEach(function (m) {
      var b = el('button', { type: 'button', class: 'dh2-sm', 'data-side-mode': m[0], 'aria-label': m[1], title: m[1], 'aria-pressed': 'false' }, '<span aria-hidden="true">' + m[2] + '</span>');
      b.addEventListener('click', function () { setSide(m[0]); if (m[0] === 'auto' && b.blur) b.blur(); });
      grp.appendChild(b);
    });
    var tog = $('#sideTog'); if (tog) tog.classList.add('dh2-legacy-tog');
    head.parentNode.insertBefore(grp, head.nextSibling);
    var reopen = $('#sideReopen');
    if (reopen) { reopen.addEventListener('click', function (e) { e.stopImmediatePropagation(); setSide('pinned'); }, true); }
    doc.addEventListener('keydown', function (e) {
      if (e.key !== '[' || /input|select|textarea/i.test((e.target.tagName || ''))) return;
      var cur = doc.body.getAttribute('data-side') || 'pinned';
      setSide(cur === 'pinned' ? 'auto' : cur === 'auto' ? 'hidden' : 'pinned');
    });
    setSide(store('dh_side_mode') || (win.matchMedia && win.matchMedia('(max-width: 860px)').matches ? 'auto' : 'pinned'), true);
  }
  function setSide(mode, quiet) {
    if (['pinned', 'auto', 'hidden'].indexOf(mode) < 0) mode = 'pinned';
    doc.body.setAttribute('data-side', mode);
    $$('[data-side-mode]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-side-mode') === mode)); });
    if (!quiet) store('dh_side_mode', mode);
    win.dispatchEvent(new Event('resize'));
  }

  /* ── 3. values from the engine payloads ─────────────────────────────────────────────────────────── */
  var P = win.RZDatahallAIHmiPayloads, cache = {}, tickSeen = null;
  function ctx() { return P && P.buildContext ? P.buildContext(win, { hall: 1 }) : null; }
  function payload(cls, id) {
    var c = ctx(); if (!c || !P) return null;
    if (c.tick !== tickSeen) { cache = {}; tickSeen = c.tick; }
    var k = cls + ':' + id;
    if (!cache[k]) { try { cache[k] = P.safePayload(cls, id, c); } catch (e) { cache[k] = null; } }
    return cache[k];
  }
  function rows(p) {
    if (!p || !p.tabs) return [];
    var out = [];
    Object.keys(p.tabs).forEach(function (t) { (Array.isArray(p.tabs[t]) ? p.tabs[t] : []).forEach(function (r) { out.push(r); }); });
    return out;
  }
  function text(r) {
    if (!r) return '—';
    var t = r.text != null ? String(r.text) : (r.value != null ? String(r.value) : '—');
    return r.unit && t !== '—' && t.indexOf(r.unit) < 0 ? t + ' ' + r.unit : t;
  }
  function find(p, re) { var rs = rows(p); for (var i = 0; i < rs.length; i++) if (re.test(rs[i].label || '') || re.test(rs[i].point || '')) return rs[i]; return null; }
  var CLS_PAYLOAD = { cdu: 'cdu', 'cdu-pump': 'cdu', 'sld-tx': 'sld-tx', 'sld-mv-sub': 'sld-mv-sub', 'sld-msb': 'sld-msb', 'sld-ups-a': 'sld-ups-a', 'sld-ups-b': 'sld-ups-b',
    'sld-rack-psu': 'sld-rack-psu', 'rack-ct': 'rack-ct', 'rack-ns': 'rack-ns', 'rack-psu': 'rack-psu', 'rack-busbar': 'rack-busbar', 'rack-manifold': 'rack-manifold', 'rack-leak': 'rack-leak',
    'fire-facp': 'fire-facp', 'fire-zone': 'fire-zone', 'fire-vesda': 'fire-vesda', 'fire-mcp': 'fire-mcp', 'fire-epo': 'fire-epo', 'fire-point': 'fire-point' };
  /* fire points keep their full inventory id (DH-01-Z05-SD1-02); the point state comes from the workstation snapshot through the payload */
  function fireStateOf(p) {
    if (!p) return { state: 'unknown' };
    var r = find(p, /^(state|panel|stage|point|zone)$/i) || find(p, /state|stage|panel/i), t = r ? text(r).toLowerCase() : 'normal';
    if (/alarm|fire|discharg|released|activated|^active/.test(t) && !/pre-?alarm/.test(t)) return { state: 'fault', alarm: '1' };
    if (/pre-?alarm|armed|trouble|impaired|fault|watch/.test(t)) return { state: 'normal', alarm: '2' };
    if (/isolated|expired|disabled|out of service/.test(t)) return { state: 'standby', alarm: '3' };
    return { state: 'normal' };
  }
  function stateOf(n, p) {
    if (/^cb|^disconnector/.test(n.sym)) return n.id === 'tie' || /^mb/.test(n.id) ? 'open' : 'closed';
    if (/^valve/.test(n.sym)) return 'open';
    if (/^transformer/.test(n.sym)) return 'energized';
    if (n.standby) return 'standby';
    var s = p && find(p, /status|state|mode/i);
    var t = s ? text(s) : '';
    if (/fault|trip|alarm/i.test(t)) return 'fault';
    if (/standby|stby/i.test(t)) return 'standby';
    return 'running';
  }
  function read(n) {
    if (n.sym === 'junction') return {};
    var cls = n.cls && CLS_PAYLOAD[n.cls], id = n.eqId || n.id, fire = !!cls && cls.indexOf('fire-') === 0;
    var p = cls ? payload(cls, fire ? String(id) : String(id).replace(/^[A-Z]+-?/, '').replace(/-\d+$/, '') || '1') : null;
    var tip = [];
    if (fire) { var fs = fireStateOf(p); rows(p).slice(0, 6).forEach(function (r) { tip.push([r.label, text(r)]); }); return { state: fs.state, alarm: fs.alarm, values: {}, rows: tip }; }
    var st = stateOf(n, p), v = {};
    if (/p-\d\dc$/i.test(n.tag || '')) st = 'standby';
    (n.values || []).forEach(function (x) {
      var r = null;
      if (x.k === 'duty') r = find(p, /duty|heat/i);
      else if (x.k === 'flow') r = find(p, /flow/i);
      else if (x.k === 'tcsS') r = find(p, /supply.*t|tcs.*supply|supply temp/i);
      else if (x.k === 'tcsR') r = find(p, /return.*t|tcs.*return|return temp/i);
      else if (x.k === 'pos') r = find(p, /valve|position/i);
      else if (/^p\d$/.test(x.k)) r = x.k === 'p3' ? { text: 'standby' } : find(p, /pump.*speed|speed/i);
      else if (x.k === 'load' || x.k === 'ups') r = find(p, /load/i);
      else if (x.k === 'rack') r = find(p, /current|feed/i);
      v[x.k] = { text: text(r) };
    });
    rows(p).slice(0, 6).forEach(function (r) { tip.push([r.label, text(r)]); });
    return { state: st, values: v, rows: tip };
  }

  /* ── 4. the sheets on their tabs ────────────────────────────────────────────────────────────────── */
  var sheets = {};
  function fireInventory() {
    var W = win.RZDatahallAIFireWorkstation, inv = W && W.inventory ? W.inventory() : null;
    if (!inv && typeof win.fireInv === 'function') inv = win.fireInv();
    return inv || null;
  }
  function mount(svgId, sheetId, svgNewId, o) {
    var old = doc.getElementById(svgId), S = win.RZDatahallAISheets, R = win.RZHmiSheet, snap = win.DCAI_CALC && win.DCAI_CALC.snapshot;
    if (!old || !S || !R || !snap) return;
    var bx = old.closest('.bx'); if (!bx || bx.querySelector('.hmi-host')) return;
    var host = el('div', { class: 'hmi-host', 'data-hmi-sheet': sheetId });
    var h3 = bx.querySelector('h3');
    Array.prototype.slice.call(bx.children).forEach(function (c) { if (c !== h3) c.setAttribute('data-dh2-retired', ''); });
    bx.appendChild(host);
    var sheet = S.build(sheetId, snap, o); sheet.svgId = svgNewId;
    sheets[sheetId] = R.render(host, sheet, { read: read, open: open });
  }
  function mountAll() {
    mount('coolSvg', 'dh-m-103', 'hmiCoolSvg');
    mount('elecDH1Svg', 'dh-e-101', 'hmiElecDH1Svg');
    mount('rackSvg', 'dh-r-101', 'hmiRackSvg');
    var fi = fireInventory(); if (fi) mount('fireSvg', 'dh-f-101', 'hmiFireSvg', { fire: fi });
  }
  setInterval(function () { Object.keys(sheets).forEach(function (k) { if (sheets[k] && sheets[k].svg.getBoundingClientRect().width) sheets[k].update(); }); }, 4000);

  /* ── 5. equipment modal (L3) ─────────────────────────────────────────────────────────────────────── */
  var back = null, lastFocus = null, modalSheet = null;
  function close() { if (!back) return; back.hidden = true; if (modalSheet) modalSheet.destroy(); modalSheet = null; if (lastFocus) lastFocus.focus(); }
  function bandHtml(r) {
    if (!r || !r.band || r.value == null) return '';
    var lo = r.band[0], hi = r.band[1], span = (hi - lo) || 1, pad = span * 0.5, a = lo - pad, b = hi + pad, pct = function (x) { return Math.max(0, Math.min(100, (x - a) / (b - a) * 100)); };
    return '<div class="pt-band" aria-hidden="true"><i></i><b style="left:' + pct(lo) + '%;width:' + (pct(hi) - pct(lo)) + '%"></b><u style="left:' + pct(r.value) + '%"></u></div>';
  }
  function open(n, api) {
    if (n.cls !== 'cdu') return false;          // mock scope: the CDU class; other classes keep the current HMI
    var id = String(n.eqId || '01');
    lastFocus = doc.activeElement;
    if (!back) {
      back = el('div', { class: 'hmi-modal-back', hidden: '' });
      back.addEventListener('click', function (e) { if (e.target === back) close(); });
      doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && back && !back.hidden) close(); });
      doc.body.appendChild(back);
    }
    var p = payload('cdu', id), rs = rows(p), st = stateOf(n, p);
    var pts = rs.slice(0, 16).map(function (r) {
      return '<div class="hmi-pt"' + (r.alarm ? ' data-alarm="' + r.alarm + '"' : '') + (r.point ? ' title="Point ' + String(r.point) + '"' : '') + '>' +
        '<span class="pt-label">' + (r.label || '') + '</span><span class="pt-val">' + text(r) + '</span>' + bandHtml(r) + '</div>';
    }).join('');
    back.innerHTML = '<div class="hmi-modal" role="dialog" aria-modal="true" aria-labelledby="hmiModalTag" data-rz-modal-class="cdu">' +
      '<header><span class="tag" id="hmiModalTag">CDU-' + id + '</span><span class="cls">Coolant distribution unit</span><span class="state">' + st + '</span><span class="sp"></span>' +
      '<button type="button" class="hmi-btn" data-trace="up" title="Show what feeds this CDU on the CDU line">Trace upstream</button>' +
      '<button type="button" class="hmi-btn" data-trace="down" title="Show what this CDU feeds on the CDU line">Trace downstream</button>' +
      '<button type="button" class="hmi-btn" data-close aria-label="Close">&#215;</button></header>' +
      '<div class="hmi-m-draw"></div><div class="hmi-m-pts"><div class="hmi-m-sec">Points</div>' + (pts || '<p>—</p>') + '</div>' +
      '<div class="hmi-m-foot"><div><div class="hmi-m-sec">Trend, last 24 h (simulated)</div><div class="hmi-trend">' + trend(id) + '</div></div>' +
      '<div><div class="hmi-m-sec">Alarms</div><ul class="hmi-evt">' + (rs.filter(function (r) { return r.alarm; }).map(function (r) { return '<li>' + r.label + ' · ' + text(r) + '</li>'; }).join('') || '<li>None active</li>') + '</ul></div></div></div>';
    back.hidden = false;
    modalSheet = win.RZHmiSheet.render(back.querySelector('.hmi-m-draw'), win.RZDatahallAISheets.build('cdu', win.DCAI_CALC.snapshot, { id: id }), { read: read });
    back.querySelector('[data-close]').addEventListener('click', close);
    $$('[data-trace]', back).forEach(function (b) {
      b.addEventListener('click', function () {
        var dir = b.getAttribute('data-trace'); close();
        if (api) { api.trace(n.id, dir); api.focus(n.id); }
      });
    });
    back.querySelector('[data-close]').focus();
    return true;
  }
  function trend(id) {
    var c = ctx(); if (!c || !P) return '';
    var pts = [], lo = Infinity, hi = -Infinity;
    for (var k = 47; k >= 0; k--) {
      var cc = {}; for (var x in c) cc[x] = c[x]; cc.tick = c.tick - k * 450;
      var r = null; try { r = find(P.safePayload('cdu', id, cc), /differential pressure/i); } catch (e) { r = null; }
      var v = r && typeof r.value === 'number' ? r.value : null; pts.push(v);
      if (v != null) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    }
    if (!isFinite(lo)) return '';
    var pad = (hi - lo) * 0.3 || 0.5; lo -= pad; hi += pad;
    var d = pts.map(function (v, i) { return v == null ? '' : (i ? 'L' : 'M') + (i * 300 / 47).toFixed(1) + ' ' + (60 - (v - lo) / (hi - lo) * 56).toFixed(1); }).join(' ');
    var last = pts[pts.length - 1];
    return '<svg viewBox="0 0 300 64" preserveAspectRatio="none" role="img" aria-label="CDU differential pressure, last 24 hours"><path d="' + d + '"/></svg>' +
      '<div class="hmi-trend-ax"><span>-24 h</span><span>Differential pressure ' + (last != null ? last.toFixed(2) + ' bar' : '—') + '</span><span>now</span></div>';
  }

  /* less text around the drawings (R128/R131): the floor budget belongs to Room Layout, the data-mode pill
     repeats the SIM chip, the legal notice moves under the content (it stays on every tab) */
  function declutter() {
    var budget = $('section[aria-labelledby="hallBudgetTitle"]'), over = $('#p-over');
    if (budget && over) over.insertBefore(budget, over.firstChild);
    var legal = $('details.legal-disclaimer-wrap'), mn = $('.mn');
    if (legal && mn) { mn.appendChild(legal); var pill = legal.querySelector('summary [aria-label="Data mode"]'); if (pill) pill.hidden = true; }
    // captions and eyebrows above a view become the heading's tooltip; the view keeps its title only
    $$('.mn .rz-ops-caption, .mn .dh-primary-q').forEach(function (c) {
      var box = c.closest('.bx, .rz-ops-section, .rz-ops-section__head') || c.parentNode;
      var h = box && box.querySelector('h3');
      if (h && !h.getAttribute('title')) { h.setAttribute('title', c.textContent.replace(/\s+/g, ' ').trim()); h.classList.add('dh2-has-tip'); }
      c.hidden = true;
    });
    $$('.mn .rz-ops-eyebrow').forEach(function (e) { e.hidden = true; });
  }
  function boot() {
    shell(); sidebar(); declutter();
    var tries = 0, t = setInterval(function () {
      tries++;
      if (win.DCAI_CALC && win.RZDatahallAISheets && doc.getElementById('coolSvg')) { mountAll(); if (Object.keys(sheets).length === 4 || tries > 40) clearInterval(t); }
      if (tries > 40) clearInterval(t);
    }, 250);
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot); else boot();
  win.RZDhHmiV2 = { setSide: setSide, sheets: sheets, open: open };
})(typeof window !== 'undefined' ? window : null, typeof document !== 'undefined' ? document : null);
