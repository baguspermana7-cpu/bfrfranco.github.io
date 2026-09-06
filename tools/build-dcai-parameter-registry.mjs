/**
 * Build data/dcai-parameters.json — the AI / HPC (GB300) parameter registry.
 *
 * A port of tools/build-conv-parameter-registry.mjs with four changes the plan (Track A §A3)
 * called for, because this engine is NOT affine:
 *
 *   1. BIDIRECTIONAL perturbation. A one-sided x1.37 lies when there is a regime switch or a
 *      ceil(): a leaf can move a count upward and not downward, or push a min() onto the
 *      other branch. Every leaf is probed x1.37 AND x0.73 and an edge is recorded if EITHER
 *      moves the output.
 *   2. TWO OPERATING POINTS. The design point, and half a kelvin past the free-cooling cliff.
 *   3. A THIRD KIND, `slack`. `thermal.cduApproachK`, `thermal.copMax` and the liquid-path COP
 *      all measure exactly zero sensitivity at the design point — they sit on the losing side
 *      of a comparison — and a one-point measurement would file them as dead inputs. If a leaf
 *      moves nothing at design but something past the cliff, the parameter is `slack` and the
 *      cliff edges are stored beside the design edges.
 *   4. PROVENANCE FROM THE MODEL FILE ITSELF. js/dcai-model.js carries a `// source:` comment
 *      and an evidence class on every leaf. The generator reads those instead of asking a
 *      second hand-maintained file to repeat them — the curated file holds only what a machine
 *      cannot know (labels, units, scope, the formula a derived value implements).
 *
 * Run:  node tools/build-dcai-parameter-registry.mjs            # write
 *       node tools/build-dcai-parameter-registry.mjs --check    # staleness only, exit 1 on drift
 *       node tools/build-dcai-parameter-registry.mjs --scaffold # write curated stubs for new ids
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { createHash } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const MODEL = join(ROOT, 'js', 'dcai-model.js');
const ENGINE = join(ROOT, 'js', 'dcai-engine.js');
const CURATED = join(ROOT, 'data', 'dcai-parameters.curated.json');
const OUT = join(ROOT, 'data', 'dcai-parameters.json');
const OUT_JS = join(ROOT, 'js', 'dcai-parameters.js');

/* The AI cockpit surfaces. Registered deliberately, never discovered. datahallAI.html is
   listed even though it does not read this engine yet (Track A §A2b switches it); until then
   every parameter reports zero consumers and the registry gate REPORTS that rather than
   failing — the flip condition is written in tools/test-dcai-parameter-registry.mjs. */
export const COCKPITS = Object.freeze(['datahallAI.html']);

function loadEngine() {
  const box = { module: { exports: {} }, console };
  box.globalThis = box;
  vm.createContext(box);
  vm.runInContext(readFileSync(MODEL, 'utf8'), box, { filename: 'dcai-model.js' });
  vm.runInContext(readFileSync(ENGINE, 'utf8'), box, { filename: 'dcai-engine.js' });
  const calc = box.DCAI_CALC;
  if (!calc || !calc.snapshot) throw new Error('dcai-engine.js did not expose DCAI_CALC.snapshot');
  return calc;
}

function flatten(node, prefix, out) {
  for (const key of Object.keys(node)) {
    const value = node[key];
    const path = prefix ? `${prefix}.${key}` : key;
    if (Array.isArray(value)) {
      /* a TOP-LEVEL array (`bins`) would flatten to a single-segment id, which the schema's
         dotted-path rule rejects; register its digest under `<name>.digest` instead */
      out.set(prefix ? path : `${path}.digest`, `[${value.length} items] ${JSON.stringify(value)}`);
    } else if (value && typeof value === 'object') {
      flatten(value, path, out);
    } else {
      out.set(path, value);
    }
  }
  return out;
}

