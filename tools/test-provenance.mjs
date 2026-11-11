#!/usr/bin/env node
/*
 * test-provenance.mjs — PRD-Q06 static gate (no browser, no network, node built-ins only).
 *
 *   node tools/test-provenance.mjs                 # registry + L1..L5 + unit tests U1..U14
 *   node tools/test-provenance.mjs --law L4        # one law (comma list allowed: --law L1,L3; U = unit tests)
 *   options: --strict (accepted; the gate is always strict) --verbose (every finding with context)
 *            --root <dir> (scan another tree, e.g. a worktree of an old commit) --registry <file>
 *
 * L1 10 cockpits declare data-rz-data-mode="simulated", load js/rz-telemetry-quality.js, one banner slot.
 * L2 21 registry panels carry a provenance line whose attributes equal the registry record and whose text
 *    equals the registry copy and RZProvenance.format(); js/rz-provenance.js exists within budget and is loaded.
 * L3 23 data-path fields carry aria-describedby -> their data-rz-provenance="simulated" line on the same page.
 * L4 0 live/real-time claims on 30 pages (PRD §3.1 F8 rules) and 0 retired phrases in generated artefacts.
 * L5 snapshot lines equal their dataset; no wall clock written into the snapshot time; gateway count derived.
 * U1..U14 unit tests of js/rz-provenance.js (PRD §20.1); SKIP with "module missing" until it exists.
 * Exit 1 on any failure (registry errors are E_REGISTRY and stop the run).
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';

const argv = process.argv.slice(2);
const opt = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const ROOT = path.resolve(opt('--root') || path.join(import.meta.dirname, '..'));
const REG_PATH = path.resolve(opt('--registry') || path.join(ROOT, 'tools/provenance-registry.json'));
const ONLY = opt('--law') ? opt('--law').toUpperCase().split(',') : null;
const VERBOSE = argv.includes('--verbose');
const want = (law) => !ONLY || ONLY.includes(law);
const MODULE_REL = 'js/rz-provenance.js';
const BUDGET = { raw: 8192, gzip: 3072 };
const KINDS = ['simulated', 'snapshot', 'model', 'fallback'];
const REC_KEYS = ['kind', 'basis', 'asOf', 'source', 'version', 'reason'];
const REC_ATTR = { kind: 'data-rz-provenance', basis: 'data-rz-prov-basis', asOf: 'data-rz-prov-asof',
  source: 'data-rz-prov-source', version: 'data-rz-prov-version', reason: 'data-rz-prov-reason' };
const ASOF_RE = '^\\d{4}(-\\d{2}(-\\d{2}(T\\d{2}:\\d{2}(:\\d{2})?(Z|[+-]\\d{2}:\\d{2}))?)?)?$';
const EXPECT_TOTALS = { cockpits: 10, panels: 21, fields: 23, pagesAny: 25, pagesPhrase: 5, fallbacks: 4 };

const abs = (rel) => path.join(ROOT, rel);
const exists = (rel) => rel.endsWith('/') ? fs.existsSync(abs(rel + 'index.html')) : fs.existsSync(abs(rel));
const read = (rel) => fs.readFileSync(abs(rel.endsWith('/') ? rel + 'index.html' : rel), 'utf8');
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const failed = [];
const out = (s) => process.stdout.write(s + '\n');
function report(law, ok, headline, details = [], limit = 12) {
  out(`${ok ? 'PASS' : 'FAIL'} ${law} ${headline}`);
  const shown = VERBOSE ? details : details.slice(0, limit);
  for (const d of shown) out('    ' + d);
  if (shown.length < details.length) out(`    … ${details.length - shown.length} more (--verbose)`);
  if (!ok) failed.push(law);
}

/* ---------- HTML: a small tolerant tree builder ---------- */
const VOID = new Set('area base br col embed hr img input link meta param source track wbr'.split(' '));
const SKIP = new Set(['script', 'style', 'noscript', 'template']);
const RCDATA = new Set(['title', 'textarea']);
const BLOCK = new Set(('address article aside blockquote body br button dd details div dl dt fieldset figcaption figure ' +
  'footer form h1 h2 h3 h4 h5 h6 head header hr html label li main nav ol option p pre section select summary ' +
  'table tbody td tfoot th thead title tr ul').split(' '));
const INLINE_JOIN = new Set('a abbr b cite code data em i kbd mark q s small strong sub sup time u var wbr'.split(' '));
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', middot: '·',
  hellip: '…', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', times: '×', deg: '°', rarr: '→', larr: '←',
  copy: '©', reg: '®', trade: '™', bull: '•', sect: '§', micro: 'µ', plusmn: '±', le: '≤', ge: '≥', shy: '', laquo: '«', raquo: '»' };
