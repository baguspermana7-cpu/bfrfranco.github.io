#!/usr/bin/env node
/* ============================================================================
 * build-incident-diagrams.mjs — the two figures every incident dossier carries
 * ----------------------------------------------------------------------------
 * Drawn through the RZ diagram engine (js/rz-diagram*.js) at build time, with
 * IEC 60617 / ISA-5.1 glyphs from js/rz-eng-symbols.js, and written to
 * data/incidents/_diagrams.json, which tools/build-incidents.py embeds. Build
 * time rather than runtime for the same reasons as the article figures: the
 * dossier is content, it must survive print and no-JS, and --check can then
 * compare bytes.
 *
 * 1. FAILURE CHAIN. The dossier's own FMEA modes, split into what the record
 *    shows happening (active: a mode whose evidence cites a sequence-of-events
 *    entry, drawn in the order of the first entry it cites) and what was already
 *    in place before the event (latent: no moment in the record). The order is
 *    the order of the RECORD, not a claimed causal proof, and the caption says so.
 * 2. FISHBONE. Contributing factors grouped by category. Each cause points at
 *    the factor or failure mode it summarises, so a short label can be traced
 *    back to the sentence it stands for.
 *
 * Any engine warning (overflow, unplaced label, transit, colour-only legend, over
 * budget) fails the build: a figure the engine could not draw cleanly is a
 * layout problem to fix, not a figure to ship.
 *
 *   node tools/build-incident-diagrams.mjs            # write
 *   node tools/build-incident-diagrams.mjs --check    # exit 1 on drift
 * ==========================================================================*/
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const DATA = join(root, 'data', 'incidents');
const OUT = join(DATA, '_diagrams.json');
const CHECK = process.argv.includes('--check');
// slugs on the command line = validate those only, write nothing (safe to run in parallel)
const ONLY = process.argv.slice(2).filter((a) => !a.startsWith('--'));

const sandbox = { module: { exports: {} }, console };
sandbox.globalThis = sandbox;
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const rel of ['js/rz-eng-symbols.js', 'js/rz-diagram-metrics.js', 'js/rz-diagram-layout.js', 'js/rz-diagram.js']) {
  vm.runInContext(readFileSync(join(root, rel), 'utf8'), sandbox, { filename: rel });
}
const { RZDiagram: D, RZDiagramMetrics: M } = sandbox;

export const FISH_CATS = ['Equipment', 'Design', 'Process', 'People', 'Environment', 'External'];
const rpn = (m) => m.S * m.O * m.D;
const high = (m) => (m.S >= 9 && (m.O >= 4 || m.D >= 7)) || rpn(m) >= 300;

