/**
 * rz-embed-compute.js — compute a calculator page in a hidden same-origin iframe and read its results.
 * One loop shared by compare (P03), report pack (P04) and sensitivity (P07); ARCHITECTURE-P C2 / task F2.
 *
 *   RZEmbedCompute.run({ page, mode, inputs, read, settleMs, timeoutMs }) -> Promise<{ ok, values, error }>
 *     page    calculator file, e.g. 'capex-calculator.html' (same origin only; no scheme, no '..')
 *     mode    'compare' | 'pack' | 'sensitivity' | 'article' -> appended as ?embed=<mode>
 *     inputs  { id: {t, v} } — the rz-scenario capture format; set through the page's own input/change events
 *     read    array of CSS selectors; values[selector] = trimmed textContent, or null when absent
 *   Runs are queued: one iframe exists at a time and it is removed when the run ends, success or not.
 *
 *   RZEmbedCompute.session({ page, mode, inputs, settleMs, stepMs, stepTimeoutMs })
 *     -> Promise<{ ok, error, measure(changes, revert, read), read(read), close() }>  (P07: many measurements, one load)
 *
 * The embedded page is told it is embedded only by the ?embed flag; rz-cookie-consent.js (no banner, GA off) and
 * rz-scenario.js (no account pill) read it. The calculator code itself must not branch on it.
 */
