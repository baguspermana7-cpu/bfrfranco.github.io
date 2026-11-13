#!/usr/bin/env node
/* build-explain-index.mjs — PRD-P21 FR-P21-1: the per-page keyword index behind "Ask about this page" (js/rz-ask.js).
 * For each page that loads the basis drawer: the registry records the page shows or documents, plus its manual's
 * sections, tokenised by THE SAME tokenizer the browser uses (RZAsk.tokens). Output data/explain/<page>.json.
 *   node tools/build-explain-index.mjs           write
 *   node tools/build-explain-index.mjs --check   exit 1 if any file differs (freshness gate)
 * Weighted term frequencies: id + label x3, explain key x2, unit/formula/evidence x1, source x0.5 (a calculator's input list is the same on every record of it, so it would only blur the ranking);
 * manual heading x3, section body x0.3. Nothing here is phrased: an answer is a template over record fields. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const RZAsk = require(path.join(ROOT, 'js/rz-ask.js'));

const CONV = ['dc-conventional', 'chiller-plant', 'fire-system', 'fuel-system', 'datahall', 'ict', 'EPMS_Telemetry', 'water-system'];
const MANUAL = { 'EPMS_Telemetry': 'epms-telemetry', datahallAI: 'datahallai', 'capex-calculator': 'capex', 'carbon-footprint': 'carbon',
  'opex-calculator': 'opex', 'tco-calculator': 'tco', 'pue-calculator': 'pue', 'roi-calculator': 'roi' };
export const PAGES = [
  ...CONV.map(p => ({ page: p, reg: 'conv', global: 'RZ_CONV_PARAMETERS' })),
  { page: 'datahallAI', reg: 'dcai', global: 'RZ_DCAI_PARAMETERS' },
  ...['capex-calculator', 'carbon-footprint', 'opex-calculator', 'tco-calculator', 'pue-calculator', 'roi-calculator']
    .map(p => ({ page: p, reg: 'calc', global: 'RZ_CALC_PARAMETERS' }))
].map(p => ({ ...p, manual: 'manual/' + (MANUAL[p.page] || p.page) + '.html' }));

const decode = s => s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&mdash;/g, '—').replace(/&ndash;/g, '–').replace(/&[a-z]+;|&#\d+;/g, ' ');
const strip = s => decode(s.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

function add(tf, text, w) { for (const t of RZAsk.tokens(text)) tf[t] = (tf[t] || 0) + w; }
const round = o => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a < b ? -1 : 1).map(([k, v]) => [k, Math.round(v * 100) / 100]));

export function manualSections(file) {
  const s = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const out = [];
  const re = /<section\b([^>]*)>([\s\S]*?)(?=<section\b|<\/main>)/g;
  let m;
  while ((m = re.exec(s))) {
    const id = (m[1].match(/\bid="([^"]+)"/) || [])[1];
    const h = m[2].match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/);
    if (!id || !h || /contents-title/.test(h[0])) continue;
    const title = strip(h[1].replace(/<span class="mn-num">[^<]*<\/span>/, ''));
    out.push({ anchor: id, title, body: strip(m[2].slice(m[2].indexOf(h[0]) + h[0].length)) });
  }
  return out;
}

function recordTf(r) {
  const tf = {};
  add(tf, r.id.replace(/[._]/g, ' '), 3);
  add(tf, r.label, 3);
  if (r.explainKey) add(tf, r.explainKey, 2);
  if (r.calc) add(tf, r.calc, 1);
  add(tf, r.unit || '', 1);
  add(tf, r.formula || '', 1);
  add(tf, r.evidenceClass || '', 1);
  if (r.source) add(tf, [r.source.ref, r.source.section].filter(Boolean).join(' '), 0.5);
  return tf;
}
function overlap(a, b) { let s = 0; for (const k in a) if (b[k]) s += Math.min(a[k], b[k]); return s; }

export function buildPage(cfg) {
  const reg = JSON.parse(fs.readFileSync(path.join(ROOT, `data/${cfg.reg}-parameters.json`), 'utf8'));
  const src = fs.readFileSync(path.join(ROOT, cfg.page + '.html'), 'utf8');
  const file = cfg.page + '.html';
  /* "on the page" = the reader can see it: a hook in the markup or a basis map (calculator maps quote the id) */
  const esc = id => id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const onPage = id => cfg.reg === 'calc' ? true   /* a calculator record exists only for a result its page shows */
    : new RegExp(`(data-basis-param=|basis\\s*:\\s*)["']${esc(id)}["']`).test(src);
  const records = reg.parameters.filter(r => cfg.reg === 'calc' ? r.page === file
    : (r.consumers || []).some(c => c.page === file) || (r.docs || []).includes(cfg.manual) || onPage(r.id));
  const sections = manualSections(cfg.manual).map(s => {
    const tf = {}; add(tf, s.title, 3); add(tf, s.body, 0.3);
    return { ...s, tf };
  });
  const docs = [];
  for (const r of records) {
    const tf = recordTf(r);
    let best = null, bs = 0;
    for (const s of sections) { const o = overlap(tf, s.tf); if (o > bs) { bs = o; best = s; } }
    const rec = { id: r.id, label: r.label, unit: r.unit ?? null, value: r.value ?? null, evidenceClass: r.evidenceClass || null,
      formula: r.formula || null, source: r.source ? { ref: r.source.ref || null, section: r.source.section || null } : null };
    if (cfg.reg === 'calc') { rec.calc = r.calc; rec.display = r.display ?? null; }
    /* on the page, or documented in this page's manual: a tie between two records of one value goes to that one */
    docs.push({ key: 'r:' + r.id, kind: 'record', id: r.id, onPage: onPage(r.id) || (r.docs || []).includes(cfg.manual),
      value: typeof r.value === 'number' ? r.value : null, anchor: best ? best.anchor : null, anchorTitle: best ? best.title : null,
      rec, tf: round(tf), len: 0 });
  }
  for (const s of sections) docs.push({ key: 's:' + s.anchor, kind: 'section', manual: cfg.manual, anchor: s.anchor, title: s.title, tf: round(s.tf), len: 0 });
  const df = {};
  for (const d of docs) { d.len = Math.round(Object.values(d.tf).reduce((a, b) => a + b, 0) * 100) / 100; for (const t in d.tf) df[t] = (df[t] || 0) + 1; }
  const avgdl = Math.round(docs.reduce((a, d) => a + d.len, 0) / docs.length * 100) / 100;
  const syn = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/explain-synonyms.json'), 'utf8')).synonyms;
  return {
    version: 1, generatedBy: 'tools/build-explain-index.mjs', page: file, manual: cfg.manual,
    registry: { global: cfg.global, file: `data/${cfg.reg}-parameters.json`, version: reg.engineVersion || reg.engineDataVersion || reg.version || null },
    counts: { records: records.length, sections: sections.length },
    synonyms: syn, avgdl, df: round(df), docs
  };
}

export function outPath(cfg) { return path.join(ROOT, 'data/explain', cfg.page + '.json'); }

function main() {
  const check = process.argv.includes('--check');
  fs.mkdirSync(path.join(ROOT, 'data/explain'), { recursive: true });
  let stale = 0;
  for (const cfg of PAGES) {
    const text = JSON.stringify(buildPage(cfg)) + '\n';
    const p = outPath(cfg), old = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
    if (check) { if (old !== text) { stale++; console.log('STALE ' + path.relative(ROOT, p)); } continue; }
    fs.writeFileSync(p, text);
    const j = JSON.parse(text);
    console.log(`${cfg.page.padEnd(18)} records ${String(j.counts.records).padStart(3)} sections ${String(j.counts.sections).padStart(2)} ${(text.length / 1024).toFixed(1)} KB`);
  }
  if (check) { console.log(stale ? `${stale} explain index file(s) stale — run node tools/build-explain-index.mjs` : `explain indexes fresh (${PAGES.length})`); process.exit(stale ? 1 : 0); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
