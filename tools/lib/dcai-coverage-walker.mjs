/**
 * dcai-coverage-walker.mjs — the in-page numeral walker shared by the DC-AI traceability gates.
 *
 * Runs INSIDE the browser (page.evaluate). For every visible numeral in the given root it
 * decides, in this order, how the number is accounted for:
 *   HOOKED     an ancestor [data-basis-param] whose id resolves in the registry AND whose
 *              rendered string equals the registry value at an accepted scale
 *   MISMATCH   a hook that resolves but whose drawn string is not the registry value — a badge
 *              beside the wrong number, the worst of the buckets
 *   DECLARED   an ancestor [data-rz-authored-basis] carrying a reason of >= 40 characters
 *   UNTRACED   none of the above
 * Value-string membership WITHOUT a hook is reported (valueMatch) but never counts as traced —
 * on this page the symbol is the deliverable, not the coincidence of a number.
 *
 * Exported as a source string so the gates can inject it with page.evaluate(new Function(...)).
 */
export const WALKER_SOURCE = String.raw`
(function (root, opts) {
  var registry = window[opts.registryGlobal];
  var byId = {};
  if (registry && registry.parameters) { registry.parameters.forEach(function (p) { byId[p.id] = p; }); }
  function renderings(value) {
    var out = {};
    /* a string-valued parameter (a version tag, a retired-basis note) accounts for the numerals it contains */
    if (typeof value === 'string') { (value.match(/-?\d[\d,]*(?:\.\d+)?/g) || []).forEach(function (n) { out[n.replace(/^-/, '')] = 1; }); return out; }
    if (typeof value !== 'number' || !isFinite(value)) { return out; }
    var scales = [value, value / 1000, value * 1000, value * 100, value / 60, value * 60];
    scales.forEach(function (s) {
      if (!isFinite(s)) { return; }
      [0, 1, 2, 3].forEach(function (d) {
        var f = s.toFixed(d);
        out[f] = 1; out[f.replace(/\B(?=(\d{3})+(?!\d))/g, ',')] = 1; out[String(Number(f))] = 1;
      });
    });
    return out;
  }
  var cache = {};
  function accepts(id, text) {
    if (!cache[id]) { cache[id] = renderings(byId[id] ? byId[id].value : NaN); }
    return !!cache[id][text];
  }
  var anyValue = null;
  function valueMatch(text) {
    if (!anyValue) { anyValue = {}; Object.keys(byId).forEach(function (id) { var r = renderings(byId[id].value); Object.keys(r).forEach(function (k) { anyValue[k] = 1; }); }); }
    return !!anyValue[text];
  }
  function excluded(text) {
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(text)) { return true; }
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) { return true; }
    var n = Number(text.replace(/,/g, ''));
    if (!isFinite(n)) { return true; }
    if (Math.floor(n) === n && Math.abs(n) <= 24) { return true; }
    return false;
  }
  function scrub(s) {
    return s
      .replace(/\b\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?\b/g, ' ')          // dates / timestamps
      .replace(/\b\d{1,2}:\d{2}(:\d{2})?\b/g, ' ')                  // clocks
      .replace(/\bv?\d+\.\d+\.\d+\b/g, ' ')                         // semver
      .replace(/\b(IEC|IEEE|ISO|ANSI|NFPA|EN|TIA|ASHRAE|UL|BS|DIN|ISA|VDE|EIA|NEC|C37|SNI|ASCE|OCP)[\s\-\/]?[A-Z]?\d[\d\/.\-A-Za-z:]*/g, ' ')  // standards citations are labels, not quantities
      .replace(/\bAF \/ 70E\b|\bTN-S \d+\b|\bNovec 1230\b|\bNOVEC 1230\b/g, ' ')
      .replace(/\b[A-Z]{1,6}[a-z]?-?[A-Z]?\.?\d{1,4}[A-Z]?(\.\.?\d{1,3})?\b/g, ' ')      // tags and model names: DH-01, RG-07, RPP-1A.25, TX1, CH-12, P101, CHx1000, B300
      .replace(/\b(A|B)\d{1,2}\b/g, ' ')                            // A01 feed positions
      .replace(/\bDN\d+\b/g, ' ')                                   // pipe sizes
      .replace(/\b(lines?|rows?|ch|bank|zone|level|L)\s?\d{1,3}(\s?[-–]\s?\d{1,3})?\b/gi, ' ')
      .replace(/\b\d{1,3}\s?(of|\/)\s?\d{1,3}\b/g, ' ')            // "6 of 880 shown", "7/8"
      .replace(/gb300-500mw-[\d-]+/g, ' ')
      .replace(/\b[a-z][a-z_]*(\.[a-z_0-9]+)+\b/g, ' ')                    // registry ids (compute.racks_per_nvl72_domain) are labels
      .replace(/\bR-\d{2,4}[a-z]{0,3}(\([A-Z]\))?\b/g, ' ')                  // refrigerant designations (R-1234ze(E))
      .replace(/\b\d{1,3} ?(ms|s|min|hr|h|yr)\b/g, ' ');                      // durations and refresh intervals are labels (30 s, 250hr)
  }
  function visible(el) {
    if (!el || !el.getBoundingClientRect) { return false; }
    var b = el.getBoundingClientRect();
    if (b.width < 0.5 || b.height < 0.5) { return false; }
    var cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0';
  }
  var out = { numerals: 0, hooked: 0, mismatch: 0, declared: 0, untraced: 0, valueMatchUnhooked: 0, samples: [], mismatches: [] };
  var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  var node;
  while ((node = walker.nextNode())) {
    var el = node.parentElement;
    if (!el) { continue; }
    var tag = el.tagName.toLowerCase();
    if (tag === 'script' || tag === 'style' || tag === 'title' || tag === 'noscript') { continue; }
    if (el.closest('.isa-bubble-txt, .rz-basis-legend, .rz-inspector, .rz-basis-drawer, [data-rz-coverage-ignore]')) { continue; }
    if (opts.svgOnly && !el.closest('svg')) { continue; }
    if (opts.htmlOnly && el.closest('svg')) { continue; }
    if (!visible(el)) { continue; }
    var text = scrub(node.textContent || '');
    var m = text.match(/-?\d[\d,]*(?:\.\d+)?/g);
    if (!m) { continue; }
    for (var i = 0; i < m.length; i++) {
      var raw = m[i].replace(/^-/, '');
      if (excluded(raw)) { continue; }
      out.numerals++;
      var hook = el.closest('[data-basis-param]');
      if (hook) {
        var ids = ((hook.getAttribute('data-basis-params') || hook.getAttribute('data-basis-param')) + '').split(/\s+/).filter(function (x) { return byId[x]; });
        if (ids.length) {
          var hit = ids.some(function (id) { return accepts(id, raw); });
          if (hit) { out.hooked++; continue; }
          out.mismatch++;
          if (out.mismatches.length < 60) { out.mismatches.push({ id: ids.join(' '), drawn: raw, registry: ids.map(function (id) { return byId[id].value; }).join(' '), ctx: (node.textContent || '').trim().slice(0, 50) }); }
          continue;
        }
      }
      var decl = el.closest('[data-rz-authored-basis]');
      if (decl && (decl.getAttribute('data-rz-authored-basis') || '').length >= 40) { out.declared++; continue; }
      out.untraced++;
      if (valueMatch(raw)) { out.valueMatchUnhooked++; }
      if (out.samples.length < opts.sampleLimit) {
        var svg = el.closest('svg');
        out.samples.push({ svg: svg ? svg.id : '', id: el.id || '', text: (node.textContent || '').trim().slice(0, 56), num: raw, valueMatch: valueMatch(raw) });
      }
    }
  }
  return out;
})
`.trim();
