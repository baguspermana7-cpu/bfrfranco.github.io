/**
 * rz-compare.js — P03 compare: 2 to 4 cases of one calculator, each RECOMPUTED in a hidden iframe of the calculator
 * (js/rz-embed-compute.js, ?embed=compare), shown side by side with deltas from the baseline column.
 *
 * Core (UMD, tested in Node by tools/test-compare-core.mjs):
 *   num(text)                     -> number | NaN   reads "$1.2M", "-$41.4M", "(3.5)", "12,345 kW", "99.741%"
 *   delta(base, value)            -> { abs, pct }   pct null when base is 0 or either side is not a number
 *   tone(abs, better)             -> 'good' | 'bad' | ''   only when the result declares a direction
 *   diffIds(cases)                -> ids whose value differs between any two cases (missing counts as differing)
 *   hashInputs(inputs)            -> stable string hash of an inputs map (key order does not matter)
 *   csv(rows)                     -> RFC 4180 text with a UTF-8 BOM; CRLF; quotes doubled
 *   createTray(storage, calc, now)-> { list, add(name, source, inputs), remove(i), clear, MAX }  sessionStorage rz_compare_<calc>
 *   validCase(c)                  -> null | reason   (shape of a stored case)
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RZCompare = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var MAX = 4;
  var TYPES = ['text', 'number', 'range', 'select', 'checkbox', 'radio', 'textarea', 'date', 'month', 'email', 'search', 'tel', 'url', 'time', 'color'];

  function num(text) {
    var s = String(text == null ? '' : text).replace(/[−–]/g, '-').replace(/,/g, '').trim();
    var m = s.match(/\d+(?:\.\d+)?|\.\d+/);
    if (!m) return NaN;
    var v = parseFloat(m[0]);
    var after = s.slice(m.index + m[0].length).replace(/^\s+/, ''), suf = after.charAt(0);
    if (/^[kK](?![a-zA-Z])/.test(after)) v *= 1e3;
    else if (/^M(?![a-zA-Z])/.test(after)) v *= 1e6;
    else if (/^B(?![a-zA-Z])/.test(after)) v *= 1e9;
    else if (suf === 'T' && /^T(?![a-zA-Z])/.test(after)) v *= 1e12;
    var before = s.slice(0, m.index);
    if (/-\s*[^\d\s]{0,3}\s*$/.test(before) || (/\(\s*[^\d\s]{0,3}\s*$/.test(before) && /^[^\d]{0,4}\)/.test(after))) v = -v;
    return v;
  }

  function delta(base, value) {
    if (typeof base !== 'number' || typeof value !== 'number' || !isFinite(base) || !isFinite(value)) return { abs: null, pct: null };
    var abs = value - base;
    if (Math.abs(abs) < 1e-12 * Math.max(1, Math.abs(base))) abs = 0;
    return { abs: abs, pct: base === 0 ? null : abs / Math.abs(base) * 100 };
  }

  function tone(abs, better) {
    if (abs == null || abs === 0 || (better !== 'lower' && better !== 'higher')) return '';
    return (abs < 0) === (better === 'lower') ? 'good' : 'bad';
  }

  function val(rec) { return rec == null ? undefined : (rec.t === 'checkbox' ? !!rec.v : String(rec.v)); }

  function diffIds(cases) {
    var ids = {}, out = [];
    cases.forEach(function (c) { Object.keys((c && c.inputs) || {}).forEach(function (k) { ids[k] = 1; }); });
    Object.keys(ids).sort().forEach(function (id) {
      var first = val(cases[0].inputs[id]);
      for (var i = 1; i < cases.length; i++) if (val(cases[i].inputs[id]) !== first) { out.push(id); return; }
    });
    return out;
  }

  function hashInputs(inputs) {
    var keys = Object.keys(inputs || {}).sort(), s = '';
    keys.forEach(function (k) { s += k + '\u0001' + inputs[k].t + '\u0001' + val(inputs[k]) + '\u0002'; });
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return ('0000000' + h.toString(16)).slice(-8) + ':' + keys.length;
  }

  function csvCell(v) {
    var s = v == null ? '' : String(v);
    // A cell a spreadsheet would run as a formula is prefixed so it reads as text (CSV injection).
    if (/^[=+\-@\t\r]/.test(s) && !/^-?\d/.test(s)) s = "'" + s;
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function csv(rows) { return '﻿' + rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n') + '\r\n'; }

  function validCase(c) {
    if (!c || typeof c !== 'object') return 'not an object';
    if (typeof c.name !== 'string' || !c.name.trim() || c.name.length > 80) return 'bad name';
    if (['current', 'saved', 'link', 'project'].indexOf(c.source) < 0) return 'bad source';
    if (!c.inputs || typeof c.inputs !== 'object' || Array.isArray(c.inputs)) return 'no inputs';
    var keys = Object.keys(c.inputs);
    if (keys.length > 400) return 'too many inputs';
    for (var i = 0; i < keys.length; i++) {
      var r = c.inputs[keys[i]];
      if (!/^[A-Za-z][\w-]{0,63}$/.test(keys[i])) return 'bad input id';
      if (!r || TYPES.indexOf(r.t) < 0) return 'bad input type';
      if (typeof r.v === 'string' ? r.v.length > 2000 : typeof r.v !== 'boolean') return 'bad input value';
    }
    return null;
  }

  function createTray(storage, calc, now) {
    now = now || function () { return new Date().toISOString(); };
    var key = 'rz_compare_' + calc;
    function read() {
      try {
        var a = JSON.parse(storage.getItem(key) || '[]');
        return Array.isArray(a) ? a.filter(function (c) { return !validCase(c); }).slice(0, MAX) : [];
      } catch (e) { return []; }
    }
    function write(a) { try { storage.setItem(key, JSON.stringify(a)); return true; } catch (e) { return false; } }
    return {
      MAX: MAX,
      list: function () { return read(); },
      add: function (name, source, inputs) {
        var a = read(), c = { name: String(name || '').slice(0, 80), source: source, inputs: inputs, added_at: now() };
        var bad = validCase(c);
        if (bad) return { ok: false, reason: bad, count: a.length };
        var h = hashInputs(inputs);
        for (var i = 0; i < a.length; i++) if (hashInputs(a[i].inputs) === h) return { ok: false, reason: 'duplicate', count: a.length };
        if (a.length >= MAX) return { ok: false, reason: 'full', count: a.length };
        a.push(c);
        return write(a) ? { ok: true, count: a.length } : { ok: false, reason: 'storage', count: a.length - 1 };
      },
      remove: function (i) { var a = read(); a.splice(i, 1); write(a); return a.length; },
      clear: function () { try { storage.removeItem(key); } catch (e) {} }
    };
  }

  return { MAX: MAX, num: num, delta: delta, tone: tone, diffIds: diffIds, hashInputs: hashInputs, csv: csv, validCase: validCase, createTray: createTray };
});

/* ===================== browser: "Add to compare" on a calculator, and the compare page ===================== */
(function (w, d) {
  'use strict';
  if (!w || !d || !w.RZCompare || w.__rzCompareUI) return;
  w.__rzCompareUI = true;
  var C = w.RZCompare;
  var EMBED = /[?&]embed=/.test(w.location.search || '');
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function ss() { try { return w.sessionStorage; } catch (e) { return { getItem: function () { return null; }, setItem: function () { throw new Error('blocked'); }, removeItem: function () {} }; } }
  var ACR = { npv: 'NPV', irr: 'IRR', pue: 'PUE', tco: 'TCO', opex: 'OPEX', capex: 'CAPEX', it: 'IT', rpn: 'RPN', kw: 'kW', co2: 'CO2', cx: 'Cx' };
  function human(key) {
    return String(key).split('_').map(function (p, i) { var a = ACR[p]; return a || (i ? p : p.charAt(0).toUpperCase() + p.slice(1)); }).join(' ');
  }

  /* ---------- calculator page: the Add-to-compare control ---------- */
  function addControl() {
    var calc = d.body.getAttribute('data-rz-calc');
    if (!calc || !w.rzScenario) return;
    var bar = d.querySelector('.tool-bar');
    if (!bar) return;
    var row = d.querySelector('.rz-scn-share-row');
    if (!row) {
      row = d.createElement('div'); row.className = 'rz-scn-share-row';
      row.style.cssText = 'display:flex;justify-content:flex-end;margin:6px 0 0';
      bar.parentNode.insertBefore(row, bar.nextSibling);
    }
    row.style.flexWrap = 'wrap'; row.style.gap = '6px'; row.style.alignItems = 'center';
    var msg = d.createElement('span'); msg.className = 'rz-cmp-msg'; msg.setAttribute('role', 'status'); msg.setAttribute('aria-live', 'polite');
    msg.style.cssText = 'font-size:.8125rem;color:var(--rz-text-secondary,inherit);margin-right:auto';
    var b = d.createElement('button'); b.type = 'button'; b.className = 'tool-btn'; b.id = 'btnAddCompare';
    b.title = 'Keep these inputs as a case to compare with others (up to 4, this tab)';
    b.textContent = 'Add to compare';
    row.insertBefore(msg, row.firstChild); row.appendChild(b);
    var tray = C.createTray(ss(), calc);
    function say(n, extra) {
      msg.innerHTML = (extra ? esc(extra) + ' ' : '') + n + ' of ' + C.MAX + ' cases in compare' + (n ? ' · <a href="compare.html?calc=' + esc(calc) + '">Open compare</a>' : '');
    }
    if (tray.list().length) say(tray.list().length);
    b.addEventListener('click', function () {
      var n = tray.list().length;
      var r = tray.add('Case ' + (n + 1), 'current', w.rzScenario.capture());
      if (r.ok) say(r.count, 'Added.');
      else say(r.count, r.reason === 'full' ? 'Compare holds 4 cases.' : r.reason === 'duplicate' ? 'These inputs are already in compare.' : r.reason === 'storage' ? 'This browser blocks session storage.' : 'Not added.');
    });
  }

  /* ---------- compare page ---------- */
  function labelFor(doc, el) {
    // The visible label first; aria-label only when the page shows none (several pages carry a generated one).
    var l = el.id && doc.querySelector('label[for="' + el.id + '"]');
    if (!l) l = el.closest('label');
    for (var n = el, k = 0; !l && n && k < 3; n = n.parentElement, k++) {
      for (var s = n.previousElementSibling; s && !l; s = s.previousElementSibling) {
        if (s.matches('label, .input-label')) l = s;
        else if (!s.querySelector('input,select,textarea')) l = s.querySelector('label, .input-label');
      }
    }
    if (!l) return el.getAttribute('aria-label') || el.id;
    var c = l.cloneNode(true);
    [].forEach.call(c.querySelectorAll('button, .rz-proj-tag, [aria-hidden="true"], input, select'), function (x) { x.remove(); });
    return (c.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80) || el.id;
  }
  function probeInputs(ids) {
    return function (doc) {
      var out = {};
      ids.forEach(function (id) {
        var el = doc.getElementById(id);
        if (!el) return;
        var shown = el.tagName === 'SELECT' ? ((el.options[el.selectedIndex] || {}).text || el.value)
          : el.type === 'checkbox' ? (el.checked ? 'on' : 'off') : el.value;
        out[id] = { label: labelFor(doc, el), shown: String(shown).replace(/\s+/g, ' ').trim().slice(0, 60) };
      });
      out.__version = (doc.defaultView && doc.defaultView.RZ_VERSION) || '';
      return out;
    };
  }

  function page() {
    var root = d.getElementById('cmpRoot'), status = d.getElementById('cmpStatus');
    var q = new URLSearchParams(w.location.search), calc = q.get('calc') || '';
    var reg, entry, cases = [], showAll = false, running = false;
    function setStatus(t, err) { status.textContent = t; status.setAttribute('data-tone', err ? 'fault' : ''); }
    if (!/^[a-z0-9-]{1,40}$/.test(calc)) { setStatus('No calculator named. Open compare from a calculator or from your account.', true); return; }
    fetch('data/calculators.json', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (j) {
      reg = j.calculators || [];
      entry = reg.filter(function (e) { return e.calc === calc; })[0];
      if (!entry) { setStatus('Unknown calculator "' + calc + '".', true); return; }
      d.getElementById('cmpCalcName').textContent = entry.title;
      d.title = 'Compare · ' + entry.title + ' | ResistanceZero';
      if (entry.noCompare) { setStatus(entry.title + ' cannot be compared: ' + entry.noCompare + '.', true); return; }
      return loadCases().then(function (list) {
        cases = list.map(function (c) { return { name: c.name, source: c.source, inputs: c.inputs, state: 'pending', values: {}, probe: {} }; });
        if (cases.length < 2) { render(); setStatus(''); return; }
        compute();
      });
    }).catch(function (e) { setStatus('The calculator list could not be loaded.', true); if (w.console) console.warn(e); });

    function loadCases() {
      var links = q.get('links'), ids = q.get('ids'), notes = [];
      if (links) {
        var out = [];
        links.split(',').slice(0, C.MAX).forEach(function (b64, i) {
          var r = w.rzScenario.readLink(w.rzScenario.LINK.prefix + b64, calc);
          if (r.ok) out.push({ name: 'Link ' + (i + 1), source: 'link', inputs: r.map });
          else notes.push('Link ' + (i + 1) + ' was not used: ' + r.reason + '.');
        });
        if (notes.length) d.getElementById('cmpNotes').textContent = notes.join(' ');
        return Promise.resolve(out);
      }
      if (ids) {
        var want = ids.split(',').slice(0, C.MAX);
        return (w.rzSupa ? w.rzSupa.ready : Promise.reject(new Error('no account module'))).then(function (S) {
          return S.getUser().then(function (u) {
            if (!u) { d.getElementById('cmpNotes').textContent = 'Sign in on your account page to compare saved scenarios.'; return []; }
            return S.listScenarios(calc).then(function (res) {
              var rows = (res && res.data) || [];
              return want.map(function (id) { return rows.filter(function (r) { return r.id === id; })[0]; }).filter(Boolean)
                .map(function (r) { return { name: String(r.name || 'Saved scenario').slice(0, 80), source: 'saved', inputs: (r.payload && r.payload.inputs) || {} }; })
                .filter(function (c) { return !C.validCase(c); });
            });
          });
        }).catch(function () { d.getElementById('cmpNotes').textContent = 'Saved scenarios could not be loaded.'; return []; });
      }
      return Promise.resolve(C.createTray(ss(), calc).list());
    }

    function compute() {
      running = true;
      var ids = {};
      cases.forEach(function (c) { Object.keys(c.inputs).forEach(function (k) { ids[k] = 1; }); });
      var read = (entry.results || []).map(function (r) { return r.selector; });
      var seq = Promise.resolve();
      cases.forEach(function (c, i) {
        seq = seq.then(function () {
          setStatus('Computing case ' + (i + 1) + ' of ' + cases.length + '…');
          return w.RZEmbedCompute.run({ page: entry.page, mode: 'compare', inputs: c.inputs, read: read, settleMs: entry.settleMs || 900,
            timeoutMs: 15000, probe: probeInputs(Object.keys(ids)) }).then(function (r) {
            c.state = r.ok ? 'ok' : 'fail'; c.error = r.error; c.values = r.values || {}; c.probe = r.probe || {};
            render();
          });
        });
      });
      seq.then(function () {
        running = false;
        var bad = cases.filter(function (c) { return c.state === 'fail'; }).length;
        var v = (cases.filter(function (c) { return c.probe.__version; })[0] || { probe: {} }).probe.__version;
        setStatus(bad ? bad + ' of ' + cases.length + ' cases could not be computed.' : 'All ' + cases.length + ' cases computed by the calculator’s current code' + (v ? ' (site ' + v + ')' : '') + '.', !!bad);
        d.getElementById('cmpCsv').disabled = false;
        render();
      });
    }

    function resultRows() {
      return (entry.results || []).map(function (r) {
        var base = cases[0], bv = base && base.values[r.selector];
        return { r: r, label: r.label || human(r.key), unit: r.unit, cells: cases.map(function (c, i) {
          var t = c.values[r.selector], n = C.num(t);
          var dl = i && c.state === 'ok' && base.state === 'ok' ? C.delta(C.num(bv), n) : null;
          return { text: c.state === 'ok' ? (t == null ? '—' : t) : '', num: n, delta: dl, changed: i && t !== bv };
        }) };
      });
    }
    function inputRows() {
      var ids = showAll ? Object.keys(cases.reduce(function (o, c) { Object.keys(c.inputs).forEach(function (k) { o[k] = 1; }); return o; }, {})).sort() : C.diffIds(cases);
      return ids.map(function (id) {
        var lab = (cases.map(function (c) { return c.probe[id] && c.probe[id].label; }).filter(Boolean)[0]) || id;
        var first = cases[0].inputs[id];
        return { id: id, label: lab, cells: cases.map(function (c) {
          var rec = c.inputs[id], p = c.probe[id];
          var text = p ? p.shown : rec ? (rec.t === 'checkbox' ? (rec.v ? 'on' : 'off') : rec.v) : '—';
          return { text: text, changed: JSON.stringify(rec) !== JSON.stringify(first) };
        }) };
      });
    }
    function fmtDelta(dl, unit) {
      if (!dl || dl.abs == null) return '';
      if (dl.abs === 0) return '0';
      var a = Math.abs(dl.abs), s = dl.abs > 0 ? '+' : '−';
      var t = a >= 1e9 ? (a / 1e9).toFixed(2) + 'B' : a >= 1e6 ? (a / 1e6).toFixed(2) + 'M' : a >= 1e3 ? (a / 1e3).toFixed(1) + 'K' : String(parseFloat(a.toPrecision(4)));
      return s + t + (dl.pct == null ? '' : ' · ' + s + Math.abs(dl.pct).toFixed(1) + ' %');
    }

    function render() {
      var tbl = d.getElementById('cmpTable'), empty = d.getElementById('cmpEmpty');
      empty.hidden = cases.length >= 2;
      d.getElementById('cmpTools').hidden = cases.length < 2;
      d.getElementById('cmpClear').hidden = !!(q.get('links') || q.get('ids'));  // only the tray can be cleared
      if (cases.length < 2) { tbl.innerHTML = ''; return; }
      var h = '<caption class="rz-cmp-cap">' + esc(entry.title) + ': ' + cases.length + ' cases. The first column is the baseline; differences are measured from it.</caption><thead><tr><th scope="col" class="rz-cmp-corner">Case</th>';
      cases.forEach(function (c, i) {
        h += '<th scope="col" class="rz-cmp-case' + (i ? '' : ' rz-cmp-base') + '"><span class="rz-cmp-name">' + esc(c.name) + '</span>'
          + '<span class="rz-cmp-src">' + esc(i ? c.source : c.source + ' · baseline') + '</span><span class="rz-cmp-acts">'
          + (i ? '<button type="button" data-act="base" data-i="' + i + '">Set as baseline</button>' : '')
          + '<button type="button" data-act="open" data-i="' + i + '">Open</button>'
          + (cases.length > 2 && !running ? '<button type="button" data-act="remove" data-i="' + i + '">Remove</button>' : '') + '</span></th>';
      });
      h += '</tr></thead><tbody>';
      var ins = inputRows();
      h += '<tr class="rz-cmp-group"><th scope="rowgroup" colspan="' + (cases.length + 1) + '">Inputs' + (showAll ? '' : ' that differ') + ' (' + ins.length + ')</th></tr>';
      if (!ins.length) h += '<tr><td colspan="' + (cases.length + 1) + '" class="rz-cmp-note">' + (showAll ? 'No inputs.' : 'The cases have identical inputs. Change an input in one of them to see what it moves.') + '</td></tr>';
      ins.forEach(function (row) {
        h += '<tr><th scope="row">' + esc(row.label) + '</th>' + row.cells.map(function (c, i) { return '<td' + (i && c.changed ? ' data-changed="1"' : '') + '>' + esc(c.text) + '</td>'; }).join('') + '</tr>';
      });
      h += '<tr class="rz-cmp-group"><th scope="rowgroup" colspan="' + (cases.length + 1) + '">Results</th></tr>';
      resultRows().forEach(function (row) {
        h += '<tr><th scope="row">' + esc(row.label) + (row.unit ? ' <span class="rz-cmp-unit">' + esc(row.unit) + '</span>' : '') + '</th>';
        row.cells.forEach(function (c, i) {
          var cs = cases[i];
          if (cs.state === 'pending') { h += '<td><span class="rz-cmp-skel" aria-label="computing"></span></td>'; return; }
          if (cs.state === 'fail') { h += '<td class="rz-cmp-fail">Could not compute this case</td>'; return; }
          var dt = i ? (c.delta && c.delta.abs != null ? fmtDelta(c.delta, row.unit) : c.changed ? 'changed' : '0') : '';
          h += '<td data-key="' + esc(row.r.key) + '"><span class="rz-cmp-v">' + esc(c.text) + '</span>'
            + (i ? '<span class="rz-cmp-d" data-tone="' + C.tone(c.delta && c.delta.abs, row.r.better) + '">' + esc(dt) + '</span>' : '') + '</td>';
        });
        h += '</tr>';
      });
      tbl.innerHTML = h + '</tbody>';
    }

    d.getElementById('cmpTable').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-act]'); if (!b) return;
      var i = +b.getAttribute('data-i'), act = b.getAttribute('data-act'), c = cases[i];
      if (act === 'open') { w.rzScenario.openInCalc(calc, c.inputs); return; }
      if (act === 'base') { cases.splice(i, 1); cases.unshift(c); }
      if (act === 'remove') { cases.splice(i, 1); if (!q.get('links') && !q.get('ids')) { var t = C.createTray(ss(), calc); t.clear(); cases.forEach(function (x) { if (x.source === 'current') t.add(x.name, x.source, x.inputs); }); } }
      render();
      var again = d.querySelector('#cmpTable button[data-act="' + act + '"][data-i="' + Math.min(i, cases.length - 1) + '"]') || d.querySelector('#cmpTable button');
      if (again) again.focus();
    });
    d.getElementById('cmpAll').addEventListener('change', function (e) { showAll = e.target.checked; render(); });
    d.getElementById('cmpCsv').addEventListener('click', function () {
      var rows = [['Section', 'Item', 'Unit'].concat(cases.map(function (c, i) { return c.name + (i ? '' : ' (baseline)'); })).concat(cases.slice(1).map(function (c) { return 'Difference: ' + c.name; }))];
      inputRows().forEach(function (r) { rows.push(['Input', r.label, ''].concat(r.cells.map(function (c) { return c.text; })).concat(cases.slice(1).map(function () { return ''; }))); });
      resultRows().forEach(function (r) {
        rows.push(['Result', r.label, r.unit || ''].concat(r.cells.map(function (c) { return c.text; })).concat(r.cells.slice(1).map(function (c) { return c.delta && c.delta.abs != null ? c.delta.abs : ''; })));
      });
      var a = d.createElement('a');
      a.href = URL.createObjectURL(new Blob([C.csv(rows)], { type: 'text/csv;charset=utf-8' }));
      a.download = 'compare-' + calc + '.csv';
      d.body.appendChild(a); a.click(); a.remove();
    });
    d.getElementById('cmpClear').addEventListener('click', function () { C.createTray(ss(), calc).clear(); cases = []; render(); setStatus('Compare cleared.'); });
  }

  function start() {
    if (d.getElementById('cmpRoot')) { page(); return; }
    var framed = false; try { framed = w.top !== w; } catch (e) { framed = true; }
    // After rz-scenario's own DOMContentLoaded work (it listens on window, which fires after document), so the
    // Copy link row exists and both controls share it.
    if (!EMBED && !framed && d.body.hasAttribute('data-rz-calc')) setTimeout(addControl, 0);
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start); else start();
})(typeof window !== 'undefined' ? window : null, typeof document !== 'undefined' ? document : null);