function modelLeaves(node, prefix, out) {
  for (const key of Object.keys(node)) {
    const value = node[key];
    const path = prefix ? `${prefix}.${key}` : key;
    if (Array.isArray(value)) {
      value.forEach((item, i) => { if (item && typeof item === 'object') modelLeaves(item, `${path}.${i}`, out); });
    } else if (value && typeof value === 'object') {
      modelLeaves(value, path, out);
    } else if (typeof value === 'number' && isFinite(value)) {
      out.set(path, value);
    }
  }
  return out;
}

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (value && typeof value === 'object') { const o = {}; for (const k of Object.keys(value)) o[k] = clone(value[k]); return o; }
  return value;
}
function setAt(root, path, value) {
  const parts = path.split('.'); let node = root;
  for (let i = 0; i < parts.length - 1; i += 1) node = node[parts[i]];
  node[parts[parts.length - 1]] = value;
}
function getAt(root, path) {
  return path.split('.').reduce((n, k) => (n == null ? n : n[k]), root);
}
function grepCount(haystack, needle) {
  let count = 0, index = haystack.indexOf(needle);
  while (index !== -1) { count += 1; index = haystack.indexOf(needle, index + needle.length); }
  return count;
}

/* ── provenance read from js/dcai-model.js itself ─────────────────────────────
   For a leaf `thermal.tcsSupplyC` find the line `tcsSupplyC: 40,` inside the `thermal: {`
   block and collect the `// source:` comment immediately above it. The evidence class is the
   last ALL-CAPS taxonomy word in that comment. If a leaf has no comment the generator says so
   with evidenceClass UNAVAILABLE — and the registry gate fails on that, which is the point. */
