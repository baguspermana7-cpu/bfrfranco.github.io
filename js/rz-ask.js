/* rz-ask.js — PRD-P21 stage 1: "Ask about this page", answered only from this page's records.
 * No AI. A question is matched by keyword (BM25 over a generated index of the page's parameter registry records and
 * its manual's sections, plus a curated synonym list) and every answer is a template filled from record fields.
 * A question that matches nothing returns the honest miss. Every card cites a registry id or a manual anchor that
 * exists (gate: tools/test-explain-ask.mjs).
 *
 *   Core (DOM-free, also loaded by tools/build-explain-index.mjs and the gate):
 *     RZAsk.tokens(text)                 -> ['pue', 'design', ...]   one tokenizer for index and question
 *     RZAsk.numbers(text)                -> [1.165, ...]             numerals in a question
 *     RZAsk.search(index, question)      -> { hits:[{doc, score}], miss:boolean, ms }
 *     RZAsk.compose(record, ctx)         -> { title, sentences:[...] }   template only, never paraphrase
 *   Page: <span data-rz-ask-slot></span> where the trigger goes, and
 *         <script src="js/rz-ask.js" data-rz-ask-index="data/explain/<page>.json" defer></script>
 * ES5, no dependencies. */
(function (root) {
  'use strict';

  var STOP = {};
  ('a an and are as at be by can do does for from has have how i in is it its me my of on or our per so than that the ' +
   'their them then there these this those to was what when where which who why will with you your about show tell ' +
   'explain mean means meaning number value values page here come comes get got calculated computed work works ' +
   'many much also just some any ' +
   'apa apakah berapa bagaimana kenapa mengapa yang ini itu di ke dari untuk dan atau adalah dengan pada nilai angka ' +
   'jelaskan maksud arti dihitung hitung tolong saya kamu').split(' ').forEach(function (w) { STOP[w] = 1; });

  var KEEP_S = /(ss|is|status|campus|bus|plus|bonus|radius|focus|corpus|census|gas|chassis|basis|analysis|axis|was|has)$/;
  function stem(t) {
    if (t.length > 4 && /ies$/.test(t)) return t.slice(0, -3) + 'y';
    if (t.length > 3 && /s$/.test(t) && !KEEP_S.test(t)) return t.slice(0, -1);
    return t;
  }
  /* camelCase and snake/dot ids split; numerals are not text tokens (they are a separate signal) */
  function tokens(text) {
    var s = String(text == null ? '' : text).replace(/([a-z])([A-Z][a-z])/g, '$1 $2').toLowerCase()
      .replace(/&amp;/g, '&').replace(/°\s*c\b/g, ' degc ').replace(/²/g, '2').replace(/³/g, '3');
    var out = [], re = /[a-z][a-z0-9]*/g, m;
    while ((m = re.exec(s))) {
      var t = m[0];
      if (t.length < 2 || STOP[t]) continue;
      out.push(stem(t));
      /* "scope 3", "tier 4", "level 2": the word and its single digit also as one token (ids write scope3) */
      var after = /^\s+(\d)(?!\d|[.,]\d)/.exec(s.slice(re.lastIndex));
      if (after) out.push(t + after[1]);
    }
    return out;
  }
  /* "1,464" = 1464; "1.165" = 1.165; "1,5" = 1.5; "12%" = 12 */
  function numbers(text) {
    var out = [], re = /(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:[.,]\d+)?)/g, m;
    var s = String(text == null ? '' : text);
    while ((m = re.exec(s))) {
      var raw = m[1];
      /* "1,165" is a thousands group in English and a decimal comma in Indonesian: keep both readings */
      if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(raw)) {
        out.push(+raw.replace(/,/g, ''));
        if (/^\d{1,3},\d{3}$/.test(raw)) out.push(+raw.replace(',', '.'));
      } else {
        var v = +raw.replace(',', '.');
        if (isFinite(v)) out.push(v);
      }
    }
    return out;
  }

  /* THRESHOLD is on COVERAGE, not on the BM25 score (which ranks): the share of the reader's own words a document
     answers. A word counts in full when the document carries it (or a curated synonym of it) in a label, an id or a
     manual heading (term weight >= 3), proportionally less when it only appears in passing. A word this page's index
     has never seen, directly or through a synonym, counts twice in the denominator, and a word on half the page's
     documents or more counts half (it tells nothing apart): a question about something the page does not hold stays
     under the threshold, which is the honest miss. */
  var K1 = 1.2, B = 0.75, SYN_WEIGHT = 0.6, NUM_BONUS = 3, THRESHOLD = 0.51, KEEP = 0.45, ON_PAGE = 1;

  function queryTerms(question, synonyms) {
    var base = tokens(question), terms = {}, exps = {}, i, j;
    for (i = 0; i < base.length; i++) terms[base[i]] = Math.max(terms[base[i]] || 0, 1);
    for (i = 0; i < base.length; i++) {
      var exp = synonyms && synonyms[base[i]];
      if (!exp) continue;
      var et = tokens(exp.join(' '));
      exps[base[i]] = et;
      for (j = 0; j < et.length; j++) if (!terms[et[j]]) terms[et[j]] = SYN_WEIGHT;
    }
    /* the reverse of an abbreviation: "water usage effectiveness" also asks for "wue" */
    if (synonyms) {
      var have = {};
      for (i = 0; i < base.length; i++) have[base[i]] = 1;
      for (var key in synonyms) {
        if (!Object.prototype.hasOwnProperty.call(synonyms, key) || terms[key]) continue;
        var full = tokens(synonyms[key].join(' '));
        if (full.length < 2) continue;
        for (j = 0; j < full.length && have[full[j]]; j++) { /* all present */ }
        if (j === full.length) terms[stem(key)] = 1;
      }
    }
    return { base: base, terms: terms, exps: exps };
  }
  function near(q, v) {
    if (typeof v !== 'number' || !isFinite(v) || v === 0) return false;
    var cands = [v, v * 100];
    for (var i = 0; i < cands.length; i++) if (Math.abs(q - cands[i]) <= Math.abs(cands[i]) * 0.01) return true;
    return false;
  }

  function search(index, question) {
    var t0 = (root.performance && root.performance.now) ? root.performance.now() : Date.now();
    var q = queryTerms(question, index.synonyms), nums = numbers(question), docs = index.docs, df = index.df;
    var N = docs.length, avg = index.avgdl || 1, scored = [], i, t;
    function idf(term) { var n = df[term] || 0; return Math.log(1 + (N - n + 0.5) / (n + 0.5)); }
    var words = [], wsum = 0, seen = {};
    for (i = 0; i < q.base.length; i++) {
      var w = q.base[i];
      if (seen[w]) continue;
      seen[w] = 1;
      var alts = [w].concat(q.exps[w] || []), most = df[w] || 0;
      if (!most) for (var e = 1; e < alts.length; e++) most = Math.max(most, df[alts[e]] || 0);
      /* unknown to this page: x2; on half the page's documents or more ("cost" on a cost calculator): x0.5 */
      var wt = !most ? 2 : most >= N / 2 ? 0.5 : 1;
      words.push({ alts: alts, wt: wt });
      wsum += wt;
    }
    for (t in q.terms) if (!seen[t] && q.terms[t] === 1) { seen[t] = 1; words.push({ alts: [t], wt: 1, bonus: true }); }
    for (i = 0; i < N; i++) {
      var d = docs[i], s = 0;
      for (t in q.terms) {
        var tf = d.tf[t];
        if (!tf) continue;
        s += q.terms[t] * idf(t) * (tf * (K1 + 1)) / (tf + K1 * (1 - B + B * d.len / avg));
      }
      if (s <= 0) continue;
      var cov = 0;
      for (var x = 0; x < words.length; x++) {
        var m = 0;
        for (var y = 0; y < words[x].alts.length; y++) m = Math.max(m, Math.min(1, (d.tf[words[x].alts[y]] || 0) / 3));
        if (words[x].bonus) { if (m >= 1) cov = Math.max(cov, wsum); continue; }   /* a whole abbreviation matched */
        cov += words[x].wt * m;
      }
      var norm = wsum ? Math.min(1, cov / wsum) : 0, rank = s;
      if (d.onPage) rank += ON_PAGE;
      for (var k = 0; k < nums.length; k++) if (near(nums[k], d.value)) { rank += NUM_BONUS; break; }
      scored.push({ doc: d, score: rank, norm: norm });
    }
    scored.sort(function (a, b) { return b.score - a.score || (a.doc.key < b.doc.key ? -1 : 1); });
    var hits = [];
    if (scored.length) {
      var top = 0;
      for (i = 0; i < scored.length; i++) if (scored[i].norm >= THRESHOLD) { top = scored[i].score; break; }
      for (i = 0; i < scored.length && hits.length < 3; i++) {
        if (scored[i].norm >= THRESHOLD && scored[i].score >= top * KEEP) hits.push(scored[i]);
      }
    }
    var t1 = (root.performance && root.performance.now) ? root.performance.now() : Date.now();
    return { hits: hits, miss: hits.length === 0, ms: t1 - t0, terms: q.terms };
  }

  /* Template (PRD-P21 §5): "<label> = <value> <unit>. It is <evidence>: <note>. Formula: <formula>. Source: <source>."
     Every piece is a record field or the evidence table's note; nothing is generated. */
  function compose(rec, ctx) {
    ctx = ctx || {};
    var fmt = ctx.format || function (v, u) { return u ? v + ' ' + u : String(v); };
    var label = rec.label || rec.id, out = [];
    if (ctx.hidden === 'signin') out.push(label + ': the value is shown after you sign in.');
    else if (ctx.hidden === 'authority') out.push(label + ': the value is unavailable until this page\'s engine authority validates.');
    else if (rec.calc) out.push(label + ' = ' + (rec.display != null ? rec.display : fmt(rec.value, rec.unit)) + ' at the default inputs.');
    else if (rec.value !== undefined && rec.value !== null) out.push(label + ' = ' + fmt(rec.value, rec.unit) + '.');
    if (rec.evidenceClass) out.push('It is ' + rec.evidenceClass + (ctx.evidenceNote ? ': ' + ctx.evidenceNote : '') + (/[.;]$/.test(ctx.evidenceNote || '') ? '' : '.'));
    if (rec.formula) out.push('Formula: ' + rec.formula + (/[.)]$/.test(rec.formula) ? '' : '.'));
    var src = rec.source;
    if (src && src.ref) out.push('Source: ' + src.ref + (src.section ? ', ' + src.section : '') + '.');
    return { title: label, sentences: out };
  }

  var API = { tokens: tokens, numbers: numbers, search: search, compose: compose, THRESHOLD: THRESHOLD, version: '3.53.0' };
  root.RZAsk = API;
  if (typeof module !== 'undefined' && module.exports) { module.exports = API; return; }
  if (typeof document === 'undefined') return;

  /* ---------------------------------------------------------------- page UI */
  var script = document.currentScript, INDEX_URL = script && script.getAttribute('data-rz-ask-index');
  var CSS = '' +
    '.rz-ask-trigger{font:inherit;font-size:12px;letter-spacing:.04em;color:inherit;background:transparent;' +
      'border:1px solid currentColor;border-radius:4px;min-height:32px;min-width:44px;padding:0 10px;cursor:pointer;opacity:.9}' +
    '.rz-ask-trigger:hover,.rz-ask-trigger[aria-expanded="true"]{opacity:1}' +
    '.rz-ask-trigger:focus-visible,.rz-ask-panel :focus-visible{outline:2px solid #f0b429;outline-offset:2px}' +
    '.rz-ask-panel{position:fixed;z-index:8000;width:min(440px,calc(100vw - 32px));max-height:min(70vh,640px);overflow:auto;' +
      'background:#121316;color:#e6e9ee;border:1px solid #2e3138;border-radius:4px;padding:14px;' +
      'font:13px/1.5 "IBM Plex Sans",system-ui,sans-serif;text-align:left;box-sizing:border-box}' +
    '.rz-ask-panel[hidden]{display:none}' +
    '.rz-ask-panel label{display:block;font-weight:600;font-size:13px;margin:0 0 6px;color:#e6e9ee}' +
    '.rz-ask-row{display:flex;gap:8px}' +
    '.rz-ask-row input{flex:1;min-width:0;font:inherit;font-size:16px;color:#e6e9ee;background:#0b0c0e;border:1px solid #3a3e46;border-radius:4px;padding:8px 10px}' +
    '.rz-ask-btn{font:inherit;font-size:13px;color:#e6e9ee;background:#191b1f;border:1px solid #3a3e46;border-radius:4px;padding:7px 12px;cursor:pointer;min-height:36px}' +
    '.rz-ask-btn[disabled]{opacity:.6;cursor:not-allowed}' +
    '.rz-ask-note{margin:6px 0 0;font-size:12px;color:#a9b2bf}' +
    '.rz-ask-status{margin:10px 0 0;color:#c9d1dc}' +
    '.rz-ask-status a,.rz-ask-card a{color:#f0c060;text-decoration:underline;text-underline-offset:2px}' +
    '.rz-ask-cards{list-style:none;margin:10px 0 0;padding:0;display:flex;flex-direction:column;gap:8px}' +
    '.rz-ask-card{border:1px solid #2e3138;border-radius:4px;padding:10px;background:#16181c}' +
    '.rz-ask-card h3{margin:0 0 4px;font-size:13.5px;font-weight:600;color:#f2f4f7}' +
    '.rz-ask-card code{font:11.5px "JetBrains Mono",ui-monospace,monospace;color:#a9b2bf;word-break:break-all}' +
    '.rz-ask-card p{margin:4px 0;color:#d5dbe3}' +
    '.rz-ask-acts{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center;margin-top:6px}';

  var state = { index: null, loading: null, failed: false }, trigger, panel, input, submit, status, list, note;

  function el(tag, attrs, text) {
    var n = document.createElement(tag), k;
    for (k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    return n;
  }
  function indexUrl() {
    var v = root.RZ_VERSION ? ((INDEX_URL.indexOf('?') < 0 ? '?' : '&') + 'v=' + encodeURIComponent(root.RZ_VERSION)) : '';
    return INDEX_URL + v;
  }
  function setBusy(busy) {
    submit.disabled = !!busy;
    submit.textContent = busy ? 'Loading…' : 'Ask';
    if (busy) submit.setAttribute('title', 'Loading this page\'s records'); else submit.removeAttribute('title');
  }
  function load() {
    if (state.index) return Promise.resolve(state.index);
    if (state.loading) return state.loading;
    state.failed = false;
    setBusy(true);
    clear();
    state.loading = fetch(indexUrl(), { credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (j) {
      if (!j || !j.docs || !j.df) throw new Error('malformed index');
      state.index = j; state.loading = null; setBusy(false);
      return j;
    }, function (err) {
      state.loading = null; state.failed = true; setBusy(false);
      submit.disabled = true; submit.setAttribute('title', 'Search of this page\'s records is unavailable');
      showUnavailable();
      throw err;
    });
    return state.loading;
  }
  function clear() { status.textContent = ''; while (list.firstChild) list.removeChild(list.firstChild); }
  function showUnavailable() {
    clear();
    status.appendChild(document.createTextNode('Search of this page\'s records is unavailable. '));
    var retry = el('button', { type: 'button', 'class': 'rz-ask-btn', 'data-rz-ask-retry': '' }, 'Retry');
    retry.addEventListener('click', function () { load().then(function () { clear(); input.focus(); }, function () {}); });
    status.appendChild(retry);
  }
  function manualHref(anchor) { return state.index.manual + (anchor ? '#' + anchor : ''); }
  function recordFor(id) {
    var D = root.RZBasisDrawer;
    return (D && D.get && D.get(id)) || null;
  }
  function hiddenFor(id) {
    var D = root.RZBasisDrawer;
    if (D && D.authorityAvailable && !D.authorityAvailable()) return 'authority';
    if (document.querySelector('[data-rz-basis-gated="' + id.replace(/"/g, '') + '"]')) return 'signin';
    return null;
  }
  function card(hit) {
    var d = hit.doc, li = el('li', { 'class': 'rz-ask-card', 'data-rz-ask-cite': d.kind === 'record' ? d.id : d.manual + '#' + d.anchor });
    var acts = el('div', { 'class': 'rz-ask-acts' });
    if (d.kind === 'record') {
      var rec = recordFor(d.id) || d.rec, D = root.RZBasisDrawer;
      var c = compose(rec, { format: D && D.format, evidenceNote: D && D.evidenceInfo ? D.evidenceInfo(rec.evidenceClass).note : '', hidden: hiddenFor(d.id) });
      var h = el('h3', null, c.title);
      li.appendChild(h);
      li.appendChild(el('code', null, d.id));
      for (var i = 0; i < c.sentences.length; i++) li.appendChild(el('p', null, c.sentences[i]));
      var open = el('button', { type: 'button', 'class': 'rz-ask-btn', 'data-rz-ask-open': d.id }, 'Open basis');
      open.addEventListener('click', function () { if (root.RZBasisDrawer) root.RZBasisDrawer.open(d.id); });
      acts.appendChild(open);
      if (d.anchor) acts.appendChild(el('a', { href: manualHref(d.anchor) }, 'Manual: ' + d.anchorTitle));
    } else {
      li.appendChild(el('h3', null, d.title));
      li.appendChild(el('p', null, 'The manual covers this in section "' + d.title + '".'));
      acts.appendChild(el('a', { href: manualHref(d.anchor) }, 'Read the section'));
    }
    li.appendChild(acts);
    return li;
  }
  function ask(e) {
    if (e) e.preventDefault();
    var q = input.value.trim();
    if (!q) { input.focus(); return; }
    load().then(function (idx) {
      var r = search(idx, q);
      clear();
      if (r.miss) {
        status.appendChild(document.createTextNode('Not covered by this tool\'s records. '));
        status.appendChild(el('a', { href: idx.manual }, 'Open the manual'));
        return;
      }
      status.textContent = r.hits.length + (r.hits.length === 1 ? ' answer' : ' answers') + ' from this page\'s records.';
      for (var i = 0; i < r.hits.length; i++) list.appendChild(card(r.hits[i]));
    }, function () {});
  }
  function place() {
    var r = trigger.getBoundingClientRect(), w = Math.min(440, window.innerWidth - 32);
    var left = Math.min(Math.max(16, r.right - w), window.innerWidth - 16 - w);
    panel.style.left = Math.round(left) + 'px';
    panel.style.top = Math.round(Math.min(r.bottom + 8, window.innerHeight - 120)) + 'px';
  }
  function openPanel() {
    panel.hidden = false; trigger.setAttribute('aria-expanded', 'true'); place(); input.focus();
    /* opening the panel focuses the field; load here too, since a background tab gets no focus event */
    if (!state.index && !state.failed) load().catch(function () {});
  }
  function closePanel(restore) {
    if (panel.hidden) return;
    panel.hidden = true; trigger.setAttribute('aria-expanded', 'false');
    if (restore) trigger.focus();
  }
  function build(slot) {
    if (!document.getElementById('rz-ask-css')) {
      var st = el('style', { id: 'rz-ask-css' }); st.textContent = CSS; document.head.appendChild(st);
    }
    trigger = el('button', { type: 'button', 'class': 'rz-ask-trigger', 'aria-expanded': 'false', 'aria-controls': 'rz-ask-panel',
      title: 'Ask about this page. Answers come from this page\'s parameter records and manual, not from an AI.' }, 'Ask');
    slot.appendChild(trigger);
    panel = el('section', { id: 'rz-ask-panel', 'class': 'rz-ask-panel', 'aria-label': 'Ask about this page', hidden: '' });
    var form = el('form', { role: 'search' });
    form.appendChild(el('label', { 'for': 'rz-ask-q' }, 'Ask about this page'));
    var row = el('div', { 'class': 'rz-ask-row' });
    input = el('input', { id: 'rz-ask-q', type: 'text', autocomplete: 'off', placeholder: 'e.g. why is PUE this value', 'aria-describedby': 'rz-ask-note' });
    submit = el('button', { type: 'submit', 'class': 'rz-ask-btn' }, 'Ask');
    row.appendChild(input); row.appendChild(submit); form.appendChild(row);
    note = el('p', { id: 'rz-ask-note', 'class': 'rz-ask-note' }, 'Answers come from this page\'s records.');
    form.appendChild(note);
    panel.appendChild(form);
    status = el('p', { 'class': 'rz-ask-status', role: 'status', 'aria-live': 'polite' });
    list = el('ul', { 'class': 'rz-ask-cards' });
    panel.appendChild(status); panel.appendChild(list);
    document.body.appendChild(panel);
    trigger.addEventListener('click', function () { if (panel.hidden) openPanel(); else closePanel(false); });
    input.addEventListener('focus', function () { if (!state.index && !state.failed) load().catch(function () {}); });
    form.addEventListener('submit', ask);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !panel.hidden && !document.querySelector('#rz-basis-drawer[aria-hidden="false"]')) closePanel(true);
    });
    document.addEventListener('mousedown', function (e) {
      if (panel.hidden || panel.contains(e.target) || trigger.contains(e.target)) return;
      if (e.target.closest && e.target.closest('#rz-basis-drawer')) return;
      closePanel(false);
    });
    window.addEventListener('resize', function () { if (!panel.hidden) place(); });
    API.panel = panel; API.load = load;
  }
  function init() {
    var slot = document.querySelector('[data-rz-ask-slot]');
    if (!slot || !INDEX_URL || slot.querySelector('.rz-ask-trigger')) return;
    build(slot);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