const ENT_RE = /&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi;
function entity(name, whole) {
  if (name[0] === '#') {
    const cp = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
    return Number.isFinite(cp) ? String.fromCodePoint(cp) : whole;
  }
  return ENT[name.toLowerCase()] ?? whole;
}
const decode = (s) => s.replace(ENT_RE, (w, n) => entity(n, w));
/** decode with a per-char map back to source offsets */
function decodeMap(raw, base) {
  let s = '', i = 0; const pos = [];
  ENT_RE.lastIndex = 0; let m;
  while ((m = ENT_RE.exec(raw))) {
    for (; i < m.index; i++) { s += raw[i]; pos.push(base + i); }
    const d = entity(m[1], m[0]);
    for (const ch of d) { s += ch; pos.push(base + m.index); }
    i = m.index + m[0].length;
  }
  for (; i < raw.length; i++) { s += raw[i]; pos.push(base + i); }
  return { s, pos };
}

function parseHtml(src) {
  const root = { tag: '#root', attrs: {}, children: [], parent: null, start: 0 };
  const TAG = /<([a-zA-Z][\w:-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*(\/?)>/y;
  const ATTR = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let cur = root, i = 0;
  const text = (a, b) => { if (b > a) cur.children.push({ text: src.slice(a, b), start: a, parent: cur }); };
  while (i < src.length) {
    const lt = src.indexOf('<', i);
    if (lt < 0) { text(i, src.length); break; }
    text(i, lt);
    if (src.startsWith('<!--', lt)) { const e = src.indexOf('-->', lt + 4); i = e < 0 ? src.length : e + 3; continue; }
    if (src[lt + 1] === '!' || src[lt + 1] === '?') { const e = src.indexOf('>', lt); i = e < 0 ? src.length : e + 1; continue; }
    if (src[lt + 1] === '/') {
      const m = /^<\/([a-zA-Z][\w:-]*)\s*>/.exec(src.slice(lt, lt + 80));
      if (!m) { text(lt, lt + 1); i = lt + 1; continue; }
      const name = m[1].toLowerCase();
      let k = cur; while (k && k.tag !== name) k = k.parent;
      if (k && k !== root) cur = k.parent;
      i = lt + m[0].length; continue;
    }
    TAG.lastIndex = lt; const m = TAG.exec(src);
    if (!m) { text(lt, lt + 1); i = lt + 1; continue; }
    const name = m[1].toLowerCase(), attrs = {}, attrPos = {};
    ATTR.lastIndex = 0; let a;
    const attrBase = lt + 1 + m[1].length;
    while ((a = ATTR.exec(m[2]))) {
      const k = a[1].toLowerCase();
      if (!(k in attrs)) { attrs[k] = decode(a[2] ?? a[3] ?? a[4] ?? ''); attrPos[k] = attrBase + a.index; }
    }
    const el = { tag: name, attrs, attrPos, children: [], parent: cur, start: lt };
    cur.children.push(el); i = lt + m[0].length;
    if (SKIP.has(name) || RCDATA.has(name)) {
      const close = new RegExp(`</${name}\\s*>`, 'ig'); close.lastIndex = i;
      const c = close.exec(src); const end = c ? c.index : src.length;
      if (RCDATA.has(name)) el.children.push({ text: src.slice(i, end), start: i, parent: el });
      else { el.skipped = true; el.raw = src.slice(i, end); el.rawStart = i; }
      i = c ? c.index + c[0].length : src.length; continue;
    }
    if (!VOID.has(name) && !m[3]) cur = el;
  }
  return root;
}
function* elements(node) {
  for (const ch of node.children) if (ch.tag) { yield ch; yield* elements(ch); }
}
function textContent(el) {
  let s = '';
  (function walk(n) { for (const c of n.children) { if (c.text !== undefined) s += c.text; else if (!c.skipped) walk(c); } })(el);
  return decode(s).replace(/\s+/g, ' ').trim();
}

/* selectors: tag, #id, .class, [attr], [attr="v"], :nth-of-type(n); combinators ' ' and '>' */
function parseCompound(t) {
  const c = { tag: null, id: null, cls: [], attrs: [], nth: null };
  const re = /([a-zA-Z][\w-]*)|#([\w-]+)|\.([\w-]+)|\[([\w:-]+)(?:="([^"]*)")?\]|:nth-of-type\((\d+)\)/y;
  let i = 0, m;
  while (i < t.length) {
    re.lastIndex = i; m = re.exec(t);
    if (!m || m[0] === '') throw new Error(`unsupported selector part "${t.slice(i)}"`);
    if (m[1]) c.tag = m[1].toLowerCase(); else if (m[2]) c.id = m[2]; else if (m[3]) c.cls.push(m[3]);
    else if (m[4]) c.attrs.push([m[4].toLowerCase(), m[5]]); else c.nth = +m[6];
    i = re.lastIndex;
  }
  return c;
}
function parseSel(sel) {
  const parts = []; let comb = ' ';
  for (const tok of sel.trim().split(/\s*(>)\s*|\s+/).filter(Boolean)) {
    if (tok === '>') { comb = '>'; continue; }
    parts.push({ comb, c: parseCompound(tok) }); comb = ' ';
  }
  return parts;
}
function matchCompound(el, c) {
  if (!el || !el.tag || el.tag === '#root') return false;
  if (c.tag && el.tag !== c.tag) return false;
  if (c.id && el.attrs.id !== c.id) return false;
  const cls = (el.attrs.class || '').split(/\s+/);
  if (c.cls.some((k) => !cls.includes(k))) return false;
  if (c.attrs.some(([k, v]) => !(k in el.attrs) || (v !== undefined && el.attrs[k] !== v))) return false;
  if (c.nth) {
    const sibs = el.parent.children.filter((s) => s.tag === el.tag);
    if (sibs.indexOf(el) + 1 !== c.nth) return false;
  }
  return true;
}
function matches(el, parts, i) {
  if (!matchCompound(el, parts[i].c)) return false;
  if (i === 0) return true;
  if (parts[i].comb === '>') return matches(el.parent, parts, i - 1);
  for (let a = el.parent; a; a = a.parent) if (matches(a, parts, i - 1)) return true;
  return false;
}

const pageCache = new Map();
function page(rel) {
  if (pageCache.has(rel)) return pageCache.get(rel);
  const src = read(rel), root = parseHtml(src);
  const nl = []; for (let i = src.indexOf('\n'); i >= 0; i = src.indexOf('\n', i + 1)) nl.push(i);
  const lineOf = (off) => { let lo = 0, hi = nl.length; while (lo < hi) { const m = (lo + hi) >> 1; if (nl[m] < off) lo = m + 1; else hi = m; } return lo + 1; };
  const all = [...elements(root)];
  const qsa = (sel) => { const p = parseSel(sel); return all.filter((el) => matches(el, p, p.length - 1)); };
  const byId = (id) => all.find((el) => el.attrs.id === id) || null;
  const loads = (file) => all.some((el) => el.tag === 'script' && new RegExp(`(^|/)${esc(file)}(\\?|$)`).test(el.attrs.src || ''));
  const pg = { rel, src, root, all, lineOf, qsa, byId, loads };
  pageCache.set(rel, pg); return pg;
}
const recordOf = (el) => Object.fromEntries(REC_KEYS.filter((k) => REC_ATTR[k] in el.attrs).map((k) => [k, el.attrs[REC_ATTR[k]]]));

/* ---------- registry schema (embedded) ---------- */
const STR = { type: 'string', minLength: 1 };
const STRS = { type: 'array', minItems: 1, items: STR };
const RECORD = { type: 'object', required: ['kind', 'basis'], properties: {
  kind: { enum: KINDS }, basis: { type: 'string', minLength: 1, maxLength: 200, pattern: '^[^<>]*$' },
  asOf: { type: 'string', pattern: ASOF_RE }, source: { type: 'string', minLength: 1, maxLength: 200 },
  version: { type: 'string', pattern: '^[0-9A-Za-z.\\-]{1,40}$' }, reason: { type: 'string', minLength: 1, maxLength: 200 } } };
const SCHEMA = { type: 'object', required: ['version', 'cockpits', 'panels', 'fields', 'parityCounts', 'liveScan', 'fallbacks'], properties: {
  version: { enum: [1] },
  cockpits: { type: 'array', items: { type: 'object', required: ['page'], properties: { page: STR, compactSlot: { type: 'boolean' }, gate: STR } } },
  panels: { type: 'array', items: { type: 'object', required: ['id', 'page', 'kind', 'record', 'text'], properties: {
    id: { type: 'string', pattern: '^rz-prov-[a-z0-9-]+$' }, page: STR, kind: { enum: KINDS }, record: RECORD, text: STR,
    runtime: { type: 'boolean' }, parity: { type: 'object', required: ['file'], properties: { file: STR } } } } },
  fields: { type: 'array', items: { type: 'object', required: ['page', 'selector', 'line'], properties: {
    page: STR, selector: STR, line: { type: 'string', pattern: '^rz-prov-' }, count: { type: 'integer', minimum: 1 } } } },
  parityCounts: { type: 'array', items: { type: 'object', required: ['page', 'selector', 'countFrom', 'expect'], properties: {
    page: STR, selector: STR, expect: { type: 'integer', minimum: 0 },
    countFrom: { type: 'object', required: ['file', 'block'], properties: { file: STR, block: STR, rangeTag: STR, singleTag: STR } } } } },
  clockChecks: { type: 'array', items: { type: 'object', required: ['page', 'target'], properties: { page: STR, target: STR } } },
  liveScan: { type: 'object', required: ['pagesAny', 'pagesPhrase', 'dataNouns', 'negations', 'negationWindow', 'generated', 'retired'], properties: {
    pagesAny: STRS, pagesPhrase: STRS, dataNouns: STRS, negations: STRS, negationWindow: { type: 'integer', minimum: 1 }, generated: STRS, retired: STRS } },
  fallbacks: { type: 'array', items: { type: 'object', required: ['id', 'page', 'line', 'force'], properties: {
    id: STR, page: STR, line: STR, force: { type: 'object' }, expectCode: { enum: ['F-PLANT-MISSING', 'F-PLANT-ERROR', 'F-DEBUG', 'F-ENGINE-MISSING', 'F-BOTH'] } } } } } };
function checkSchema(v, s, at, errs) {
  if (s.enum) { if (!s.enum.includes(v)) errs.push(`${at}: ${JSON.stringify(v)} not one of ${s.enum.join('|')}`); return; }
  const t = Array.isArray(v) ? 'array' : v === null ? 'null' : Number.isInteger(v) && s.type === 'integer' ? 'integer' : typeof v;
  if (s.type && t !== s.type) { errs.push(`${at}: expected ${s.type}, got ${t}`); return; }
  if (t === 'string') {
    if (s.minLength && v.length < s.minLength) errs.push(`${at}: empty`);
    if (s.maxLength && v.length > s.maxLength) errs.push(`${at}: longer than ${s.maxLength}`);
    if (s.pattern && !new RegExp(s.pattern).test(v)) errs.push(`${at}: "${v}" does not match ${s.pattern}`);
  }
  if (t === 'integer' && s.minimum !== undefined && v < s.minimum) errs.push(`${at}: below ${s.minimum}`);
  if (t === 'array') {
    if (s.minItems && v.length < s.minItems) errs.push(`${at}: fewer than ${s.minItems} items`);
    if (s.items) v.forEach((x, i) => checkSchema(x, s.items, `${at}[${i}]`, errs));
  }
  if (t === 'object') {
    for (const k of s.required || []) if (!(k in v)) errs.push(`${at}: missing "${k}"`);
    for (const [k, sub] of Object.entries(s.properties || {})) if (k in v) checkSchema(v[k], sub, `${at}.${k}`, errs);
  }
}
function validateRegistry(reg) {
  const errs = []; checkSchema(reg, SCHEMA, 'registry', errs);
  if (errs.length) return errs;
  const dup = (list, what) => { const seen = new Set(); for (const x of list) { if (seen.has(x)) errs.push(`duplicate ${what} "${x}"`); seen.add(x); } };
  dup(reg.cockpits.map((c) => c.page), 'cockpit');
  dup(reg.panels.map((p) => p.id), 'panel id');
  dup(reg.fallbacks.map((f) => f.id), 'fallback id');
  dup(reg.fields.map((f) => f.page + ' ' + f.selector), 'field');
  dup([...reg.liveScan.pagesAny, ...reg.liveScan.pagesPhrase], 'scan page');
  const files = [...reg.cockpits.map((c) => c.page), ...reg.panels.map((p) => p.page), ...reg.panels.filter((p) => p.parity).map((p) => p.parity.file),
    ...reg.fields.map((f) => f.page), ...reg.parityCounts.flatMap((p) => [p.page, p.countFrom.file]), ...(reg.clockChecks || []).map((c) => c.page),
    ...reg.liveScan.pagesAny, ...reg.liveScan.pagesPhrase, ...reg.liveScan.generated, ...reg.fallbacks.map((f) => f.page)];
  for (const f of new Set(files)) if (!exists(f)) errs.push(`page/file missing on disk: ${f}`);
  const panelById = new Map(reg.panels.map((p) => [p.id, p]));
  for (const p of reg.panels) {
    if (p.record.kind !== p.kind) errs.push(`${p.id}: kind ${p.kind} != record.kind ${p.record.kind}`);
    if (p.kind === 'snapshot') for (const k of ['asOf', 'source', 'version']) if (!p.record[k]) errs.push(`${p.id}: snapshot without ${k}`);
    if (p.kind === 'snapshot' && !p.parity) errs.push(`${p.id}: snapshot without a parity entry`);
  }
  for (const f of reg.fields) {
    const p = panelById.get(f.line);
    if (!p) errs.push(`field ${f.page} ${f.selector}: line "${f.line}" is not declared by any panel`);
    else if (p.page !== f.page) errs.push(`field ${f.page} ${f.selector}: line "${f.line}" is on ${p.page}`);
    try { parseSel(f.selector); } catch (e) { errs.push(`field ${f.page}: ${e.message}`); }
  }
  for (const p of reg.parityCounts) try { parseSel(p.selector); } catch (e) { errs.push(`parityCounts ${p.page}: ${e.message}`); }
  const totals = { cockpits: reg.cockpits.length, panels: reg.panels.length, fields: reg.fields.reduce((n, f) => n + (f.count || 1), 0),
    pagesAny: reg.liveScan.pagesAny.length, pagesPhrase: reg.liveScan.pagesPhrase.length, fallbacks: reg.fallbacks.length };
  for (const [k, n] of Object.entries(EXPECT_TOTALS)) if (totals[k] !== n) errs.push(`${k}: ${totals[k]}, PRD-Q06 fixes ${n}`);
  return errs;
}

/* ---------- L1 ---------- */
function lawL1(reg) {
  let ok = 0; const bad = [];
  for (const c of reg.cockpits) {
    const pg = page(c.page), why = [];
    const body = pg.qsa('body')[0];
    if (!body || body.attrs['data-rz-data-mode'] !== 'simulated') why.push('<body> lacks data-rz-data-mode="simulated"');
    if (!pg.loads('js/rz-telemetry-quality.js')) why.push('js/rz-telemetry-quality.js not loaded');
    const slots = pg.qsa('[data-rz-telemetry-banner-slot]');
    if (slots.length !== 1) why.push(`${slots.length} banner slots`);
    else if (c.compactSlot && !('data-rz-telemetry-compact' in slots[0].attrs)) why.push('banner slot is not compact');
    if (why.length) bad.push(`${c.page}: ${why.join('; ')}`); else ok++;
  }
  report('L1', ok === reg.cockpits.length, `${ok}/${reg.cockpits.length} cockpits declare simulated, load the banner, have one slot`, bad);
}

/* ---------- L2 ---------- */
function lawL2(reg, mod) {
  let ok = 0; const bad = [];
  const mp = abs(MODULE_REL);
  if (!fs.existsSync(mp)) bad.push(`${MODULE_REL} missing`);
  else {
    const buf = fs.readFileSync(mp), gz = zlib.gzipSync(buf, { level: 9 }).length;
    if (buf.length > BUDGET.raw || gz > BUDGET.gzip) bad.push(`${MODULE_REL} ${buf.length} B raw / ${gz} B gzip, budget ${BUDGET.raw} / ${BUDGET.gzip}`);
    if (!mod || typeof mod.format !== 'function') bad.push(`${MODULE_REL} does not export format()`);
  }
  const fmt = mod && typeof mod.format === 'function';
  if (fmt) for (const p of reg.panels) {
    const t = mod.format(p.record);
    if (t !== p.text) bad.push(`registry ${p.id}: format(record) "${t}" != registry text`);
  }
  for (const p of reg.panels) {
    const pg = page(p.page), el = pg.byId(p.id), why = [];
    if (!el) { bad.push(`${p.page}: no #${p.id}`); continue; }
    const rec = recordOf(el), txt = textContent(el);
    for (const k of REC_KEYS) if ((rec[k] ?? null) !== (p.record[k] ?? null)) why.push(`${REC_ATTR[k]}="${rec[k] ?? ''}" (registry "${p.record[k] ?? ''}")`);
    if (txt !== p.text) why.push(`text "${txt}" != registry copy`);
    if (fmt) {
      const v = mod.validate(rec);
      if (!v.ok) why.push(v.errors.map((e) => e.code).join(','));
      if (mod.format(rec) !== txt) why.push('E_TEXT');
    }
    if (!pg.loads(MODULE_REL)) why.push(`page does not load ${MODULE_REL}`);
    if (why.length) bad.push(`${p.page}#${p.id}: ${why.join('; ')}`); else ok++;
  }
  const lineFails = reg.panels.length - ok;
  report('L2', ok === reg.panels.length && bad.length === lineFails, `${ok}/${reg.panels.length} panel lines valid and equal to format()`, bad);
}

/* ---------- L3 ---------- */
function lawL3(reg) {
  let ok = 0, total = 0; const bad = [];
  for (const f of reg.fields) {
    const pg = page(f.page), els = pg.qsa(f.selector), n = f.count || 1;
    total += n;
    if (els.length !== n) bad.push(`${f.page} ${f.selector}: registry ${n}, page has ${els.length}${els.length > n ? ' (every match must comply)' : ''}`);
    const line = pg.byId(f.line);
    const lineOk = !!line && line.attrs['data-rz-provenance'] === 'simulated';
    let good = 0;
    for (const el of els) {
      const ids = (el.attrs['aria-describedby'] || '').split(/\s+/).filter(Boolean);
      if (ids.includes(f.line) && lineOk) good++;
      else bad.push(`${f.page}:${pg.lineOf(el.start)} ${f.label || f.selector}: aria-describedby="${el.attrs['aria-describedby'] || ''}"${lineOk ? '' : `, #${f.line} absent or not simulated`}`);
    }
    ok += Math.min(good, n);
  }
  report('L3', ok === total && bad.length === 0, `${ok}/${total} data-path fields described by a simulated line`, bad);
}

/* ---------- L4 ---------- */
const BOUNDARY = /[.;:!?|—]/;
function isCiteLink(el) {
  return el.tag === 'a' && /^https?:\/\//i.test(el.attrs.href || '') &&
    /^(https?:\/\/)?(www\.)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(textContent(el));
}
function textStream(pg) {
  const st = { s: '', pos: [], cite: [] };
  const push = (ch, p, c) => { st.s += ch; st.pos.push(p); st.cite.push(c); };
  const brk = (p) => { if (st.s && !st.s.endsWith('|')) push('|', p, false); };
  (function walk(node, cite) {
    for (const ch of node.children) {
      if (ch.text !== undefined) {
        const d = decodeMap(ch.text, ch.start);
        for (let i = 0; i < d.s.length; i++) {
          if (/\s/.test(d.s[i])) { if (st.s && !/[\s|]$/.test(st.s)) push(' ', d.pos[i], cite); } else push(d.s[i], d.pos[i], cite);
        }
      } else if (!ch.skipped) {
        const blk = BLOCK.has(ch.tag), sep = !blk && !INLINE_JOIN.has(ch.tag);
        const space = () => { if (st.s && !/[\s|]$/.test(st.s)) push(' ', ch.start, cite); };
        if (blk) brk(ch.start); else if (sep) space();
        walk(ch, cite || isCiteLink(ch));
        if (blk) brk(ch.start); else if (sep) space();
      }
    }
  })(pg.root, false);
  return st;
}
const META_KEYS = /^(description|og:(title|description|image:alt|site_name)|twitter:(title|description|image:alt))$/i;
function attrStreams(pg) {
  const list = [];
  for (const el of pg.all) {
    if (el.skipped) continue;
    for (const a of ['aria-label', 'alt', 'title', 'placeholder']) if (a in el.attrs) list.push({ where: a, el, a });
    if (el.tag === 'meta' && META_KEYS.test(el.attrs.name || el.attrs.property || '') && 'content' in el.attrs) list.push({ where: 'meta ' + (el.attrs.name || el.attrs.property), el, a: 'content' });
  }
  return list.map(({ where, el, a }) => {
    const s = el.attrs[a].replace(/\s+/g, ' ');
    const p = el.attrPos[a] ?? el.start;
    return { where, s, pos: Array(s.length).fill(p), cite: Array(s.length).fill(false) };
  });
}
function scanPage(rel, mode, ls) {
  const pg = page(rel), found = [];
  const nouns = ls.dataNouns.map((n) => esc(n.replace(/s$/i, '')) + 's?').join('|');
  const re = mode === 'any' ? /\b(live|real[ -]?time)\b/gi : new RegExp(`\\b(live|real[ -]?time)[ -](?:${nouns})\\b`, 'gi');
  const neg = new RegExp(ls.negations.map((n) => n.endsWith('-') ? '\\b' + esc(n) : `\\b${esc(n)}\\b`).join('|'), 'i');
  for (const st of [{ where: 'text', ...textStream(pg) }, ...attrStreams(pg)]) {
    re.lastIndex = 0; let m;
    while ((m = re.exec(st.s))) {
      const i = m.index;
      let w = st.s.slice(Math.max(0, i - ls.negationWindow), i);
      for (let k = w.length - 1; k >= 0; k--) if (BOUNDARY.test(w[k])) { w = w.slice(k + 1); break; }
      const exempt = st.cite[i] ? 'cited URL link text' : neg.test(w) ? `negation "${w.match(neg)[0]}"` : null;
      found.push({ page: rel, line: pg.lineOf(st.pos[i]), where: st.where, exempt,
        ctx: st.s.slice(Math.max(0, i - 35), i + m[0].length + 25).replace(/\|/g, ' / ').trim() });
    }
  }
  return found;
}
function lawL4(reg) {
  const ls = reg.liveScan, all = [];
  for (const p of ls.pagesAny) all.push(...scanPage(p, 'any', ls));
  for (const p of ls.pagesPhrase) all.push(...scanPage(p, 'phrase', ls));
  const hits = all.filter((f) => !f.exempt), exempt = all.filter((f) => f.exempt);
  const byPage = new Map();
  for (const f of hits) { if (!byPage.has(f.page)) byPage.set(f.page, []); byPage.get(f.page).push(f.line); }
  const details = [...byPage].map(([p, lines]) => {
    const c = new Map(); lines.sort((x, y) => x - y).forEach((l) => c.set(l, (c.get(l) || 0) + 1));
    return `${p} ${lines.length} [${[...c].map(([l, n]) => n > 1 ? `${l}×${n}` : l).join(', ')}]`;
  });
  if (VERBOSE) for (const f of hits) details.push(`  ${f.page}:${f.line} (${f.where}) …${f.ctx}…`);
  for (const f of exempt) details.push(`EXEMPT ${f.page}:${f.line} (${f.where}, ${f.exempt}) …${f.ctx}…`);
  const gen = [];
  for (const file of ls.generated) {
    const src = read(file), per = [];
    for (const ph of ls.retired) { const n = src.split(ph).length - 1; if (n) per.push(`"${ph}" ×${n}`); }
    if (per.length) gen.push({ file, n: per.reduce((a, s) => a + +s.split('×')[1], 0), per });
  }
  const genN = gen.reduce((a, g) => a + g.n, 0);
  for (const g of gen) details.push(`GENERATED ${g.file} ${g.n}: ${g.per.join(', ')}`);
  const pages = ls.pagesAny.length + ls.pagesPhrase.length;
  report('L4', hits.length === 0 && genN === 0,
    `${hits.length} findings on ${byPage.size}/${pages} pages (${exempt.length} exempt); generated artefacts: ${genN} retired-phrase hits in ${gen.length}/${ls.generated.length} files`,
    details, 1e9);
}

/* ---------- L5 ---------- */
const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
function datasetValues(par) {
  const src = read(par.file);
  if (par.versionRegex) {
    const m = new RegExp(par.versionRegex).exec(src), v = m ? m[1] : null;
    return { version: v, asOf: par.asOfEqualsVersion ? v : par.asOfLiteral ?? null };
  }
  const noop = () => {};
  const ctx = { window: {}, console: { log: noop, warn: noop, error: noop, info: noop } };
  ctx.window.window = ctx.window; ctx.self = ctx.window;
  vm.createContext(ctx); vm.runInContext(src, ctx, { timeout: 5000, filename: par.file });
  const g = ctx.window[par.global] ?? ctx[par.global];
  if (!g) throw new Error(`${par.file} defines no ${par.global}`);
  let asOf = par.asOfLiteral ?? null;
  if (par.asOf) asOf = getPath(g, par.asOf);
  if (par.asOfMax) { const [arr, key] = par.asOfMax.split('[].'); asOf = String(Math.max(...getPath(g, arr).map((r) => r[key]))); }
  return { version: getPath(g, par.version), asOf };
}
function enclosingBlock(src, i) {
  let depth = 0, a = i;
  for (; a >= 0; a--) { if (src[a] === '}') depth++; else if (src[a] === '{') { if (depth === 0) break; depth--; } }
  let b = a + 1; depth = 1;
  for (; b < src.length && depth; b++) { if (src[b] === '{') depth++; else if (src[b] === '}') depth--; }
  return src.slice(Math.max(0, a - 120), b);
}
function lawL5(reg) {
  const fails = [], details = [];
  // (a) snapshot lines equal their dataset
  let present = 0, stale = 0; const snaps = reg.panels.filter((p) => p.parity);
  for (const p of snaps) {
    let d; try { d = datasetValues(p.parity); } catch (e) { details.push(`${p.id}: dataset unreadable: ${e.message}`); stale++; continue; }
    if (d.version !== p.record.version || d.asOf !== p.record.asOf) { stale++; details.push(`${p.id}: registry ${p.record.asOf}/${p.record.version} != dataset ${d.asOf}/${d.version} (${p.parity.file})`); }
    const el = page(p.page).byId(p.id);
    if (!el) continue;
    const r = recordOf(el);
    if (r.version === d.version && r.asOf === d.asOf) present++;
    else details.push(`${p.page}#${p.id}: line ${r.asOf}/${r.version} != dataset ${d.asOf}/${d.version}`);
  }
  if (present !== snaps.length || stale) { fails.push('parity'); details.unshift(`parity: ${present}/${snaps.length} snapshot lines equal their dataset; registry records vs datasets: ${snaps.length - stale}/${snaps.length} equal`); }
  else details.unshift(`parity: ${present}/${snaps.length} snapshot lines equal their dataset`);
  // (b) no wall clock written into the snapshot time
  for (const c of reg.clockChecks || []) {
    const pg = page(c.page), why = [];
    for (const s of pg.all.filter((e) => e.tag === 'script' && e.raw)) {
      const at = (k) => pg.lineOf(s.rawStart + k);
      const iv = /setInterval\(\s*updateClock/.exec(s.raw); if (iv) why.push(`setInterval(updateClock at :${at(iv.index)}`);
      for (let k = s.raw.indexOf(c.target); k >= 0; k = s.raw.indexOf(c.target, k + 1)) {
        if (/new Date\(\s*\)/.test(enclosingBlock(s.raw, k))) why.push(`new Date() feeds #${c.target} at :${at(k)}`);
      }
    }
    if (why.length) { fails.push('clock'); details.push(`clock ${c.page}: ${why.join('; ')}`); } else details.push(`clock ${c.page}: no wall clock feeds #${c.target}`);
  }
  // (c) restated counts equal the count derived from the page's own model
  for (const pc of reg.parityCounts) {
    const src = read(pc.countFrom.file), b = src.indexOf(pc.countFrom.block);
    let derived = null;
    if (b >= 0) {
      let e = b + pc.countFrom.block.length, depth = 1;
      for (; e < src.length && depth; e++) { if (src[e] === '[') depth++; else if (src[e] === ']') depth--; }
      const blk = src.slice(b, e); derived = 0;
      if (pc.countFrom.rangeTag) for (const m of blk.matchAll(new RegExp(pc.countFrom.rangeTag, 'g'))) derived += +m[2] - +m[1] + 1;
      if (pc.countFrom.singleTag) derived += (blk.match(new RegExp(esc(pc.countFrom.singleTag), 'g')) || []).length;
    }
    const el = page(pc.page).qsa(pc.selector)[0], shown = el ? textContent(el) : null;
    const first = shown && shown.match(/\d+/) ? +shown.match(/\d+/)[0] : null;
    const ok = derived === pc.expect && first === pc.expect;
    if (!ok) fails.push('count ' + pc.selector);
    details.push(`count ${pc.page} ${pc.selector}: shows "${shown}", model derives ${derived}, expect ${pc.expect}`);
  }
  report('L5', fails.length === 0, fails.length ? `${fails.length} failures (${fails.join(', ')})` : 'restated figures equal their source', details);
}

/* ---------- U1..U14 ---------- */
function loadModule() {
  const p = abs(MODULE_REL);
  if (!fs.existsSync(p)) return null;
  try { const m = createRequire(import.meta.url)(p); if (m && typeof m.format === 'function') return m; } catch { /* fall through to vm */ }
  const ctx = { window: {}, module: { exports: {} }, console };
  ctx.exports = ctx.module.exports; ctx.window.window = ctx.window;
  vm.createContext(ctx); vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: MODULE_REL });
  const m = Object.keys(ctx.module.exports).length ? ctx.module.exports : ctx.window.RZProvenance;
  return m || { __loadError: new Error('neither module.exports nor window.RZProvenance set') };
}
function units(M) {
  if (!M) { out(`SKIP U1-U14 module missing (${MODULE_REL}): 14 unit tests not run, not counted`); return; }
  if (M.__loadError) { report('U', false, `module failed to load: ${M.__loadError.message}`); return; }
  const BASE = { kind: 'snapshot', basis: 'representative evening peak', asOf: '2026-05-01T18:00:00+07:00',
    source: 'PLN AR 2024; RUPTL 2025–2034; BPS 2024; IEA Indonesia 2024', version: '2026-05-01-v5' };
  const eq = (got, exp) => got === exp || `got "${got}", expected "${exp}"`;
  const asOf = (a, frag) => () => { const t = M.format({ ...BASE, asOf: a }); return t.includes(` · as of ${frag} · `) || `got "${t}"`; };
  const code = (rec, c) => () => { const v = M.validate(rec); return (v && v.ok === false && v.errors.some((e) => e.code === c)) || `got ${JSON.stringify(v)}`; };
  const drop = (k) => { const r = { ...BASE }; delete r[k]; return r; };
  const T = [
    ['U1', () => eq(M.format(BASE), 'Snapshot · representative evening peak · as of 1 May 2026, 18:00 WIB · PLN AR 2024; RUPTL 2025–2034; BPS 2024; IEA Indonesia 2024 · data 2026-05-01-v5')],
    ['U2', asOf('2024', '2024')], ['U3', asOf('2024-06', 'Jun 2024')], ['U4', asOf('2026-04-29', '29 Apr 2026')],
    ['U5', asOf('2026-04-29T00:00Z', '29 Apr 2026, 00:00 UTC')], ['U6', asOf('2026-04-29T09:30+05:30', '29 Apr 2026, 09:30 UTC+05:30')],
    ['U7', code(drop('asOf'), 'E_ASOF')], ['U8', code(drop('source'), 'E_SOURCE')], ['U9', code({ ...BASE, version: 'v5 final' }, 'E_VERSION')],
    ['U10', code({ ...BASE, kind: 'live' }, 'E_KIND')], ['U11', code({ ...BASE, kind: 'telemetry' }, 'E_KIND')],
    ['U12', () => eq(M.format({ kind: 'fallback', basis: 'lab legacy model', reason: 'plant engine not loaded; physical figures may differ from the plant engine' }),
      'Fallback · lab legacy model · plant engine not loaded; physical figures may differ from the plant engine')],
    ['U13', code({ kind: 'simulated', basis: '<script>alert(1)</script>' }, 'E_BASIS')],
    ['U14', () => eq(Object.keys(M).sort().join(','), ['version', 'KINDS', 'format', 'validate', 'fromElement', 'mark', 'clear', 'audit'].sort().join(','))],
  ];
  const bad = [];
  for (const [id, fn] of T) { let r; try { r = fn(); } catch (e) { r = `threw ${e.message}`; } if (r !== true) bad.push(`${id}: ${r}`); }
  report('U', bad.length === 0, `${T.length - bad.length}/${T.length} unit tests (U1-U14)`, bad, 14);
}

/* ---------- main ---------- */
let reg;
try { reg = JSON.parse(fs.readFileSync(REG_PATH, 'utf8')); } catch (e) { out(`FAIL REGISTRY E_REGISTRY cannot read ${REG_PATH}: ${e.message}`); process.exit(1); }
const regErrs = validateRegistry(reg);
if (regErrs.length) { report('REGISTRY', false, `E_REGISTRY ${regErrs.length} errors in ${path.relative(ROOT, REG_PATH)}`, regErrs, 40); process.exit(1); }
out(`PASS REGISTRY ${reg.cockpits.length} cockpits, ${reg.panels.length} panels, ${reg.fields.reduce((n, f) => n + (f.count || 1), 0)} fields, ` +
  `${reg.liveScan.pagesAny.length}+${reg.liveScan.pagesPhrase.length} scan pages, ${reg.fallbacks.length} fallbacks; all pages exist (root ${ROOT})`);
let M = null;
try { M = loadModule(); } catch (e) { M = { __loadError: e }; }
const lawMod = M && !M.__loadError ? M : null;
if (want('L1')) lawL1(reg);
if (want('L2')) lawL2(reg, lawMod);
if (want('L3')) lawL3(reg);
if (want('L4')) lawL4(reg);
if (want('L5')) lawL5(reg);
if (want('U')) units(M);
out(failed.length ? `RESULT FAIL (${failed.join(' ')})` : 'RESULT PASS');
process.exit(failed.length ? 1 : 0);