/* ---- 1. failure chain ---------------------------------------------------- */
function chainFigure(inc, COLS = 2) {
  const f = inc.fmea;
  const slug = (COLS === 1 ? 'fn-' : 'fc-') + inc.slug.slice(0, 24);
  const first = (m) => {
    const idx = (m.evidence || []).filter((e) => e.src === 'soe' && Number.isInteger(e.i)).map((e) => e.i);
    return idx.length ? Math.min(...idx) : null;
  };
  const active = f.modes.filter((m) => first(m) !== null)
    .sort((a, b) => first(a) - first(b) || a.id.localeCompare(b.id));
  const latent = f.modes.filter((m) => first(m) === null);
  const ctx = D.create({
    slug,
    title: `How the defences failed — ${inc.operatorShort || inc.operator}`,
    desc: `${active.length} failure modes in the order the sequence of events first shows them, ` +
          `${latent.length} latent conditions with no moment in the record, ending in the outcome: ${f.impactShort}.`,
  });
  /* Two columns, read as a snake: left to right, down, right to left. One
   * column of eight boxes was 1,364 units tall for a 348-unit width — a list,
   * not a structure. Latent conditions sit above the active chain because they
   * were in place before it started; they carry no arrows, since the record
   * gives them no moment and an arrow would claim one. */
  const W = 288, HG = 56, VG = 40, PAD = 24, ZT = 30;
  const NH = f.modes.some((m) => m.symbol) ? 104 : 72;
  const seen = new Set();
  const treat = (m) => {
    const hi = high(m);
    const residual = !(m.actions || []).length;
    const key = (hi ? 'High priority' : 'Medium or low priority') + (residual ? ', no published action' : '');
    const firstSeen = !seen.has(key);
    seen.add(key);
    return {
      stroke: hi ? 'alarm-fault' : 'muted', fill: hi ? 'paper-2' : 'paper', dashed: residual,
      tier: hi ? 1 : 2, legend: firstSeen ? key : undefined,
    };
  };
  const nodeFor = (m, x, y) => ctx.node(x, y, Object.assign({
    id: m.id, tag: `${m.id} · RPN ${rpn(m)}`, name: m.short, sublabel: `S${m.S} · O${m.O} · D${m.D}`, w: W, h: NH, vAlign: 'middle',
    symbol: m.symbol || undefined,
  }, treat(m)));
  const colX = (c) => PAD + c * (W + HG);
  const ZW = COLS * W + (COLS - 1) * HG + 24;
  const rows = (n) => Math.ceil(n / COLS);
  const zoneHeight = (n) => ZT + rows(n) * NH + (rows(n) - 1) * VG + 16;
  /* The engine sizes nodes from their text but not a zone from its eyebrow, so a zone
   * label longer than its zone runs off the figure with no warning. Check it here. */
  const zoneLabel = (t) => {
    const need = M.textWidth(t.toUpperCase(), 9, 'mono', { tracking: 0.18 }) + 24;
    if (need > ZW) ctx.warnings.push({ kind: 'zone-label-overflow', message: `"${t}" needs ${Math.ceil(need)} units, zone is ${ZW}` });
    return t;
  };
  let y = PAD;
  if (latent.length) {
    ctx.zone(PAD - 12, y, ZW, zoneHeight(latent.length), { label: zoneLabel(COLS === 1 ? 'Latent — before the event' : 'Latent — in place before the event'), stroke: 'rule', dashed: true });
    latent.forEach((m, k) => nodeFor(m, colX(k % COLS), y + ZT + Math.floor(k / COLS) * (NH + VG)));
    y += zoneHeight(latent.length) + 28;
  }
  ctx.zone(PAD - 12, y, ZW, zoneHeight(active.length), { label: zoneLabel(COLS === 1 ? 'Active — record order' : 'Active — in the order the record shows them'), stroke: 'rule' });
  const aBoxes = active.map((m, k) => {
    const r = Math.floor(k / COLS);
    const c = COLS === 1 ? 0 : (r % 2 === 0 ? k % 2 : 1 - (k % 2));
    return nodeFor(m, colX(c), y + ZT + r * (NH + VG));
  });
  y += zoneHeight(active.length) + 48;
  const IW = Math.max(W, M.grid4(M.textWidth(f.impactShort, 12, 'sans') + 40));
  const impact = ctx.node(Math.round(PAD + ZW / 2 - 12 - IW / 2), y, { id: 'impact', tag: 'outcome', name: f.impactShort, w: IW, focal: true, tier: 1 });
  const midY = (b) => b.y + b.h / 2, cx = (b) => b.x + b.w / 2;
  for (let i = 0; i + 1 < aBoxes.length; i++) {
    const a = aBoxes[i], b = aBoxes[i + 1];
    const o = { fromId: active[i].id, toId: active[i + 1].id, stroke: 'ink', pattern: 'solid', legend: i === 0 ? 'Next failure in the record' : undefined };
    if (Math.abs(a.y - b.y) < 1) {
      const lr = a.x < b.x;
      ctx.edge({ x: lr ? a.x + a.w : a.x, y: midY(a) }, { x: lr ? b.x : b.x + b.w, y: midY(b) }, o);
    } else {
      ctx.edge({ x: cx(a), y: a.y + a.h }, { x: cx(b), y: b.y }, o);
    }
  }
  const last = aBoxes[aBoxes.length - 1];
  if (last) ctx.edge({ x: cx(last), y: last.y + last.h }, { x: cx(impact), y: impact.y },
    { fromId: active[active.length - 1].id, toId: 'impact', stroke: 'ink', pattern: 'solid' });
  ctx.legend({ x: PAD });
  ctx.fit(PAD);
  return { svg: ctx.render(), warnings: ctx.warnings };
}

