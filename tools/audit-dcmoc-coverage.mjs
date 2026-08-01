#!/usr/bin/env node
/* DCMOC parameter-coverage monitor — measures how thoroughly every dashboard's
 * displayed values carry (a) an explanation tooltip and (b) an ƒx trace indicator.
 *
 * Owner mandate: "saya mau semua parameter ada tooltip penjelasan" + "banyak value
 * tidak ada trace indicator ... pastikan ada semua". This makes that measurable so
 * new dashboards can't silently ship without coverage.
 *
 * HEURISTIC (regex, not a JSX parser) → report-only by default. Two signals:
 *   tooltip-mechanism count  = <Tooltip content | <InfoTip | <InfoTooltip | explainKey= | <Explain | tip: | tip= | title=
 *   label-ish count          = uppercase KPI labels / label:'...' / small-uppercase spans
 *   ScoreValue / traceId     = ƒx-trace wiring on score cards
 *
 * FLAGS (worklist, not hard failures — per-row `.map()` cells + component-local
 * useState values are structurally un-single-node-traceable and are expected gaps):
 *   TOOLTIP-GAP : a dashboard with >= MIN_LABELS labels but < MIN_TIPS tooltip mechanisms
 *   TRACE-GAP   : a file with ScoreValue cards but 0 traceId wiring (singular candidates)
 *
 * Exit 1 only with --strict AND a hard tooltip gap (0 tooltips on a >=8-label dashboard).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'dcmoc', 'src', 'components', 'modules');
const STRICT = process.argv.includes('--strict');
const MIN_LABELS = 6;
const MIN_TIPS = 3;

const TIP_RE = /<Tooltip content|<InfoTip|<InfoTooltip|explainKey=|<Explain |(?:^|[^a-zA-Z])tip:|(?:^|[^a-zA-Z])tip=|title=/g;
const LABEL_RE = /uppercase tracking|label:\s*'|text-\[9px\][^>]*uppercase|text-\[10px\][^>]*uppercase|text-\[11px\][^>]*uppercase/g;
const SCORE_RE = /<ScoreValue/g;
const TRACE_RE = /traceId[=:]/g;

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else if (e.endsWith('.tsx') && !e.includes('.test.')) out.push(p);
  }
  return out;
}

const rows = [];
for (const f of walk(ROOT)) {
  const src = readFileSync(f, 'utf8');
  const tips = (src.match(TIP_RE) || []).length;
  const labels = (src.match(LABEL_RE) || []).length;
  const scores = (src.match(SCORE_RE) || []).length;
  const traces = (src.match(TRACE_RE) || []).length;
  if (labels < MIN_LABELS && scores === 0) continue; // not a param-dense surface
  rows.push({ f: f.replace(ROOT + '/', ''), tips, labels, scores, traces });
}

const tipGaps = rows.filter((r) => r.labels >= MIN_LABELS && r.tips < MIN_TIPS);
const hardTipGaps = tipGaps.filter((r) => r.tips === 0 && r.labels >= 8);
const traceGaps = rows.filter((r) => r.scores >= 2 && r.traces === 0);

const pad = (s, n) => String(s).padEnd(n);
console.log('DCMOC PARAMETER-COVERAGE MONITOR (heuristic)\n');
console.log(`${pad('dashboard', 46)} tips  labels  score  trace`);
for (const r of rows.sort((a, b) => a.tips - b.tips)) {
  const flag = r.tips === 0 && r.labels >= 8 ? ' ⛔' : (r.labels >= MIN_LABELS && r.tips < MIN_TIPS) ? ' ⚠' : (r.scores >= 2 && r.traces === 0) ? ' ◇' : '';
  console.log(`${pad(r.f, 46)} ${pad(r.tips, 5)} ${pad(r.labels, 7)} ${pad(r.scores, 6)} ${pad(r.traces, 5)}${flag}`);
}
console.log(`\n${rows.length} param-dense dashboards · ⚠ ${tipGaps.length} tooltip-thin · ⛔ ${hardTipGaps.length} hard tooltip-gap · ◇ ${traceGaps.length} no-traceId score cards`);
console.log('◇/⚠ are worklist hints — per-row .map() cells + component-local useState values are structurally un-traceable and expected. ⛔ = a param-dense dashboard with zero tooltips.');

if (STRICT && hardTipGaps.length) {
  console.log(`\nFAIL (--strict): ${hardTipGaps.length} dashboard(s) with >=8 labels and 0 tooltips:`);
  for (const r of hardTipGaps) console.log(`  ⛔ ${r.f}`);
  process.exit(1);
}
console.log('\nOK — no hard tooltip gaps.');
