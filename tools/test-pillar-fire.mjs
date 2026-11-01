#!/usr/bin/env node
/* ============================================================================
 * test-pillar-fire.mjs — static gate for pillar-fire-safety.html
 * ----------------------------------------------------------------------------
 * The owner asked for the fire pillar to lose its filler and carry the whole
 * subject, sourced. This gate holds the rewrite to that, without a browser:
 *
 *   L1  every local href resolves: the file exists, and a #fragment exists as
 *       an id in the target file (same page or another page)
 *   L2  every row of each fire dataset appears in its table:
 *       data/fire/clean-agent-properties.csv -> table[data-csv="clean-agent-properties"]
 *       data/fire/li-ion-chemistry.csv       -> table[data-csv="li-ion-chemistry"]
 *       data/fire/standards-references.csv   -> table[data-csv="standards-references"]
 *       (body row count equals CSV row count, and each row's key cell is present)
 *   L3  zero banned filler phrases in the text a reader or crawler sees
 *   L4  no element whose class names a stat tile, KPI card, badge or pill
 *   L5  every fire incident dossier is linked from the incidents table, and the
 *       three engine figures are built (an <svg> inside each placeholder)
 *
 *   node tools/test-pillar-fire.mjs [--page=path]   exit 1 on any finding
 * ==========================================================================*/
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pageArg = (process.argv.find((a) => a.startsWith('--page=')) || '').split('=')[1];
const PAGE = pageArg ? resolve(pageArg) : join(root, 'pillar-fire-safety.html');
const html = readFileSync(PAGE, 'utf8');
const findings = [];
const pass = [];

/* ---- helpers ------------------------------------------------------------ */
function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((x) => x.trim() !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== '')) rows.push(row);
  return rows;
}
const decode = (s) => s
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#x27;|&#39;|&rsquo;|&lsquo;/g, "'").replace(/&mdash;/g, '—')
  .replace(/&ndash;/g, '–').replace(/&times;/g, '×').replace(/&minus;/g, '−').replace(/&middot;/g, '·')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
