/**
 * rz-pack.js — P04 project pack: one printable document for a facility project (P01) across its calculators.
 *
 * Each chosen calculator is loaded into a hidden copy (rz-embed-compute, ?embed=pack) with the project applied there
 * (values clamped to that page's own field limits, the user's per-page overrides, CAPEX carried into ROI), computed by
 * the page itself, and its visible result blocks are copied into the document with charts as images. Around them: a
 * cover, the assumptions register (every mapped field with its source), a basis appendix taken from each page's basis
 * line, and the shell's footer (js/rz-pdf-export.js buildDocument; escape rule applied there).
 *
 * Core (UMD, Node-tested by tools/test-pack-core.mjs):
 *   planInputs(entry, project, P, getEl) -> { inputs, rows }   inputs in the rz-scenario format; rows for the register
 *   numerals(text)                       -> ['23.61', '1,000', ...] numeric tokens as printed (gate helper)
 *   statusOf(project, calc, P)           -> 'not run' | 'out of date' | 'current'
 *   registerHtml(groups)                 -> the assumptions register table
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RZPack = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function statusOf(project, calc, P) {
    var res = project && project.results && project.results[calc];
    var keys = res ? Object.keys(res) : [];
    if (!keys.length) return 'not run';
    return keys.some(function (k) { return P.isStale(res[k], project); }) ? 'out of date' : 'current';
  }

  /* getEl(id) -> the field element in the loaded page (or null). Never throws on a missing field. */
  function planInputs(entry, project, P, getEl) {
    var inputs = {}, rows = [], ov = (project.overrides || {})[entry.calc] || {};
    Object.keys(entry.fields || {}).forEach(function (key) {
      var spec = entry.fields[key], el = getEl(spec.id);
      if (!el) { rows.push({ key: key, id: spec.id, value: '—', unit: spec.unit || '', source: 'field not on the page' }); return; }
      var t = el.tagName === 'SELECT' ? 'select' : (el.type || 'text');
      var o = ov[spec.id], canon = P.KEYMAP[key], v = project.inputs[canon];
      if (o) { inputs[spec.id] = { t: t, v: String(o.value) }; rows.push({ key: key, id: spec.id, value: String(o.value), unit: spec.unit || '', source: 'override on this page' }); return; }
      if (v == null) { rows.push({ key: key, id: spec.id, value: el.value, unit: spec.unit || '', source: 'page default' }); return; }
      var out = P.toPage(key, v, spec, el);
      if (el.tagName === 'SELECT' && ![].some.call(el.options, function (op) { return op.value === out.value; })) {
        var match = [].filter.call(el.options, function (op) { return P.fromPage(key, op.value, spec) === v; })[0];
        if (!match) { rows.push({ key: key, id: spec.id, value: el.value, unit: spec.unit || '', source: 'page default (project value ' + v + ' not offered)' }); return; }
        out = { value: match.value, clamped: false };
      }
      inputs[spec.id] = { t: t, v: out.value };
      rows.push({ key: key, id: spec.id, value: out.value, unit: spec.unit || '', source: out.clamped ? 'project, clamped to this field’s limit' : 'project' });
    });
    Object.keys(entry.consumes || {}).forEach(function (id) {
      var c = entry.consumes[id], el = getEl(id), parts = c.from.split('.');
      if (!el) return;
      var r = (project.results[parts[0]] || {})[parts[1]], o = ov[id];
      if (o) { inputs[id] = { t: el.type || 'number', v: String(o.value) }; rows.push({ key: id, id: id, value: String(o.value), unit: '', source: 'override on this page' }); return; }
      if (!r) { rows.push({ key: id, id: id, value: el.value, unit: '', source: 'page default (' + c.label + ' not run)' }); return; }
      var out = P.toPage(id, r.value, { factor: c.factor }, el);
      inputs[id] = { t: el.type || 'number', v: out.value };
      rows.push({ key: id, id: id, value: out.value, unit: '', source: 'from ' + c.label + (P.isStale(r, project) ? ', out of date' : '') });
    });
    return { inputs: inputs, rows: rows };
  }

  function numerals(text) { return (String(text || '').match(/\d[\d,]*(?:\.\d+)?/g) || []); }

  function registerHtml(groups) {
    var h = '<table><thead><tr><th>Calculator</th><th>Field</th><th class="rzp-num">Value</th><th>Unit</th><th>Source</th></tr></thead><tbody>';
    groups.forEach(function (g) {
      g.rows.forEach(function (r, i) {
        h += '<tr><td>' + (i ? '' : esc(g.title)) + '</td><td>' + esc(r.label || r.key) + '</td><td class="rzp-num">' + esc(r.value) + '</td><td>' + esc(r.unit) + '</td><td>' + esc(r.source) + '</td></tr>';
      });
    });
    return h + '</tbody></table>';
  }

  return { planInputs: planInputs, numerals: numerals, statusOf: statusOf, registerHtml: registerHtml, esc: esc };
});

