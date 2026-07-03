#!/usr/bin/env node
/* ============================================================================
   audit-article-charts.mjs — DATA-VIZ PROVENANCE GATE (v1.49.10)

   Every interactive article chart ([data-rz-chart] → js/rz-article-chart.js)
   MUST be backed by a citation: its inline JSON config must carry a non-empty
   `source` and a `basisTag`. No un-sourced numbers on a chart ("tidak ngawur,
   ada sumbernya"). See standarization/ARTICLE_DATAVIZ_STANDARD.md.

   Usage:  node tools/audit-article-charts.mjs [--strict]
   Exit 1 (with --strict) if any chart config is missing source/basisTag.
   ============================================================================ */
import { readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';

const STRICT = process.argv.includes('--strict');
const ROOT = process.cwd();
const VALID_TAGS = ['published', 'standard', 'vendor', 'derived', 'modelled', 'illustrative', 'representative', 'measured'];
const files = readdirSync(ROOT).filter(f => f.endsWith('.html'));

const problems = [];
let charts = 0;
// pull each <script ... class="rz-chart-cfg"> ... </script> JSON block
const cfgRe = /<script[^>]*class="rz-(?:chart|diagram)-cfg"[^>]*>([\s\S]*?)<\/script>/g;
for (const f of files) {
  const src = readFileSync(resolve(ROOT, f), 'utf8');
  let m;
  while ((m = cfgRe.exec(src)) !== null) {
    charts++;
    let cfg;
    try { cfg = JSON.parse(m[1]); }
    catch (e) { problems.push(`${f}: chart config is not valid JSON (${e.message.slice(0, 50)})`); continue; }
    if (!cfg.source || !String(cfg.source).trim()) problems.push(`${f}: chart "${(cfg.title||'').slice(0,40)}" has no source`);
    if (!cfg.basisTag || !VALID_TAGS.includes(String(cfg.basisTag).toLowerCase())) problems.push(`${f}: chart "${(cfg.title||'').slice(0,40)}" has no/invalid basisTag (got "${cfg.basisTag}")`);
    if (!cfg.series && !cfg.baselines) problems.push(`${f}: config "${(cfg.title||'').slice(0,40)}" has neither series (chart) nor baselines (diagram)`);
    if (cfg.series && !cfg.series.length) problems.push(`${f}: chart "${(cfg.title||'').slice(0,40)}" has empty series`);
  }
}

if (problems.length) {
  console.log(`\n✗ ARTICLE-CHART PROVENANCE — ${problems.length} issue(s):`);
  problems.forEach(p => console.log('   ' + p));
  console.log(`\nEvery [data-rz-chart] config needs a non-empty "source" + a "basisTag" (${VALID_TAGS.join('/')}).`);
} else {
  console.log(`ARTICLE-CHART PROVENANCE — CLEAN. ${charts} chart(s): all carry a source + basisTag.`);
}
process.exit(STRICT && problems.length ? 1 : 0);