(function (w, d) {
  'use strict';
  var MODES = { compare: 1, pack: 1, sensitivity: 1, article: 1 };
  var queue = Promise.resolve();

  function wait(ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); }
  function frames(win, n) {
    return new Promise(function (ok) {
      (function step(k) { if (k <= 0) return ok(); win.requestAnimationFrame(function () { step(k - 1); }); })(n);
    });
  }

  function validPage(page) { return typeof page === 'string' && /^[a-z0-9][a-z0-9/_-]*\.html$/i.test(page) && page.indexOf('..') < 0; }

  function fire(win, el, type) { try { el.dispatchEvent(new win.Event(type, { bubbles: true })); } catch (e) {} }

  function apply(win, map) {
    var doc = win.document;
    Object.keys(map || {}).forEach(function (id) {
      var el = doc.getElementById(id), rec = map[id];
      if (!el || !rec) return;
      if (rec.t === 'checkbox') el.checked = !!rec.v;
      else if (rec.t === 'radio') {
        var rs = doc.getElementsByName(el.name || id);
        for (var i = 0; i < rs.length; i++) rs[i].checked = rs[i].value === rec.v;
      } else el.value = rec.v;
      fire(win, el, 'input'); fire(win, el, 'change');
    });
  }

  function once(opts) {
    opts = opts || {};
    var mode = opts.mode || 'compare';
    if (!validPage(opts.page)) return Promise.resolve({ ok: false, values: {}, error: 'invalid page' });
    if (!MODES[mode]) return Promise.resolve({ ok: false, values: {}, error: 'invalid mode' });
    var settleMs = opts.settleMs == null ? 900 : opts.settleMs;
    var timeoutMs = opts.timeoutMs || 10000;
    var f = d.createElement('iframe');
    f.setAttribute('aria-hidden', 'true');
    f.setAttribute('tabindex', '-1');
    f.title = 'embedded calculator';
    // Laid out at desktop width so the page computes as it does for a reader; kept off-screen, not display:none
    // (charts and layout-dependent code measure their boxes).
    f.style.cssText = 'position:fixed;left:-20000px;top:0;width:1280px;height:900px;border:0;visibility:hidden;pointer-events:none';
    f.src = opts.page + (opts.page.indexOf('?') < 0 ? '?' : '&') + 'embed=' + mode;
    var timer;
    var done = new Promise(function (ok) {
      timer = setTimeout(function () { ok({ ok: false, values: {}, error: 'timeout after ' + timeoutMs + ' ms' }); }, timeoutMs);
      f.addEventListener('load', function () {
        var win = f.contentWindow;
        var doc;
        try { doc = win.document; } catch (e) { ok({ ok: false, values: {}, error: 'not same-origin' }); return; }
        if (!doc || !doc.body || !doc.body.childElementCount) { ok({ ok: false, values: {}, error: 'page did not load' }); return; }
        wait(150).then(function () { apply(win, opts.inputs); return wait(settleMs); })
          .then(function () { return frames(win, 2); })
          .then(function () {
            var values = {};
            (opts.read || []).forEach(function (sel) {
              var el = null;
              try { el = doc.querySelector(sel); } catch (e) {}
              values[sel] = el ? (el.textContent || '').trim() : null;
            });
            var read = opts.read || [];
            // A wrong page (a 404 page, a redirect) loads fine but has none of the requested elements.
            if (read.length && read.every(function (sel) { return values[sel] === null; })) {
              ok({ ok: false, values: values, error: 'none of the requested results is on the page' }); return;
            }
            ok({ ok: true, values: values, error: null });
          }, function (e) { ok({ ok: false, values: {}, error: String(e && e.message || e) }); });
      });
      f.addEventListener('error', function () { ok({ ok: false, values: {}, error: 'page did not load' }); });
    });
    d.body.appendChild(f);
    return done.then(function (r) { clearTimeout(timer); if (f.parentNode) f.parentNode.removeChild(f); return r; });
  }

  function run(opts) {
    var p = queue.then(function () { return once(opts); });
    queue = p.then(function () {}, function () {});
    return p;
  }

  /* session(): one iframe, many measurements (P07 sensitivity: 2 per factor, so a load per measurement would cost
     ~1.5 s each). The base inputs are applied once; measure(changes, revert) applies a change through the page's own
     events, reads, then applies the revert map so the next measurement starts from the base again. Holds the queue
     until close(). A measurement that does not finish within stepTimeoutMs resolves { ok:false, error:'timeout' }. */
  function session(opts) {
    opts = opts || {};
    var release;
    var hold = new Promise(function (ok) { release = ok; });
    var started = queue.then(function () { return openSession(opts, release); });
    queue = started.then(function () { return hold; }, function () {});
    return started;
  }

  function openSession(opts, release) {
    var mode = opts.mode || 'sensitivity';
    if (!validPage(opts.page)) { release(); return Promise.resolve({ ok: false, error: 'invalid page' }); }
    if (!MODES[mode]) { release(); return Promise.resolve({ ok: false, error: 'invalid mode' }); }
    var settleMs = opts.settleMs == null ? 900 : opts.settleMs;
    var stepMs = opts.stepMs == null ? 80 : opts.stepMs;
    var stepTimeoutMs = opts.stepTimeoutMs || 10000;
    var f = d.createElement('iframe');
    f.setAttribute('aria-hidden', 'true');
    f.setAttribute('tabindex', '-1');
    f.title = 'embedded calculator';
    f.style.cssText = 'position:fixed;left:-20000px;top:0;width:1280px;height:900px;border:0;visibility:hidden;pointer-events:none';
    f.src = opts.page + (opts.page.indexOf('?') < 0 ? '?' : '&') + 'embed=' + mode;
    var closed = false;
    function close() { if (closed) return; closed = true; if (f.parentNode) f.parentNode.removeChild(f); release(); }
    function readAll(doc, read) {
      var values = {};
      (read || []).forEach(function (sel) {
        var el = null;
        try { el = doc.querySelector(sel); } catch (e) {}
        values[sel] = el ? (el.textContent || '').trim() : null;
      });
      return values;
    }
    var timer;
    var ready = new Promise(function (ok) {
      timer = setTimeout(function () { ok({ ok: false, error: 'timeout after ' + (opts.timeoutMs || 10000) + ' ms' }); }, opts.timeoutMs || 10000);
      f.addEventListener('load', function () {
        var win = f.contentWindow, doc;
        try { doc = win.document; } catch (e) { ok({ ok: false, error: 'not same-origin' }); return; }
        if (!doc || !doc.body || !doc.body.childElementCount) { ok({ ok: false, error: 'page did not load' }); return; }
        wait(150).then(function () { apply(win, opts.inputs); return wait(settleMs); })
          .then(function () { return frames(win, 2); })
          .then(function () {
            ok({
              ok: true, error: null, close: close,
              read: function (read) { return Promise.resolve({ ok: !closed, values: closed ? {} : readAll(doc, read), error: closed ? 'closed' : null }); },
              measure: function (changes, revert, read) {
                if (closed) return Promise.resolve({ ok: false, values: {}, error: 'closed' });
                var t;
                var step = new Promise(function (res) {
                  t = setTimeout(function () { res({ ok: false, values: {}, error: 'timeout after ' + stepTimeoutMs + ' ms' }); }, stepTimeoutMs);
                  Promise.resolve().then(function () { apply(win, changes); return wait(stepMs); })
                    .then(function () { return frames(win, 2); })
                    .then(function () { var v = readAll(doc, read); apply(win, revert); return wait(stepMs).then(function () { return v; }); })
                    .then(function (v) { res({ ok: true, values: v, error: null }); },
                          function (e) { res({ ok: false, values: {}, error: String(e && e.message || e) }); });
                });
                return step.then(function (r) { clearTimeout(t); return r; });
              },
            });
          }, function (e) { ok({ ok: false, error: String(e && e.message || e) }); });
      });
      f.addEventListener('error', function () { ok({ ok: false, error: 'page did not load' }); });
    });
    d.body.appendChild(f);
    return ready.then(function (r) { clearTimeout(timer); if (!r.ok) close(); return r; });
  }

  function mode(loc) {
    var m = String((loc || w.location).search || '').match(/[?&]embed=([a-z]+)(?:&|$)/);
    return m && MODES[m[1]] ? m[1] : null;
  }

  w.RZEmbedCompute = { run: run, session: session, mode: mode, MODES: Object.keys(MODES) };
})(window, document);