const EVIDENCE_WORDS = ['PUBLISHED', 'ADOPTED', 'ASSUMED', 'STANDARD', 'LABEL', 'VENDOR', 'SIMULATED'];
function modelProvenance(modelSource) {
  const lines = modelSource.split('\n');
  const out = new Map();
  const stack = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const open = line.match(/^\s*([a-zA-Z0-9_]+):\s*\{\s*$/);
    if (open) { stack.push(open[1]); continue; }
    if (/^\s*\},?\s*$/.test(line) && stack.length) { stack.pop(); continue; }
    if (/^\s*\]\s*,?\s*$/.test(line)) continue;
    /* an INLINE object — `pueDesignBand: { min: 1.12, max: 1.25, target: 1.12 }` — registers
       each of its leaves against the comment above the line */
    const inline = line.match(/^\s*([a-zA-Z0-9_]+):\s*\{([^{}]*)\}\s*,?\s*(\/\/.*)?$/);
    const leaf = inline ? null : line.match(/^\s*([a-zA-Z0-9_]+):\s*(-?[0-9.]+|'[^']*'|"[^"]*"|true|false),?\s*(\/\/.*)?$/);
    if (!leaf && !inline) continue;
    /* Walk up for the governing comment. A leaf may share a comment with the siblings above
       it — `unitKwTh` sits under `model:` under one block comment — so sibling leaf lines are
       SKIPPED rather than treated as the end of the comment. A blank line or a brace ends it. */
    const comment = [];
    for (let j = i - 1; j >= 0 && j >= i - 16; j -= 1) {
      const c = lines[j].trim();
      if (c === '' || /[{}]\s*,?$/.test(c)) break;
      if (/^\/\//.test(c)) { comment.unshift(c.replace(/^\/\/\s?/, '')); continue; }
      if (/^\/\*/.test(c) || /\*\/$/.test(c)) { comment.unshift(c.replace(/^\/\*\s?|\s?\*\/$/g, '')); continue; }
      if (/^\*/.test(c)) { comment.unshift(c.replace(/^\*\s?/, '')); continue; }
      if (comment.length) break;                 // a leaf line above an already-found comment ends it
      if (/^[a-zA-Z0-9_]+:\s*/.test(c)) continue; // a sibling leaf with no comment of its own — keep walking
      break;
    }
    const base = [...stack.filter((s) => s !== 'MODEL')];
    const paths = inline
      ? [...inline[2].matchAll(/([a-zA-Z0-9_]+):\s*(-?[0-9.]+|'[^']*'|"[^"]*")/g)].map((m) => [...base, inline[1], m[1]].join('.'))
      : [[...base, leaf[1]].join('.')];
    const text = comment.join(' ').replace(/\s+/g, ' ').trim();
    const sourceIdx = text.indexOf('source:');
    const sourceText = sourceIdx >= 0 ? text.slice(sourceIdx + 7).trim() : '';
    let evidence = 'UNAVAILABLE';
    for (const w of EVIDENCE_WORDS) {
      if (new RegExp(`\\b${w}\\b`).test(sourceText || text)) evidence = w;   // last match wins by order below
    }
    /* last occurring taxonomy word decides (e.g. "PUBLISHED (for the unit) / ADOPTED (as the plane)") */
    let lastPos = -1;
    for (const w of EVIDENCE_WORDS) {
      const p = (sourceText || text).lastIndexOf(w);
      if (p > lastPos) { lastPos = p; evidence = w; }
    }
    for (const path of paths) out.set(path, { sourceText, evidence });
  }
  return out;
}

function docFiles() {
  const out = [];
  for (const dir of ['manual', 'standarization']) {
    let entries; try { entries = readdirSync(join(ROOT, dir)); } catch { continue; }
    for (const name of entries) if (/\.(html|md)$/.test(name)) out.push(`${dir}/${name}`);
  }
  return out.sort();
}
function gateFiles() {
  return readdirSync(join(ROOT, 'tools')).filter((f) => /^test-dcai[-\w]*\.mjs$/.test(f)).sort();
}

export function renderBrowserTwin(built) {
  return `/* GENERATED by tools/build-dcai-parameter-registry.mjs — DO NOT EDIT.
 * Browser-loadable twin of data/dcai-parameters.json for js/rz-basis-drawer.js.
 */
window.RZ_DCAI_PARAMETERS = ${JSON.stringify(built)};
`;
}

/* Unit inferred from the id suffix — the engine's naming discipline makes this mechanical. */
export function unitFor(id) {
  const leaf = id.split('.').pop();
  const table = [
    [/_kwe$/, 'kW'], [/_kwth$/, 'kW (thermal)'], [/_kwh$/, 'kWh'], [/_kva$/, 'kVA'], [/_kw$/, 'kW'], [/_mw$/, 'MW'],
    [/_mva$/, 'MVA'], [/_c$/, '°C'], [/_k$/, 'K'], [/_m3h$/, 'm³/h'], [/_m3s$/, 'm³/s'], [/_m3$/, 'm³'], [/_m2$/, 'm²'],
    [/_m$/, 'm'], [/_pct$/, '%'], [/_pbs$/, 'Pb/s'], [/_tbs$/, 'TB/s'], [/_gbs$/, 'GB/s'], [/_pb_/, 'PB'], [/_ratio$|_fraction$/, null],
    [/^pue|\.pue$|_pue$|pue_/, null], [/l_per_kwh/, 'L/kWh'], [/hours?$/, 'h'], [/kw_per_m2$/, 'kW/m²'], [/_gpu_gbs/, 'GB/s'],
  ];
  for (const [re, unit] of table) if (re.test(leaf)) return unit;
  return null;
}

export function buildRegistry({ scaffold = false } = {}) {
  const live = loadEngine();
  const liveFlat = flatten(live.snapshot, '', new Map());
  const provenance = modelProvenance(readFileSync(MODEL, 'utf8'));

  /* two operating points */
  const cliff = live.snapshot.pue.free_cooling_cliff_ambient_c;
  const pastCliff = (calc) => flatten(calc.operatingPoint(cliff + 0.5), 'cliff', new Map());
  const liveCliffFlat = pastCliff(live);

  const inputs = modelLeaves(live.model, '', new Map());
  if (inputs.size === 0) throw new Error('no authored numeric inputs found on DCAI_MODEL');
  const dependsOn = new Map([...liveFlat.keys()].map((id) => [id, new Set()]));
  const dependsOnCliff = new Map([...liveFlat.keys()].map((id) => [id, new Set()]));
  const mirrors = new Map();

  for (const [inputPath, inputValue] of inputs) {
    for (const factor of [1.37, 0.73]) {
      const probeModel = clone(live.model);
      const probeValue = inputValue === 0 ? (factor > 1 ? 3.7 : -3.7) : inputValue * factor;
      setAt(probeModel, inputPath, probeValue);
      let probeFlat, probeCliff;
      try {
        const probeSnapshot = live.compute(probeModel);
        probeFlat = flatten(probeSnapshot, '', new Map());
        /* the cliff point of the PROBED model, measured at the probed model's own cliff */
        const probeCalc = live.build ? live.build(probeModel) : null;
        probeCliff = probeCalc ? flatten(probeCalc.operatingPoint(probeSnapshot.pue.free_cooling_cliff_ambient_c + 0.5), 'cliff', new Map()) : null;
      } catch {
        continue;   // a fail-closed guard rejecting an off-design input is correct, not an edge
      }
      for (const [id, value] of liveFlat) {
        const next = probeFlat.get(id);
        if (next !== value) {
          dependsOn.get(id).add(inputPath);
          if (next === probeValue) mirrors.set(id, inputPath);
        }
      }
      if (probeCliff) {
        /* cliff-point edges are recorded against the DESIGN ids they correspond to */
        for (const [cid, value] of liveCliffFlat) {
          const designId = 'design' + cid.slice('cliff'.length);
          if (!dependsOnCliff.has(designId)) continue;
          if (probeCliff.get(cid) !== value) dependsOnCliff.get(designId).add(inputPath);
        }
      }
    }
  }

  let curated = { parameters: [] };
  if (existsSync(CURATED)) curated = JSON.parse(readFileSync(CURATED, 'utf8'));
  const curatedById = new Map(curated.parameters.map((p) => [p.id, p]));

  const pageSources = COCKPITS.map((page) => ({ page, text: readFileSync(join(ROOT, page), 'utf8') }));
  const docSources = docFiles().map((file) => ({ file, text: readFileSync(join(ROOT, file), 'utf8') }));
  const gateSources = gateFiles().map((file) => ({ file, text: readFileSync(join(ROOT, 'tools', file), 'utf8') }));

  const leafCounts = new Map();
  for (const id of liveFlat.keys()) { const leaf = id.split('.').pop(); leafCounts.set(leaf, (leafCounts.get(leaf) || 0) + 1); }
  const uniqueLeaves = new Set([...leafCounts.entries()].filter(([, n]) => n === 1).map(([l]) => l));
  const readTokens = (id) => {
    const parts = id.split('.'); const leaf = parts[parts.length - 1];
    const tokens = [`.${parts.slice(-2).join('.')}`];
    if (uniqueLeaves.has(leaf)) tokens.push(`.${leaf}`);
    return tokens;
  };

  const parameters = [];
  const newIds = [];
  for (const [id, value] of [...liveFlat.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const edges = [...dependsOn.get(id)].sort();
    const cliffEdges = [...dependsOnCliff.get(id)].sort();
    const mirror = mirrors.get(id) || null;
    const isMirror = Boolean(mirror) && edges.length === 1;
    const movedAtDesign = edges.length > 0 && !isMirror;
    const movedAtCliff = cliffEdges.length > 0;
    /* A MIRROR is authored whatever happens past the cliff: `design.ambient_db_c` republishes
       the design ambient, and the fact that the cliff point moves when the TCS plane moves says
       nothing about the ambient leaf. The first run filed five mirrors as slack for exactly
       that reason. Slack is reserved for a non-mirror that no leaf moves at design. */
    let kind = isMirror ? 'authored' : (movedAtDesign ? 'derived' : (movedAtCliff ? 'slack' : 'authored'));
    const meta = curatedById.get(id) || {};
    if (!curatedById.has(id)) newIds.push(id);
    const tokens = readTokens(id);

    const consumers = [];
    for (const { page, text } of pageSources) {
      let reads = tokens.reduce((s, t) => s + grepCount(text, t), 0);
      reads += grepCount(text, `data-basis-param="${id}"`);
      if (reads > 0) consumers.push({ page, reads });
    }
    const tests = gateSources.filter(({ text }) => tokens.some((t) => text.includes(t))).map(({ file }) => file);
    const docs = docSources.filter(({ text }) => text.includes(id)).map(({ file }) => file);
    /* No formula gate is credited here until tools/test-dcai-formula.mjs EXISTS. Crediting a
       gate that has not been written is how a coverage figure becomes fiction. */
    if (kind !== 'derived' && typeof value === 'number') tests.push('test-dcai-parameter-registry.mjs (provenance + evidence class)');
    if (kind === 'slack') tests.push('test-dcai-parameter-registry.mjs (slack: cliff edges present)');
    if (/(^|[._])evidence_class$/.test(id) || /^meta\./.test(id)) tests.push('test-dcai-parameter-registry.mjs (semantic check)');

    /* provenance: authored leaves take it from the model file; derived/slack are DERIVED */
    let evidenceClass = meta.evidenceClass ?? null;
    let source = meta.source ?? null;
    if (kind === 'authored' && mirror && provenance.has(mirror)) {
      const p = provenance.get(mirror);
      evidenceClass = evidenceClass ?? p.evidence;
      source = source ?? { ref: `js/dcai-model.js ${mirror}`, method: p.sourceText || 'no // source: comment on this leaf', asOf: '2026-09-06' };
    } else if (kind === 'authored' && typeof value !== 'number') {
      evidenceClass = evidenceClass ?? 'LABEL';
      source = source ?? { ref: 'js/dcai-model.js', method: 'text label or identifier republished from the model', asOf: '2026-09-06' };
    } else if (kind !== 'authored') {
      evidenceClass = evidenceClass ?? 'DERIVED';
    }
    if (kind === 'authored' && typeof value === 'number' && !mirror) {
      /* a number nothing moves and that echoes no single leaf: a structural constant */
      evidenceClass = evidenceClass ?? 'UNAVAILABLE';
    }

    const record = {
      id,
      label: meta.label ?? null,
      unit: meta.unit !== undefined ? meta.unit : unitFor(id),
      kind,
      value: (typeof value === 'string' && /^\[\d+ items\] /.test(value))
        ? `${value.slice(0, value.indexOf('] ') + 1)} sha1:${createHash('sha1').update(value).digest('hex').slice(0, 12)}`
        : value,
      formula: meta.formula ?? null,
      ...(meta.formulaExpr ? { formulaExpr: meta.formulaExpr } : {}),
      ...(meta.formulaNotExpressible ? { formulaNotExpressible: meta.formulaNotExpressible } : {}),
      ...(meta.display ? { display: meta.display, displayReason: meta.displayReason } : {}),
      deps: meta.deps ?? [],
      scope: meta.scope ?? scopeFor(id),
      evidenceClass: evidenceClass ?? 'UNAVAILABLE',
      explainKey: meta.explainKey ?? null,
      dependsOnInputs: edges,
      dependsOnInputsAtCliff: cliffEdges,
      consumers, tests, docs,
    };
    if (source) record.source = source;
    if (record.label === null) delete record.label;
    parameters.push(record);
  }

  if (scaffold && newIds.length) {
    const stubs = newIds.map((id) => ({
      id, label: labelFor(id), unit: unitFor(id), scope: scopeFor(id),
    }));
    curated.note = curated.note || 'CURATED — hand-maintained labels, units, scopes, formulas and display declarations. Provenance for authored leaves is read from js/dcai-model.js by the generator and must NOT be repeated here.';
    curated.parameters = [...curated.parameters, ...stubs].sort((a, b) => a.id.localeCompare(b.id));
    writeFileSync(CURATED, `${JSON.stringify(curated, null, 2)}\n`);
  }

  return {
    generatedBy: 'tools/build-dcai-parameter-registry.mjs',
    engineVersion: String(live.snapshot.meta.version),
    note: 'GENERATED — do not hand-edit. Curated metadata lives in data/dcai-parameters.curated.json; authored-leaf provenance is read from js/dcai-model.js.',
    parameters,
  };
}

export function scopeFor(id) {
  const [branch, second] = id.split('.');
  if (branch === 'meta') return 'meta';
  if (branch === 'network') return 'network';
  if (branch === 'geometry') return 'hall';
  /* LV distribution is declared per hall: one busway pair and 40 RPP groups per hall */
  if (branch === 'distribution') return 'hall';
  if (branch === 'compute') return /per_rack|per_nvl72|nvlink/.test(id) ? 'rack' : (/per_hall/.test(id) ? 'hall' : 'campus');
  if (branch === 'power') return /^power\.(rack_it_kw|shelf|shelves|psu)/.test(id) ? 'rack' : (/hall/.test(id) ? 'hall' : 'campus');
  if (branch === 'heat') return /hall/.test(id) ? 'hall' : 'campus';
  if (branch === 'equipment') return /per_hall/.test(id) ? 'hall' : 'plant';
  if (branch === 'design') return second === 'planes' || second === 'heat' || second === 'flows' || second === 'counts' ? 'plant' : 'site';
  if (branch === 'bins') return 'site';
  if (branch === 'pue' || branch === 'wue') return 'site';
  return 'site';
}
export function labelFor(id) {
  return id.split('.').pop().replace(/^p\d\d_/, '').replace(/_/g, ' ')
    .replace(/\bkwe\b/, 'kW').replace(/\bkwth\b/, 'kW th').replace(/\bc\b/, '°C').replace(/\bk\b/, 'K');
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const scaffold = process.argv.includes('--scaffold');
  /* --scaffold writes curated stubs for ids it has not seen, then builds AGAIN so the registry
     it writes already carries those stubs' labels — otherwise the file is stale the moment it is
     written and the gate's byte-identical check fails on the very next run. */
  const built = scaffold ? (buildRegistry({ scaffold: true }), buildRegistry()) : buildRegistry();
  const text = `${JSON.stringify(built, null, 2)}\n`;
  if (process.argv.includes('--check')) {
    let current = '', currentJs = '';
    try { current = readFileSync(OUT, 'utf8'); } catch { /* first run */ }
    try { currentJs = readFileSync(OUT_JS, 'utf8'); } catch { /* first run */ }
    if (current !== text || currentJs !== renderBrowserTwin(built)) {
      console.error('STALE — data/dcai-parameters.json does not match a fresh build. Run: node tools/build-dcai-parameter-registry.mjs');
      process.exit(1);
    }
    console.log(`PASS registry is current — ${built.parameters.length} parameters, engine v${built.engineVersion}`);
  } else {
    writeFileSync(OUT, text);
    writeFileSync(OUT_JS, renderBrowserTwin(built));
    const by = (k) => built.parameters.filter((p) => p.kind === k).length;
    console.log(`Wrote ${OUT}\nWrote ${OUT_JS}`);
    console.log(`  ${built.parameters.length} parameters (${by('derived')} derived, ${by('slack')} slack, ${by('authored')} authored), engine v${built.engineVersion}`);
  }
}