const text = (s) => decode(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const norm = (s) => s.toLowerCase().replace(/[₀-₉]/g, (d) => String(d.charCodeAt(0) - 0x2080)).replace(/\s+/g, ' ').trim();
const idsCache = new Map();
function idsOf(file) {
  if (!idsCache.has(file)) {
    const src = readFileSync(file, 'utf8');
    idsCache.set(file, new Set([...src.matchAll(/\sid=["']([^"']+)["']/g)].map((m) => m[1])));
  }
  return idsCache.get(file);
}

/* ---- L1 local hrefs ------------------------------------------------------ */
{
  const noScript = html.replace(/<script(?![^>]*ld\+json)[\s\S]*?<\/script>/gi, '');
  const hrefs = [...noScript.matchAll(/\shref=["']([^"']+)["']/g)].map((m) => m[1]);
  let local = 0;
  for (const h of hrefs) {
    if (/^(https?:|mailto:|tel:|javascript:|data:|\/\/)/i.test(h)) continue;
    local++;
    const [pathPart, frag] = h.split('#');
    const file = pathPart ? resolve(dirname(PAGE), decodeURIComponent(pathPart.split('?')[0])) : PAGE;
    if (!existsSync(file)) { findings.push(`L1 href "${h}": file not found`); continue; }
    if (frag && /\.html?$/i.test(file) && !idsOf(file).has(frag)) findings.push(`L1 href "${h}": no id="${frag}" in ${pathPart || 'this page'}`);
  }
  pass.push(`L1 ${local} local hrefs checked`);
}

/* ---- L2 every CSV row in its table -------------------------------------- */
for (const name of ['clean-agent-properties', 'li-ion-chemistry', 'standards-references']) {
  const rows = parseCsv(readFileSync(join(root, 'data/fire', name + '.csv'), 'utf8')).slice(1);
  const m = new RegExp('<table\\b[^>]*data-csv="' + name + '"[^>]*>([\\s\\S]*?)</table>', 'i').exec(html);
  if (!m) { findings.push(`L2 no <table data-csv="${name}"> for data/fire/${name}.csv (${rows.length} rows)`); continue; }
  const body = (/<tbody[^>]*>([\s\S]*?)<\/tbody>/i.exec(m[1]) || [, ''])[1];
  const trs = [...body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((t) => norm(text(t[1])));
  if (trs.length !== rows.length) findings.push(`L2 ${name}: table has ${trs.length} body rows, CSV has ${rows.length}`);
  for (const r of rows) {
    const key = norm(r[0]);
    if (!trs.some((t) => t.includes(key))) findings.push(`L2 ${name}: CSV row "${r[0]}" not in the table`);
  }
  pass.push(`L2 ${name}: ${rows.length} CSV rows / ${trs.length} table rows`);
}

/* ---- L3 banned filler ---------------------------------------------------- */
const BANNED = [
  // taken from the page this rewrite replaced
  'protecting people and equipment', 'linked through one navigable hub', 'by the numbers',
  'explore fire safety resources', 'how fire safety content connects', 'covering every aspect',
  'comprehensive breakdown', 'head-to-head', 'super-detailed', 'mission-critical environments',
  'complete guide', 'the complete fire protection reference', 'topic cluster', 'changes the fire problem entirely',
  'the workhorse', 'first principles', 'not one system but', 'critical metrics that define',
  // generic filler
  'comprehensive guide', "in today's", 'delve', 'landscape', 'ever-evolving', 'game-changer', 'game changer',
  'seamless', 'cutting-edge', 'unlock', 'navigate the', "it's not just", 'look no further', 'in the realm of',
  'plays a crucial role', 'crucial role', 'robust', 'leverage', 'holistic', 'paramount', 'dive into', 'deep dive'
];
{
  const visible = html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script(?![^>]*ld\+json)[\s\S]*?<\/script>/gi, ' ');
  const metaText = [...visible.matchAll(/<meta[^>]+content=["']([^"']*)["']/gi)].map((m) => m[1]).join(' ');
  const hay = norm(text(visible) + ' ' + decode(metaText));
  let hits = 0;
  for (const p of BANNED) if (hay.includes(p)) { hits++; findings.push(`L3 banned phrase: "${p}"`); }
  pass.push(`L3 ${BANNED.length} banned phrases, ${hits} found`);
}

/* ---- L4 no tiles / kpi / badge / pill classes ---------------------------- */
{
  const bad = /(^|[\s_-])(tile|tiles|stat-card|stat-cards|kpi|kpis|badge|badges|pill|pills)([\s_-]|$)/i;
  let n = 0;
  for (const m of html.matchAll(/<([a-z][a-z0-9]*)\b[^>]*\sclass=["']([^"']+)["']/gi)) {
    if (m[2].split(/\s+/).some((c) => bad.test(c) || /stat-?card|kpi/i.test(c))) { n++; findings.push(`L4 <${m[1]} class="${m[2]}">`); }
  }
  pass.push(`L4 ${n} tile/kpi/badge/pill elements`);
}

/* ---- L5 incidents + figures --------------------------------------------- */
{
  const INCIDENTS = ['ovhcloud-sbg2-fire-2021', 'kakao-sk-cc-pangyo-fire-2022', 'digital-realty-la-el-segundo-fire-2023',
    'digital-realty-singapore-liion-fire-2024', 'nirs-daejeon-battery-fire-2025', 'x-twitter-oregon-fire-2025',
    'gcp-stt-gdc-delhi-fire-2026', 'northc-almere-fire-2026'];
  const t = /<table\b[^>]*data-table="incidents"[^>]*>([\s\S]*?)<\/table>/i.exec(html);
  if (!t) findings.push('L5 no <table data-table="incidents">');
  else for (const s of INCIDENTS) if (!t[1].includes(`href="incident-${s}.html"`)) findings.push(`L5 incidents table misses incident-${s}.html`);
  for (const id of ['fire-d1', 'fire-d2', 'fire-d3']) {
    const f = new RegExp('<figure\\b[^>]*data-rz-figure="' + id + '"[^>]*>([\\s\\S]*?)</figure>').exec(html);
    if (!f) findings.push(`L5 no figure placeholder ${id}`);
    else if (!/<svg\b/.test(f[1])) findings.push(`L5 figure ${id} is empty — run node tools/build-article-diagrams.mjs`);
  }
  pass.push(`L5 ${INCIDENTS.length} incident links + 3 figures checked`);
}

console.log('PILLAR FIRE GATE — ' + PAGE.replace(root + '/', ''));
for (const p of pass) console.log('  ' + p);
if (findings.length) {
  console.log(`\nFAIL — ${findings.length} finding(s):`);
  for (const f of findings) console.log('  ' + f);
  process.exit(1);
}
console.log('\nPASS — links resolve, every dataset row is tabled, no filler, no tiles, incidents and figures present');