/* ---- 2. fishbone ------------------------------------------------------- */
function fishFigure(inc) {
  const fb = inc.fishbone;
  const slug = 'fb-' + inc.slug.slice(0, 24);
  const ctx = D.create({
    slug,
    title: `Contributing factors by category — ${inc.operatorShort || inc.operator}`,
    desc: fb.bones.map((b) => `${b.cat}: ${b.causes.map((c) => c.label).join('; ')}`).join('. ') + `. Effect: ${fb.effect}.`,
  });
  const bones = fb.bones.slice().sort((a, b) => b.causes.length - a.causes.length);
  const top = bones.filter((_, i) => i % 2 === 0), bot = bones.filter((_, i) => i % 2 === 1);
  const cols = Math.max(top.length, bot.length);
  const labelW = Math.max(...bones.flatMap((b) => b.causes.map((c) => M.textWidth(c.label, 11, 'sans'))));
  const STEP = M.grid4(labelW + 44), PAD = 24, X0 = PAD + labelW + 22;
  const maxTop = Math.max(0, ...top.map((b) => b.causes.length)), maxBot = Math.max(0, ...bot.map((b) => b.causes.length));
  const LINE = 24, NODE_H = 40;
  const topY = PAD, spineY = topY + NODE_H + 24 + maxTop * LINE + 12;
  const botY = spineY + 24 + maxBot * LINE + 12;
  const ribX = (k) => X0 + k * STEP;
  const spineEnd = ribX(cols - 1) + 48;
  const EW = M.grid4(Math.max(M.textWidth(fb.effect, 12, 'sans') + 32, 160));
  const eff = ctx.node(spineEnd, spineY - 30, { id: 'effect', name: fb.effect, w: EW, focal: true, tier: 1 });
  const draw = (b, k, isTop) => {
    const x = ribX(k);
    const nw = M.grid4(M.textWidth(b.cat, 12, 'sans') + 28);
    const ny = isTop ? topY : botY;
    const n = ctx.node(x - nw / 2, ny, { id: 'cat-' + b.cat, name: b.cat, w: nw, h: NODE_H });
    ctx.edge({ x, y: isTop ? n.y + n.h : n.y }, { x, y: spineY }, { fromId: 'cat-' + b.cat, stroke: 'muted', tier: 2, marker: false });
    b.causes.forEach((c, i) => {
      const cy = isTop ? n.y + n.h + 24 + i * LINE : spineY + 24 + i * LINE;
      ctx.text(c.label, x - 14, cy + 4, { role: 'legend-label', size: 11, anchor: 'end', fill: 'ink' });
      ctx.edge({ x: x - 10, y: cy }, { x: x - 1, y: cy }, { stroke: 'muted', tier: 3, marker: false });
    });
  };
  top.forEach((b, k) => draw(b, k, true));
  bot.forEach((b, k) => draw(b, k, false));
  ctx.edge({ x: PAD + 8, y: spineY }, { x: eff.x, y: spineY }, { toId: 'effect', stroke: 'ink', tier: 1, pattern: 'solid' });
  ctx.legend({ x: PAD });
  ctx.fit(PAD);
  return { svg: ctx.render(), warnings: ctx.warnings };
}

