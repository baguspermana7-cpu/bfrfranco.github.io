/* ============================================================================
 * replay-ui.js — PRD-P05 stage 1: the replay controls on datahallAI.html
 * ----------------------------------------------------------------------------
 * Lazy-loaded by the header "Replay" button. File → Worker parse → mapping
 * dialog (#replayDialog, a DHModal panel) → replay bar (#rzReplayBar) with a
 * scrubber. While replaying, RZDatahallAISimTelemetry answers every simulated
 * reading from the file (mapped) or "—" (unmapped): nothing is simulated
 * silently. Engine-derived values never pass through the seam (Rule 2).
 * Untrusted file: every string goes through textContent, nothing is uploaded.
 * ==========================================================================*/
(function (win, doc) {
  'use strict';
  var Core = win.RZDatahallAIReplay, Sim = win.RZDatahallAISimTelemetry;
  var STORE = 'rz_replay_maps', KEEP = 20, ROWS = 200, SPEEDS = [1, 10, 60];
  var st = { phase: 'simulated', name: null, parsed: null, mapping: {}, catalogue: [], byLabel: {}, times: [], idx: 0, speed: 1, timer: null, sig: null, prevLabel: null };

  function $(id) { return doc.getElementById(id); }
  function el(tag, attrs, text) {
    var e = doc.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (text != null) { e.textContent = String(text); }
    return e;
  }
  function clear(node) { while (node && node.firstChild) { node.removeChild(node.firstChild); } }
  function say(msg, tone) { var s = $('replayStatus'); if (s) { s.textContent = msg || ''; s.setAttribute('data-tone', tone || 'info'); } }
  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function stamp(ms, withDate) {
    var d = new Date(ms);
    var t = pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
    return withDate ? d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + t : t;
  }

  /* ---- the cockpit points a column can feed ------------------------------- */
  function hallNow() {
    var b = doc.querySelector('.dh-btn.active[data-dh]');
    var v = b ? String(b.getAttribute('data-dh')).replace(/^dh0?/i, '') : '1';
    return /^\d$/.test(v) ? Number(v) : 1;
  }
  function catalogue() {
    var C = win.RZDatahallAIEquipmentInspector, PL = win.RZDatahallAIHmiPayloads, out = [], seen = {};
    /* the lazy tabs hold most equipment blocks: paint them once so every block can be offered */
    var D = win.RZDefer; if (D && D.pending) { D.pending().forEach(function (id) { D.ensure(id); }); }
    var hall = hallNow(), ctx = C && C.context ? C.context({ hall: hall }) : null;
    if (ctx && PL) {
      var refs = {};
      Array.prototype.forEach.call(doc.querySelectorAll('[data-rz-equipment]'), function (n) { refs[n.getAttribute('data-rz-equipment')] = 1; });
      Object.keys(refs).sort().forEach(function (ref) {
        var i = ref.indexOf(':'); if (i < 0) { return; }
        var P = PL.safePayload(ref.slice(0, i), ref.slice(i + 1), ctx);
        if (!P || P.unavailable || !P.tabs) { return; }
        var title = String(P.title || ref).split(' — ')[0];
        Object.keys(P.tabs).forEach(function (t) {
          if (!Array.isArray(P.tabs[t])) { return; }
          P.tabs[t].forEach(function (r) {
            if (r.quality !== 'simulated' && r.quality !== 'replay') { return; }
            var key = P.classId + ':' + P.id + ':' + P.hall + '|' + r.point;
            if (seen[key]) { return; }
            seen[key] = 1;
            out.push({ key: key, label: title + ' ' + r.label, unit: r.unit || '' });
          });
        });
      });
    }
    /* drawing readings printed through RZ_SIM('<site>', …) */
    var src = Array.prototype.map.call(doc.querySelectorAll('script:not([src])'), function (s) { return s.textContent; }).join('\n');
    var re = /RZ_SIM\('([A-Za-z0-9_-]+)'\s*,/g, m;
    while ((m = re.exec(src))) {
      var k = 'page|' + m[1];
      if (!seen[k]) { seen[k] = 1; out.push({ key: k, label: 'Drawing reading ' + m[1], unit: '' }); }
    }
    return out;
  }

  /* ---- mapping persistence (signature = sha256 of header + first time) --- */
  function readStore() { try { var o = JSON.parse(win.localStorage.getItem(STORE) || '{}'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } }
  function writeStore(sig, mapping) {
    try {
      var o = readStore(); delete o[sig];
      o[sig] = { at: new Date().toISOString(), map: mapping };
      var keys = Object.keys(o).sort(function (a, b) { return String(o[a].at).localeCompare(String(o[b].at)); });
      while (keys.length > KEEP) { delete o[keys.shift()]; }
      win.localStorage.setItem(STORE, JSON.stringify(o));
    } catch (e) { /* storage blocked: the mapping still works for this session */ }
  }
  function signature(text) {
    var bytes = new TextEncoder().encode(text);
    if (win.crypto && win.crypto.subtle && win.crypto.subtle.digest) {
      return win.crypto.subtle.digest('SHA-256', bytes).then(function (buf) {
        return Array.prototype.map.call(new Uint8Array(buf), function (b) { return (b < 16 ? '0' : '') + b.toString(16); }).join('');
      });
    }
    return Promise.resolve('fnv-' + Sim.seed(text).toString(16));
  }

  /* ---- step 1: the file -------------------------------------------------- */
  function onFile(file) {
    var chk = Core.check({ size: file.size, name: file.name });
    if (!chk.ok) { say(chk.message, 'error'); return; }
    st.phase = 'parsing'; st.name = file.name;
    say('Reading ' + file.name + ' … 0 %', 'info');
    var reader = new FileReader();
    reader.onerror = function () { st.phase = 'simulated'; say('The browser could not read the file.', 'error'); };
    reader.onload = function () { parseText(String(reader.result), file.name, null); };
    reader.readAsText(file);
  }
  function parseText(text, name, timeColumn) {
    var done = function (m) {
      if (m.type === 'progress') { say('Parsing ' + name + ' … ' + m.pct + ' %', 'info'); return; }
      if (m.type === 'error') {
        st.phase = 'simulated';
        if (m.code === 'NO_TIME') { askTimeColumn(text, name, m.candidates || []); return; }
        say(m.message, 'error'); return;
      }
      if (m.type === 'parsed') { st.text = null; onParsed(m.result, text); }
    };
    var w = null;
    try { w = new win.Worker($('rzReplayTrig').getAttribute('data-worker')); } catch (e) { w = null; }
    if (w) {
      w.onmessage = function (e) { done(e.data); if (e.data.type !== 'progress') { w.terminate(); } };
      w.onerror = function () { w.terminate(); done({ type: 'error', line: 0, message: 'The parse worker failed to start.' }); };
      w.postMessage({ type: 'parse', text: text, name: name, timeColumn: timeColumn });
    } else {
      var r = Core.parse(text, { name: name, timeColumn: timeColumn });
      done(r.ok ? { type: 'parsed', result: r } : { type: 'error', line: r.line, message: r.message, code: r.code, candidates: r.candidates });
    }
  }
  function askTimeColumn(text, name, candidates) {
    var box = $('replayMapBody'); clear(box);
    say('No timestamp column found. Pick the column that holds the time.', 'warn');
    var row = el('div', { class: 'rz-ops-field' });
    row.appendChild(el('label', { for: 'replayTimeCol' }, 'Time column'));
    var sel = el('select', { id: 'replayTimeCol' });
    candidates.forEach(function (c) { sel.appendChild(el('option', { value: c }, c)); });
    row.appendChild(sel);
    var go = el('button', { type: 'button', class: 'rz-ops-button', id: 'replayTimeGo' }, 'Use this column');
    go.addEventListener('click', function () { parseText(text, name, sel.value); });
    box.appendChild(row); box.appendChild(go);
  }

  /* ---- step 2: mapping ---------------------------------------------------- */
  function onParsed(r, text) {
    st.parsed = r; st.phase = 'mapping';
    st.catalogue = catalogue(); st.byLabel = {};
    st.catalogue.forEach(function (p) { st.byLabel[p.label] = p.key; });
    var auto = Core.autoMatch(r.columns, st.catalogue);
    st.mapping = auto.mapping;
    var firstTime = r.start == null ? '' : String(r.start);
    signature(String(r.header) + '|' + firstTime).then(function (sig) {
      st.sig = sig;
      var saved = readStore()[sig];
      if (saved && saved.map) {
        Object.keys(saved.map).forEach(function (c) {
          var m = saved.map[c];
          if (r.columns.indexOf(c) >= 0 && m && st.catalogue.some(function (p) { return p.key === m.point; })) { st.mapping[c] = { point: m.point, factor: Number(m.factor) || 1 }; }
        });
      }
      renderMapping('');
      var span = r.start == null ? 'no samples' : stamp(r.start, true) + '–' + stamp(r.end, false) + (r.zoned ? '' : ' (local time)');
      say(r.name ? '' : ((st.name || '') + ' · ' + r.columns.length + ' columns · ' + span + ' · ' + auto.unmatched.length + ' unmatched'), 'info');
    });
  }
  function labelOf(key) { for (var i = 0; i < st.catalogue.length; i++) { if (st.catalogue[i].key === key) { return st.catalogue[i].label; } } return ''; }
  function mappedCount() { return Object.keys(st.mapping).filter(function (c) { return st.mapping[c] && st.mapping[c].point; }).length; }
  function syncStart() {
    var n = mappedCount(), b = $('replayStart'), why = $('replayStartWhy');
    if (b) { b.disabled = n === 0; }
    if (why) { why.textContent = n === 0 ? 'Map at least one point.' : n + ' mapped · ' + Math.max(0, st.catalogue.length - n) + ' cockpit points will show —'; }
  }
  function renderMapping(q) {
    var body = $('replayMapBody'); clear(body);
    var r = st.parsed, query = Core.normalise(q || '');
    var dl = $('replayPoints');
    if (dl && !dl.childNodes.length) { st.catalogue.forEach(function (p) { dl.appendChild(el('option', { value: p.label })); }); }
    var cols = r.columns.filter(function (c) { return !query || Core.normalise(c).indexOf(query) >= 0 || Core.normalise(labelOf((st.mapping[c] || {}).point)).indexOf(query) >= 0; });
    var tbl = el('table', { class: 'rz-ops-table replay-map', id: 'replayMapTable' });
    var hr = el('tr');
    ['File column', 'Cockpit point', 'Factor', 'Sample'].forEach(function (h) { hr.appendChild(el('th', { scope: 'col' }, h)); });
    var th = el('thead'); th.appendChild(hr); tbl.appendChild(th);
    var tb = el('tbody');
    cols.slice(0, ROWS).forEach(function (c, i) {
      var m = st.mapping[c] || {}, tr = el('tr', { 'data-col': c });
      tr.appendChild(el('td', {}, c));
      var td = el('td'), inp = el('input', { type: 'text', list: 'replayPoints', 'aria-label': 'Cockpit point for ' + c, class: 'replay-point', id: 'replayPt' + i });
      inp.value = labelOf(m.point);
      inp.addEventListener('change', function () {
        var key = st.byLabel[inp.value];
        if (key) { st.mapping[c] = { point: key, factor: (st.mapping[c] || {}).factor || 1 }; inp.removeAttribute('aria-invalid'); }
        else { delete st.mapping[c]; if (inp.value) { inp.setAttribute('aria-invalid', 'true'); } }
        syncStart();
      });
      td.appendChild(inp); tr.appendChild(td);
      var tf = el('td'), f = el('input', { type: 'number', step: 'any', 'aria-label': 'Unit factor for ' + c, class: 'replay-factor' });
      f.value = String(m.factor || 1);
      f.addEventListener('change', function () { var v = Number(f.value); if (st.mapping[c] && isFinite(v) && v !== 0) { st.mapping[c].factor = v; } });
      tf.appendChild(f); tr.appendChild(tf);
      var s = r.series[c];
      tr.appendChild(el('td', { class: 'num' }, s && s.values.length ? String(s.values[0]) : '—'));
      tb.appendChild(tr);
    });
    tbl.appendChild(tb); body.appendChild(tbl);
    if (cols.length > ROWS) { body.appendChild(el('p', { class: 'replay-more' }, (cols.length - ROWS) + ' more columns — narrow with the search.')); }
    syncStart();
  }

  /* ---- step 3: replay ---------------------------------------------------- */
  function unionTimes() {
    var set = {}, out = [];
    Object.keys(st.mapping).forEach(function (c) {
      var s = st.parsed.series[c]; if (!s) { return; }
      for (var i = 0; i < s.times.length; i++) { set[s.times[i]] = 1; }
    });
    Object.keys(set).forEach(function (k) { out.push(Number(k)); });
    return out.sort(function (a, b) { return a - b; });
  }
  function cursor() { return st.times.length ? st.times[st.idx] : null; }
  function paint() {
    var t = cursor(), r = $('replayScrub'), lab = $('replayTime');
    if (r) { r.value = String(st.idx); r.setAttribute('aria-valuetext', t == null ? 'no samples' : stamp(t, true)); }
    if (lab) { lab.textContent = t == null ? '—' : stamp(t, true); }
    var C = win.RZDatahallAIEquipmentInspector; if (C && C.refresh) { C.refresh(); }
    try { doc.dispatchEvent(new win.CustomEvent('rz-replay-cursor', { detail: { t: t } })); } catch (e) { /* old browser */ }
  }
  function seek(i) { st.idx = Math.max(0, Math.min(st.times.length - 1, i)); paint(); }
  function stop() { if (st.timer) { win.clearInterval(st.timer); st.timer = null; } var p = $('replayPlay'); if (p) { p.textContent = 'Play'; p.setAttribute('aria-pressed', 'false'); } }
  function play() {
    if (st.timer) { stop(); return; }
    var p = $('replayPlay'); if (p) { p.textContent = 'Pause'; p.setAttribute('aria-pressed', 'true'); }
    var file = cursor();
    st.timer = win.setInterval(function () {
      file += st.speed * 1000;
      while (st.idx < st.times.length - 1 && st.times[st.idx + 1] <= file) { st.idx++; }
      paint();
      if (st.idx >= st.times.length - 1) { stop(); }
    }, 1000);
  }
  function start() {
    if (!mappedCount()) { return; }
    var mapping = {};
    Object.keys(st.mapping).forEach(function (c) { if (st.mapping[c].point) { mapping[c] = { point: st.mapping[c].point, factor: st.mapping[c].factor || 1 }; } });
    if (st.sig) { writeStore(st.sig, mapping); }
    st.times = unionTimes(); st.idx = 0;
    Sim.setProvider(Core.makeProvider({ series: st.parsed.series, mapping: mapping, known: st.catalogue.map(function (p) { return p.key; }), strict: true, cursor: cursor }), { source: st.name });
    st.phase = 'replay';
    var slot = doc.querySelector('[data-rz-telemetry-banner-slot]');
    if (slot) {
      if (st.prevLabel == null) { st.prevLabel = slot.getAttribute('data-rz-telemetry-label') || ''; }
      var r = st.parsed;
      slot.setAttribute('data-rz-telemetry-label', 'REPLAY · ' + st.name + (r.start == null ? '' : ' · ' + stamp(r.start, true) + '–' + stamp(r.end, false)));
    }
    modeLabels(true);
    doc.body.setAttribute('data-rz-data-mode', 'replay');
    var bar = $('rzReplayBar'), sc = $('replayScrub');
    if (sc) { sc.max = String(Math.max(0, st.times.length - 1)); sc.value = '0'; }
    $('replayFileName').textContent = st.name + (st.parsed.zoned ? '' : ' · local time');
    if (bar) { bar.hidden = false; }
    var dlg = $('replayDialog'); if (dlg) { dlg.classList.remove('show'); }
    paint();
    if (sc) { sc.focus(); }
  }
  /* FR-P05-5: every in-page mode label ([data-rz-mode-label]) says REPLAY while a file is shown */
  function modeLabels(on) {
    Array.prototype.forEach.call(doc.querySelectorAll('[data-rz-mode-label]'), function (n) {
      if (!n.hasAttribute('data-rz-mode-sim')) { n.setAttribute('data-rz-mode-sim', n.textContent); }
      n.textContent = on ? (n.getAttribute('data-rz-mode-replay') || 'Replay') : n.getAttribute('data-rz-mode-sim');
    });
  }
  function exit() {
    stop();
    Sim.setProvider(null);
    st.phase = 'simulated'; st.times = []; st.idx = 0;
    var slot = doc.querySelector('[data-rz-telemetry-banner-slot]');
    if (slot && st.prevLabel != null) { slot.setAttribute('data-rz-telemetry-label', st.prevLabel); }
    modeLabels(false);
    doc.body.setAttribute('data-rz-data-mode', 'simulated');
    var bar = $('rzReplayBar'); if (bar) { bar.hidden = true; }
    var C = win.RZDatahallAIEquipmentInspector; if (C && C.refresh) { C.refresh(); }
    var trig = $('rzReplayTrig'); if (trig) { trig.focus(); }
  }

  /* ---- wiring ------------------------------------------------------------ */
  function openDialog() {
    if (st.phase === 'replay') { exit(); }
    var dlg = $('replayDialog'); if (!dlg) { return; }
    clear($('replayMapBody')); say('', 'info'); syncStart();
    var f = $('replayFile'); if (f) { f.value = ''; }
    dlg.classList.add('show');
  }
  function init() {
    $('replayFile').addEventListener('change', function (e) { var f = e.target.files && e.target.files[0]; if (f) { onFile(f); } });
    $('replaySearch').addEventListener('input', function (e) { if (st.parsed) { renderMapping(e.target.value); } });
    $('replayStart').addEventListener('click', start);
    $('replayCancel').addEventListener('click', function () { $('replayDialog').classList.remove('show'); st.phase = 'simulated'; });
    $('replayDialog').querySelector('.fire-iso-close').addEventListener('click', function () { $('replayDialog').classList.remove('show'); st.phase = 'simulated'; });
    $('replayPlay').addEventListener('click', play);
    $('replayExit').addEventListener('click', exit);
    $('replaySpeed').addEventListener('change', function (e) { var v = Number(e.target.value); st.speed = SPEEDS.indexOf(v) >= 0 ? v : 1; });
    var sc = $('replayScrub');
    sc.addEventListener('input', function () { seek(Number(sc.value)); });
    sc.addEventListener('keydown', function (e) {
      if (e.key === 'PageUp' || e.key === 'PageDown') { e.preventDefault(); seek(st.idx + (e.key === 'PageUp' ? 10 : -10)); }
    });
  }

  init();
  win.RZDatahallAIReplayUI = Object.freeze({
    open: openDialog, exit: exit, start: start, seek: seek, parseText: parseText,
    state: function () { return { phase: st.phase, name: st.name, idx: st.idx, samples: st.times.length, cursor: cursor(), mapped: mappedCount(), catalogue: st.catalogue.length }; }
  });
})(window, document);
