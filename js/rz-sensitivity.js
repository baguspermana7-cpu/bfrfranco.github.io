/**
 * rz-sensitivity.js — "What drives this result" (P07). Moves each declared input of a calculator and recomputes the
 * page itself in a hidden iframe (RZEmbedCompute.session), so a bar can never disagree with the page's own model.
 *
 *   rzSensitivity.run(spec, { delta, onProgress, isCancelled, inputs }) -> Promise<{ base, rows, cancelled, error }>
 *     spec    the calculator's `sensitivity` entry from data/calculators.json plus { calc, page }
 *     rows    [{ id, label, kind, low, high, lowInput, highInput, lowValue, highValue, clamped, failed, reason, swing }],
 *             sorted by swing,
 *             ties in declaration order; a zero swing is kept ("no effect at this point")
 *   rzSensitivity.mount(spec)  renders the collapsed <details> panel right after spec.anchor and wires its button.
 *
 * Factor kinds: continuous (base x (1 +/- delta), clamped to min/max, snapped to step on range inputs);
 * step (the adjacent enabled <option> on each side); unmet (every unchecked box matching spec.unmet.selector is
 * ticked, one at a time: "which unmet items move the score most").
 */
(function (w, d) {
  'use strict';
  if (w.rzSensitivity) return;

  function num(text) {
    if (text == null) return NaN;
    var s = String(text).replace(/,/g, '').replace(/−/g, '-');
    var m = s.match(/\d+(?:\.\d+)?/);
    if (!m) return NaN;
    var v = parseFloat(m[0]);
    // a sign may sit before a currency symbol ("-$41.4M") or as accounting parentheses ("($41.4M)")
    if (/[-(]\s*[^\d\s]{0,3}\s*$/.test(s.slice(0, m.index))) v = -v;
    var suf = s.slice(m.index + m[0].length).trim().charAt(0);
    if (suf === 'K' || suf === 'k') v *= 1e3; else if (suf === 'M') v *= 1e6; else if (suf === 'B') v *= 1e9;
    return v;
  }
  function decimals(x) { var s = String(x); var i = s.indexOf('.'); return i < 0 ? 0 : s.length - i - 1; }

  function continuousValues(el, delta) {
    var base = parseFloat(el.value);
    if (!isFinite(base)) return null;
    var min = el.min !== '' ? parseFloat(el.min) : -Infinity, max = el.max !== '' ? parseFloat(el.max) : Infinity;
    var step = parseFloat(el.step);
    var dp = Math.max(decimals(el.value), isFinite(step) ? decimals(el.step) : 0, 2);
    function one(x) {
      var clamped = false;
      if (x < min) { x = min; clamped = true; }
      if (x > max) { x = max; clamped = true; }
      if (el.type === 'range' && isFinite(step) && step > 0) {
        var o = isFinite(min) ? min : 0;
        x = o + Math.round((x - o) / step) * step;
      }
      return { v: String(parseFloat(x.toFixed(dp))), clamped: clamped };
    }
    return { base: el.value, lo: one(base * (1 - delta)), hi: one(base * (1 + delta)) };
  }

  function stepValues(el) {
    var opts = [].slice.call(el.options).filter(function (o) { return !o.disabled; });
    var i = opts.map(function (o) { return o.value; }).indexOf(el.value);
    if (opts.length < 2 || i < 0) return null;
    return {
      base: el.value,
      lo: { v: (opts[i - 1] || opts[i]).value, text: (opts[i - 1] || opts[i]).textContent.trim(), clamped: !opts[i - 1] },
      hi: { v: (opts[i + 1] || opts[i]).value, text: (opts[i + 1] || opts[i]).textContent.trim(), clamped: !opts[i + 1] },
    };
  }

  function labelFor(el, fallback) {
    if (fallback) return fallback;
    var l = el.id && d.querySelector('label[for="' + el.id + '"]');
    return ((l && l.textContent) || el.getAttribute('aria-label') || el.id).replace(/\s+/g, ' ').trim();
  }

  /* the factor list, resolved against the parent page as it stands now */
  function factorsOf(spec) {
    var out = [];
    (spec.factors || []).forEach(function (f) {
      var el = d.getElementById(f.id);
      if (!el) { out.push({ id: f.id, label: f.label || f.id, kind: f.kind, failed: true, reason: 'input not on the page' }); return; }
      // A Pro-only input inside a locked section is not read by the free calculation: say so, do not measure it.
      if (el.closest('.locked')) { out.push({ id: f.id, label: labelFor(el, f.label), kind: f.kind, locked: true }); return; }
      out.push({ id: f.id, label: labelFor(el, f.label), kind: f.kind, el: el });
    });
    if (spec.unmet) {
      [].slice.call(d.querySelectorAll(spec.unmet.selector)).forEach(function (el) {
        if (!el.id || el.checked || el.disabled) return;  // the page renders only applicable items; collapsed ones count
        out.push({ id: el.id, label: labelFor(el), kind: 'unmet', el: el });
      });
    }
    return out;
  }

  function plan(f, delta) {
    var t = f.el.tagName === 'SELECT' ? 'select' : (f.el.type || 'text').toLowerCase();
    if (f.kind === 'unmet') {
      return { lo: null, hi: { map: { t: 'checkbox', v: true }, shown: 'met', clamped: false }, revert: { t: 'checkbox', v: false } };
    }
    var vals = f.kind === 'step' ? stepValues(f.el) : continuousValues(f.el, delta);
    if (!vals) return null;
    return {
      lo: { map: { t: t, v: vals.lo.v }, shown: vals.lo.text || vals.lo.v, clamped: vals.lo.clamped },
      hi: { map: { t: t, v: vals.hi.v }, shown: vals.hi.text || vals.hi.v, clamped: vals.hi.clamped },
      revert: { t: t, v: vals.base },
    };
  }

  function run(spec, opts) {
    opts = opts || {};
    var delta = opts.delta == null ? 0.1 : opts.delta;
    var progress = opts.onProgress || function () {};
    var cancelled = opts.isCancelled || function () { return false; };
    var EC = w.RZEmbedCompute, S = w.rzScenario;
    if (!EC || !EC.session) return Promise.resolve({ base: NaN, rows: [], cancelled: false, error: 'compute module missing' });
    var factors = factorsOf(spec);
    var inputs = opts.inputs || (S && S.capture ? S.capture() : {});
    var read = [spec.result];
    var parentText = (d.querySelector(spec.result) || {}).textContent;
    return EC.session({ page: spec.page, mode: 'sensitivity', inputs: inputs, settleMs: spec.settleMs == null ? 600 : spec.settleMs, stepMs: spec.stepMs })
      .then(function (s) {
        if (!s.ok) return { base: NaN, rows: [], cancelled: false, error: s.error };
        return s.read(read).then(function (b) {
          var base = num(b.values[spec.result]);
          var mismatch = parentText != null && isFinite(num(parentText)) && Math.abs(num(parentText) - base) > 1e-9 * Math.max(1, Math.abs(base))
            ? 'the page result (' + String(parentText).trim() + ') was not reproduced (' + b.values[spec.result] + ')' : null;
          var rows = [], i = 0;
          function next() {
            if (i >= factors.length || cancelled()) return Promise.resolve();
            var f = factors[i++], idx = i;
            progress(idx, factors.length);
            var row = { id: f.id, label: f.label, kind: f.kind, order: idx, low: base, high: base, clamped: false, failed: !!f.failed, reason: f.reason || null, locked: !!f.locked };
            rows.push(row);
            if (f.failed || f.locked) return next();
            var p = plan(f, delta);
            if (!p) { row.failed = true; row.reason = f.kind === 'step' ? 'only one option' : 'not a number'; return next(); }
            var rev = {}; rev[f.id] = p.revert;
            function side(sd, key) {
              if (!sd) return Promise.resolve();
              var ch = {}; ch[f.id] = sd.map;
              return s.measure(ch, rev, read).then(function (r) {
                var v = r.ok ? num(r.values[spec.result]) : NaN;
                if (!r.ok || !isFinite(v)) { row.failed = true; row.reason = r.ok ? 'result is not a number' : r.error; return; }
                row[key] = v; row[key + 'Input'] = sd.shown; row[key + 'Value'] = sd.map.v;
                if (sd.clamped) row.clamped = true;
              });
            }
            return side(p.lo, 'low').then(function () { return side(p.hi, 'high'); }).then(next);
          }
          return next().then(function () {
            s.close();
            rows.forEach(function (r) { r.swing = r.failed ? -1 : (r.locked ? -0.5 : Math.abs(r.high - r.low)); });
            rows.sort(function (a, b) { return (b.swing - a.swing) || (a.order - b.order); });
            return { base: base, rows: rows, total: factors.length, cancelled: cancelled() && rows.length < factors.length, error: mismatch };
          });
        });
      });
  }

  /* ---------- panel ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(v, ref) {
    if (!isFinite(v)) return '—';
    var dp = Math.min(3, Math.max(decimals(ref), 0));
    return v.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
  }

  function ensureStyles() {
    if (d.querySelector('link[data-rz-sens-css]')) return;
    var l = d.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'css/rz-sensitivity.css?v=' + (w.RZ_VERSION || '1');
    l.setAttribute('data-rz-sens-css', '');
    d.head.appendChild(l);
  }

  function render(box, spec, res) {
    var unit = spec.unit ? ' ' + spec.unit : '';
    var refText = (d.querySelector(spec.result) || {}).textContent || '';
    var ref = (String(refText).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/) || ['0'])[0];
    var rows = res.rows.slice(0, spec.max || 40);
    var maxSwing = 0;
    rows.forEach(function (r) { if (!r.failed) maxSwing = Math.max(maxSwing, Math.abs(r.low - res.base), Math.abs(r.high - res.base)); });
    var h = '<p class="rz-sens-base">Base: <b>' + esc(fmt(res.base, ref)) + esc(unit) + '</b>'
      + (res.cancelled ? ' · <span class="rz-sens-partial">partial: ' + res.rows.length + ' of ' + res.total + '</span>' : '')
      + (res.rows.length > rows.length ? ' · top ' + rows.length + ' of ' + res.rows.length + ' shown' : '') + '</p>';
    if (res.error) h += '<p class="rz-sens-warn">' + esc(res.error) + '</p>';
    if (rows.some(function (r) { return r.kind !== 'unmet'; })) {
      h += '<p class="rz-sens-legend"><span class="rz-sens-key is-lo"></span>input moved down <span class="rz-sens-key is-hi"></span>input moved up'
        + ' · bars run left of the line where the result falls, right where it rises</p>';
    }
    h += '<ol class="rz-sens-rows">';
    rows.forEach(function (r) {
      var left = 0, right = 0, loSide = r.low - res.base, hiSide = r.high - res.base;
      if (maxSwing > 0 && !r.failed) {
        left = Math.max(0, -Math.min(loSide, hiSide)) / maxSwing * 50;
        right = Math.max(0, Math.max(loSide, hiSide)) / maxSwing * 50;
      }
      var lowIsLeft = loSide <= hiSide;
      var vals = r.failed ? 'could not compute' + (r.reason ? ' (' + esc(r.reason) + ')' : '')
        : r.locked ? 'Pro input: the free calculation uses a fixed value'
        : (r.swing === 0 ? 'no change at the precision the page shows'
          : (r.kind === 'unmet' ? '+' + esc(fmt(r.high - res.base, ref)) + esc(unit) + ' if met'
            : esc(fmt(r.low, ref)) + ' to ' + esc(fmt(r.high, ref)) + esc(unit)
              + ' <span class="rz-sens-in">(' + esc(r.lowInput) + ' / ' + esc(r.highInput) + ')</span>'))
        + (r.clamped ? ' <span class="rz-sens-clamp">' + (r.kind === 'step' ? 'end of the list' : 'clamped to the field limit') + '</span>' : '');
      h += '<li><button type="button" class="rz-sens-row' + (r.failed || r.locked ? ' is-failed' : '') + '" data-rz-sens-focus="' + esc(r.id) + '">'
        + '<span class="rz-sens-label">' + esc(r.label) + '</span>'
        + '<span class="rz-sens-track" aria-hidden="true"><span class="rz-sens-axis"></span>'
        + (r.locked ? '' : r.failed ? '<span class="rz-sens-bar is-failed" style="left:25%;width:50%"></span>'
          : '<span class="rz-sens-bar ' + (lowIsLeft ? 'is-lo' : 'is-hi') + '" style="right:50%;width:' + left.toFixed(2) + '%"></span>'
          + '<span class="rz-sens-bar ' + (lowIsLeft ? 'is-hi' : 'is-lo') + '" style="left:50%;width:' + right.toFixed(2) + '%"></span>')
        + '</span><span class="rz-sens-vals">' + vals + '</span></button></li>';
    });
    h += '</ol>';
    box.innerHTML = h;
    [].forEach.call(box.querySelectorAll('[data-rz-sens-focus]'), function (b) {
      b.addEventListener('click', function () {
        var el = d.getElementById(b.getAttribute('data-rz-sens-focus'));
        if (!el) return;
        try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { el.scrollIntoView(); }
        try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
      });
    });
  }

  function mount(spec) {
    if (!spec || !spec.result || d.querySelector('details.rz-sens')) return null;
    var anchor = spec.anchor && d.querySelector(spec.anchor);
    if (!anchor) return null;
    ensureStyles();
    var n = (spec.factors || []).length;
    var det = d.createElement('details');
    det.className = 'rz-sens';
    det.setAttribute('data-rz-sens', spec.calc);
    det.innerHTML = '<summary>What drives this result</summary><div class="rz-sens-body">'
      + '<p class="rz-sens-note">' + esc(spec.note || ('Moves each input by 10 % down and up (a select: the option before and after) and recomputes this page. '
        + (n ? n + ' inputs, about ' + Math.max(3, Math.round(n * 0.45 + 2)) + ' s.' : ''))) + '</p>'
      + '<div class="rz-sens-actions"><button type="button" class="rz-sens-run">Compute sensitivity</button>'
      + '<button type="button" class="rz-sens-cancel" hidden>Cancel</button><span class="rz-sens-status" role="status" aria-live="polite"></span></div>'
      + '<div class="rz-sens-out"></div></div>';
    anchor.parentNode.insertBefore(det, anchor.nextSibling);  // right after the calculator, before the charts
    var btn = det.querySelector('.rz-sens-run'), cancel = det.querySelector('.rz-sens-cancel');
    var status = det.querySelector('.rz-sens-status'), out = det.querySelector('.rz-sens-out');
    var stop = false;
    cancel.addEventListener('click', function () { stop = true; cancel.disabled = true; status.textContent = 'Stopping after this input…'; });
    btn.addEventListener('click', function () {
      stop = false; btn.disabled = true; cancel.hidden = false; cancel.disabled = false; status.textContent = 'Starting…';
      run(spec, {
        onProgress: function (i, m) { btn.textContent = 'Computing… ' + i + '/' + m; status.textContent = i + ' of ' + m; },
        isCancelled: function () { return stop; },
      }).then(function (res) {
        btn.disabled = false; btn.textContent = 'Compute sensitivity'; cancel.hidden = true;
        if (!res.rows.length && res.error) { status.textContent = 'Could not compute: ' + res.error; return; }
        status.textContent = res.cancelled ? 'Stopped: partial: ' + res.rows.length + ' of ' + res.total : 'Done.';
        render(out, spec, res);
      }, function (e) {
        btn.disabled = false; btn.textContent = 'Compute sensitivity'; cancel.hidden = true;
        status.textContent = 'Could not compute: ' + (e && e.message || e);
      });
    });
    return det;
  }

  function auto() {
    var calc = d.body && d.body.getAttribute('data-rz-calc');
    if (!calc || (w.RZEmbedCompute && w.RZEmbedCompute.mode())) return;
    fetch('data/calculators.json?v=' + (w.RZ_VERSION || '1'), { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (reg) {
        var c = reg && (reg.calculators || []).filter(function (x) { return x.calc === calc; })[0];
        if (c && c.sensitivity) mount(Object.assign({ calc: c.calc, page: c.page }, c.sensitivity));
      }, function (e) { if (w.console) console.warn('rz-sensitivity: registry not loaded', e); });
  }

  w.rzSensitivity = { run: run, mount: mount, num: num, factorsOf: factorsOf };
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', auto); else auto();
})(window, document);