/* ---- validation of the authored inputs ------------------------------------ */
export function validateDiagramInputs(inc) {
  const errs = [];
  const f = inc.fmea || {};
  if (!(f.impactShort || '').trim()) errs.push('fmea.impactShort is empty');
  else if (f.impactShort.length > 40) errs.push(`fmea.impactShort is ${f.impactShort.length} chars; max 40`);
  for (const m of f.modes || []) {
    if (!(m.short || '').trim()) errs.push(`${m.id}: no 'short' label`);
    else if (m.short.length > 30) errs.push(`${m.id}: short '${m.short}' is ${m.short.length} chars; max 30`);
    if (m.symbol && !(sandbox.RZEngSymbols.MARKUP || {})[m.symbol]) errs.push(`${m.id}: unknown symbol '${m.symbol}'`);
  }
  const fb = inc.fishbone;
  if (!fb) { errs.push('no fishbone'); return errs; }
  if (!(fb.effect || '').trim() || fb.effect.length > 40) errs.push('fishbone.effect empty or over 40 chars');
  const bones = fb.bones || [];
  if (bones.length < 3) errs.push(`fishbone has ${bones.length} categories; the floor is 3`);
  if (bones.length > 6) errs.push('fishbone has more than 6 categories');
  let n = 0;
  const ids = new Set((f.modes || []).map((m) => m.id));
  const factors = inc.contributingFactors || [];
  for (const b of bones) {
    if (!FISH_CATS.includes(b.cat)) errs.push(`fishbone category '${b.cat}' not in ${FISH_CATS.join('/')}`);
    if (!(b.causes || []).length) errs.push(`fishbone ${b.cat}: no causes`);
    if ((b.causes || []).length > 4) errs.push(`fishbone ${b.cat}: more than 4 causes`);
    for (const c of b.causes || []) {
      n++;
      if (!(c.label || '').trim() || c.label.length > 30) errs.push(`fishbone ${b.cat}: label '${c.label}' empty or over 30 chars`);
      const okF = Number.isInteger(c.factor) && c.factor >= 0 && c.factor < factors.length;
      const okM = c.mode && ids.has(c.mode);
      if (!okF && !okM) errs.push(`fishbone ${b.cat} '${c.label}': must point at a contributing factor index or an FMEA mode id`);
    }
  }
  if (n < 5) errs.push(`fishbone has ${n} causes; the floor is 5`);
  return errs;
}

/* ---- main --------------------------------------------------------------- */
const out = {};
let bad = 0;
const files = readdirSync(DATA).filter((f) => f.endsWith('.json') && !f.startsWith('_')).sort();
for (const file of files) {
  const inc = JSON.parse(readFileSync(join(DATA, file), 'utf8'));
  if (ONLY.length && !ONLY.includes(inc.slug)) continue;
  if (!inc.fishbone && !(inc.fmea && inc.fmea.impactShort)) continue; // not authored yet
  const errs = validateDiagramInputs(inc);
  if (errs.length) { bad++; console.error(`[incident-diagrams] ${inc.slug}: ${errs.join('; ')}`); continue; }
  const chain = chainFigure(inc), narrow = chainFigure(inc, 1), fish = fishFigure(inc);
  const warn = [...chain.warnings.map((w) => 'chain ' + w.kind + ': ' + w.message),
                ...narrow.warnings.map((w) => 'narrow chain ' + w.kind + ': ' + w.message),
                ...fish.warnings.map((w) => 'fishbone ' + w.kind + ': ' + w.message)];
  if (process.env.DBG) for (const w of chain.warnings) console.error(JSON.stringify(w));
  if (warn.length) { bad++; console.error(`[incident-diagrams] ${inc.slug}: ${warn.join(' | ')}`); continue; }
  out[inc.slug] = { chain: chain.svg, chainNarrow: narrow.svg, fishbone: fish.svg };
}
const body = JSON.stringify(out, null, 1) + '\n';
if (ONLY.length) {
  console.log(`[incident-diagrams] ${Object.keys(out).length} of ${ONLY.length} drawn cleanly`);
  process.exit(bad ? 1 : 0);
}
if (CHECK) {
  const cur = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
  if (cur !== body || bad) {
    console.error(`[incident-diagrams] STALE or invalid — ${bad} dossier(s) failed; run without --check`);
    process.exit(1);
  }
  console.log(`[incident-diagrams] CURRENT — ${Object.keys(out).length} dossiers drawn, no engine warnings`);
} else {
  writeFileSync(OUT, body);
  console.log(`[incident-diagrams] wrote ${Object.keys(out).length} dossiers` + (bad ? `, ${bad} FAILED` : ''));
  if (bad) process.exit(1);
}
