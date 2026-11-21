#!/usr/bin/env node
/**
 * build-conv-points-seed.mjs — the seed of supabase/migrations/2026-11-20-conv-points.sql (PRD-CONV-POINT-STATUS-TREND §5b).
 *
 * Reads data/conv-limits.curated.json (limits, basis, source) and data/conv-points.json (the points with a database
 * history and their RZConvHistory definition), and writes, between `-- BEGIN SEED` and `-- END SEED` of the migration,
 * one `insert … on conflict (id) do update … where <something changed>` so git and the database start equal.
 *
 * History definition per point: base = hist.base, else the limits row's nominal value; amp = hist.amp, else 3 % of |base|
 * (the same default js/conv/point-status.js gives a page point); then bounded per P-6 with RZConvHistory.bounded, so a
 * normal point has a normal past in the database too.
 *
 *   node tools/build-conv-points-seed.mjs            rewrite the seed block
 *   node tools/build-conv-points-seed.mjs --check    exit 1 when the block differs from what the sources give (freshness gate)
 *   import { seedRows } from './build-conv-points-seed.mjs'   the rows, for tools/test-conv-points-sql.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);
const H = require(path.join(ROOT, 'js/conv/history.js'));
export const MIGRATION = 'supabase/migrations/2026-11-20-conv-points.sql';
const BEGIN = '-- BEGIN SEED', END = '-- END SEED';
const COLS = ['id', 'label', 'unit', 'page', 'lo_alarm', 'lo_warn', 'hi_warn', 'hi_alarm', 'deadband', 'basis', 'evidence_class',
  'source_ref', 'source_as_of', 'hist_base', 'hist_amp', 'hist_shape', 'hist_digits'];
const isNum = (n) => typeof n === 'number' && Number.isFinite(n);

export function seedRows() {
  const limits = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/conv-limits.curated.json'), 'utf8')).rows;
  const points = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/conv-points.json'), 'utf8')).points;
  const byId = new Map(limits.map((r) => [r.id, r]));
  const seen = new Set(), out = [];
  for (const p of points) {
    if (seen.has(p.id)) throw new Error(`data/conv-points.json: duplicate id ${p.id}`);
    seen.add(p.id);
    const L = byId.get(p.id) || null, h = p.hist || {};
    const base = isNum(h.base) ? h.base : (L && L.nominal && isNum(L.nominal.value) ? L.nominal.value : null);
    if (!isNum(base)) throw new Error(`${p.id}: no hist.base and no limits nominal`);
    const def = { id: p.id, base, amp: isNum(h.amp) ? h.amp : Math.abs(base) * 0.03, shape: h.shape || 'load', digits: isNum(h.digits) ? h.digits : 1 };
    const b = L ? H.bounded(def, L) : def;
    out.push({
      id: p.id, label: (L && L.label) || p.label || p.id, unit: (L && L.unit) || p.unit || '', page: p.page || null,
      lo_alarm: L ? L.lo_alarm : null, lo_warn: L ? L.lo_warn : null, hi_warn: L ? L.hi_warn : null, hi_alarm: L ? L.hi_alarm : null,
      deadband: L ? L.deadband : null, basis: L ? L.basis : null, evidence_class: L ? L.evidenceClass : null,
      source_ref: L && L.source ? [L.source.ref, L.source.section].filter(Boolean).join(' ') : null,
      source_as_of: L && L.source ? L.source.asOf || null : null,
      hist_base: b.base, hist_amp: b.amp, hist_shape: b.shape, hist_digits: b.digits,
    });
  }
  /* every limits row is a point (a limit with no database row would fall back silently) */
  for (const r of limits) if (!seen.has(r.id)) throw new Error(`limits row ${r.id} is missing from data/conv-points.json`);
  return out;
}

const lit = (v) => (v === null || v === undefined ? 'null' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);

export function seedSql(rows = seedRows()) {
  const upd = COLS.filter((c) => c !== 'id');
  return [
    BEGIN,
    `-- ${rows.length} points. Re-running resets a row to git only where a value differs (the change is audited).`,
    `insert into public.conv_points as c (${COLS.join(', ')}) values`,
    rows.map((r) => `  (${COLS.map((c) => lit(r[c])).join(', ')})`).join(',\n'),
    'on conflict (id) do update set',
    upd.map((c) => `  ${c} = excluded.${c}`).join(',\n'),
    `where (${upd.map((c) => 'c.' + c).join(', ')})`,
    `  is distinct from (${upd.map((c) => 'excluded.' + c).join(', ')});`,
    END,
  ].join('\n');
}

function main() {
  const file = path.join(ROOT, MIGRATION), src = fs.readFileSync(file, 'utf8');
  const a = src.indexOf(BEGIN), b = src.indexOf(END);
  if (a < 0 || b < a) { console.error(`${MIGRATION}: seed markers not found`); process.exit(2); }
  const next = src.slice(0, a) + seedSql() + src.slice(b + END.length);
  if (process.argv.includes('--check')) {
    if (next !== src) { console.error(`STALE ${MIGRATION} seed — run node tools/build-conv-points-seed.mjs`); process.exit(1); }
    console.log(`OK ${MIGRATION} seed current (${seedRows().length} points)`);
    return;
  }
  if (next !== src) fs.writeFileSync(file, next);
  console.log(`${next !== src ? 'wrote' : 'unchanged'} ${MIGRATION} seed (${seedRows().length} points)`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