/* ===================== browser: the builder ===================== */
(function (w, d) {
  'use strict';
  if (!w || !d || !w.RZPack || w.RZPack.build) return;
  var K = w.RZPack;

  function labelOf(doc, el) {
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
    [].forEach.call(c.querySelectorAll('button, .rz-proj-tag, .rz-manual-link, .tooltip-trigger, .tooltip-content, [role="tooltip"], [aria-hidden="true"], input, select'), function (x) { x.remove(); });
    return (c.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80) || el.id;
  }
  function visible(el) { return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length); }

  /* A result block as print HTML: what the reader sees on the page, charts as images, no controls.
     Hidden values stay hidden: an element the page hides (visibility, display) is not printed, and a value the page
     masks behind a sign-in (visibility:hidden + "—") prints as "—", never as the number underneath. */
  var SVG_PROPS = ['fill', 'stroke', 'stroke-width', 'opacity', 'fill-opacity', 'stroke-opacity', 'stroke-dasharray', 'font-size', 'font-family', 'font-weight'];
  function sectionHtml(el) {
    var win = el.ownerDocument.defaultView;
    var src = [el].concat([].slice.call(el.querySelectorAll('*')));
    var c = el.cloneNode(true), dst = [c].concat([].slice.call(c.querySelectorAll('*')));
    var drop = [];
    src.forEach(function (o, i) {
      var k = dst[i];
      if (!k || i === 0) return;
      var cs = win.getComputedStyle(o);
      if (cs.display === 'none') { drop.push(k); return; }
      if (o instanceof win.SVGElement) {
        SVG_PROPS.forEach(function (p) { var v = cs.getPropertyValue(p); if (v) k.style.setProperty(p, v); });
        return;
      }
      if (cs.visibility === 'hidden' && o.parentElement && win.getComputedStyle(o.parentElement).visibility !== 'hidden') {
        var after = win.getComputedStyle(o, '::after').content;
        k.textContent = after && after !== 'none' && after !== 'normal' ? after.replace(/^["']|["']$/g, '') : '';
      }
    });
    drop.forEach(function (k) { if (k.parentNode) k.parentNode.removeChild(k); });
    var canv = [].slice.call(el.querySelectorAll('canvas')).map(function (cv) {
      try { return cv.offsetWidth || cv.offsetHeight ? { url: cv.toDataURL('image/png'), w: cv.clientWidth || cv.width } : null; } catch (e) { return null; }
    });
    [].forEach.call(c.querySelectorAll('canvas'), function (cv, i) {
      var r = canv[i], img = c.ownerDocument.createElement('img');
      if (!r) { cv.remove(); return; }
      img.src = r.url; img.alt = 'chart'; img.style.cssText = 'max-width:100%;height:auto;width:' + Math.min(r.w, 640) + 'px';
      cv.parentNode.replaceChild(img, cv);
    });
    [].forEach.call(c.querySelectorAll('button, input, select, textarea, script, style, .rz-sens, .rz-manual-link, [hidden], .tooltip-trigger, .tooltip-content, .tooltip-desc'), function (x) { x.remove(); });
    [].forEach.call(c.querySelectorAll('*'), function (x) {
      [].slice.call(x.attributes).forEach(function (a) { if (/^on/i.test(a.name)) x.removeAttribute(a.name); });
    });
    // label + value pairs read as one row in print
    [].forEach.call(c.querySelectorAll('[class*="value"]'), function (v) {
      var p = v.parentElement;
      if (p && p !== c && [].some.call(p.children, function (x) { return x !== v && /label|name/.test(x.className || ''); })) p.classList.add('rzp-kv');
    });
    return c.innerHTML;
  }
  var PACK_CSS = '<style>.rzp-block{margin:0 0 12px}.rzp-block .rzp-kv{display:flex;flex-wrap:wrap;justify-content:space-between;gap:2px 16px;padding:3px 0;border-bottom:1px solid #e5e7eb;break-inside:avoid}'
    + '.rzp-block .rzp-kv>[class*="value"]{font-variant-numeric:tabular-nums;font-weight:600}.rzp-block svg{max-width:100%;height:auto}.rzp-block figure{margin:8px 0;break-inside:avoid}'
    + '.rzp-stale{padding:6px 8px;border-left:2px solid #92400e;background:#fdf6ec}.rzp-fail{padding:6px 8px;border-left:2px solid #b42318;background:#fdf1f0}</style>';

  /* build(store, calcs, opts) -> Promise<{ html, failed:[calc], cancelled }>  opts: { register, basis, note, onProgress, isCancelled } */
  function build(store, calcs, opts) {
    opts = opts || {};
    var P = w.RZProject, project = store.active();
    if (!project) return Promise.reject(new Error('no active project'));
    return fetch('data/calculators.json', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (j) {
      var reg = j.calculators || [], groups = [], sections = [], basis = [], failed = [];
      var entries = calcs.map(function (c) { return reg.filter(function (e) { return e.calc === c; })[0]; }).filter(Boolean);
      var seq = Promise.resolve(), cancelled = false;
      entries.forEach(function (e, i) {
        seq = seq.then(function () {
          if (cancelled || (opts.isCancelled && opts.isCancelled())) { cancelled = true; return; }
          if (opts.onProgress) opts.onProgress(i + 1, entries.length, e.title);
          var plan = null;
          return w.RZEmbedCompute.run({ page: e.page, mode: 'pack', settleMs: e.settleMs || 1200, timeoutMs: 20000, read: (e.results || []).map(function (r) { return r.selector; }),
            inputs: function (doc) { plan = K.planInputs(e, project, P, function (id) { return doc.getElementById(id); }); plan.rows.forEach(function (r) { var el = doc.getElementById(r.id); r.label = el ? labelOf(doc, el) : r.key; }); return plan.inputs; },
            probe: function (doc) {
              var blocks = [].slice.call(doc.querySelectorAll((e.pack && e.pack.sections) || '.tool-results')).filter(visible);
              var b = doc.querySelector((e.pack && e.pack.basis) || '.tool-head .basis');
              return { blocks: blocks.map(function (el) { return { html: sectionHtml(el), text: (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim() }; }),
                basis: b ? b.textContent.replace(/\s+/g, ' ').trim() : '' };
            } }).then(function (r) {
            var st = K.statusOf(project, e.calc, P);
            groups.push({ title: e.title, rows: plan ? plan.rows : [] });
            if (!r.ok || !r.probe || !r.probe.blocks.length) {
              failed.push(e.calc);
              sections.push({ id: 'calc-' + e.calc, label: e.title, html: '<p class="rzp-fail">Section not available: the calculator could not compute this project (' + K.esc(r.error || 'no result blocks on the page') + ').</p>' });
              return;
            }
            var warn = st === 'current' ? '' : '<p class="rzp-stale">' + (st === 'not run' ? 'This calculator had not been run for the project before this pack; the section below is computed now from the project values.' : 'The project changed since this calculator last published its results; the section below is computed now from the current project values.') + '</p>';
            sections.push({ id: 'calc-' + e.calc, label: e.title, html: warn + r.probe.blocks.map(function (b) { return '<div class="rzp-block">' + b.html + '</div>'; }).join(''), text: r.probe.blocks.map(function (b) { return b.text; }) });
            basis.push({ title: e.title, text: r.probe.basis, manual: e.manual && e.manual.page });
          });
        });
      });
      return seq.then(function () {
        if (cancelled) return { html: null, failed: failed, cancelled: true };
        var all = [];
        if (opts.register !== false) all.push({ id: 'assumptions', label: 'Assumptions register', html: '<p>Every value each calculator was given for this pack, and where it came from. "Page default" means the project did not set it.</p>' + K.registerHtml(groups) });
        all = all.concat(sections);
        if (all.length) all[0] = Object.assign({}, all[0], { html: PACK_CSS + all[0].html });
        if (opts.basis !== false) all.push({ id: 'basis', label: 'Basis', html: basis.length ? '<ul>' + basis.map(function (b) {
          return '<li><b>' + K.esc(b.title) + '</b>: ' + (b.text ? K.esc(b.text) : 'No method notes on this calculator.') + (b.manual ? ' Full method: resistancezero.com/' + K.esc(b.manual) + '.' : '') + '</li>';
        }).join('') + '</ul>' : '<p>No calculator in this pack could be computed.</p>' });
        var now = new Date();
        var meta = [['Project', project.name + ' · revision ' + project.rev], ['Generated', now.toLocaleString() + ' (' + now.toISOString() + ')'], ['Site version', w.RZ_VERSION || '—'],
          ['Calculators', entries.map(function (e) { return e.title; }).join(', ')]];
        if (opts.note) meta.push(['Issue note', String(opts.note).slice(0, 500)]);
        var html = w.RZPdfExport.buildDocument({ title: 'Project pack — ' + project.name, subtitle: 'Facility project pack', meta: meta, sections: all,
          footerNote: 'Each section computed by its calculator at generation time' });
        return { html: html, failed: failed, cancelled: false, sections: sections };
      });
    });
  }
  K.build = build;
})(typeof window !== 'undefined' ? window : null, typeof document !== 'undefined' ? document : null);
