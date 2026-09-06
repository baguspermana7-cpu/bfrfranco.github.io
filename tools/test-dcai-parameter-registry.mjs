/**
 * Ship gate — the AI / HPC (GB300) parameter registry is real, current, and honest.
 *
 *   R1 SCHEMA      every record satisfies data/dcai-parameters.schema.json.
 *   R2 STALENESS   regenerating produces a byte-identical file and browser twin.
 *   R3 PROVENANCE  every AUTHORED number carries a source and an evidence class from the
 *                  taxonomy, read from js/dcai-model.js itself; nothing anywhere claims
 *                  MEASURED; nothing authored is UNAVAILABLE (that is a leaf with no comment).
 *   R4 WIRING      every curated `deps` entry resolves, shares a measured input with its
 *                  dependent, and the graph is acyclic.
 *   R5 SCOPE       a parameter's scope is valid for its snapshot branch.
 *   R6 SEMANTICS   evidence-class VALUES are taxonomy terms; meta.version is semver and
 *                  agrees with the header; the retired-basis files it names still exist.
 *   S1 SLACK       every `slack` parameter has cliff edges and no design edges; every
 *                  parameter whose design value is null or 0 but which is non-null past the
 *                  cliff is either derived (bidirectional probing reached the regime) or slack
 *                  — never authored.
 *   R7 TESTED      REPORTED. Flip to strict when the count reaches zero.
 *   R8 RENDERED    STRICT since v2.0.0 (the commit that switched datahallAI.html): every
 *                  parameter is read by the page or declared internal with a written reason.
 *   R9 DOCS        REPORTED.
 *
 * Run: node tools/test-dcai-parameter-registry.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRegistry, renderBrowserTwin } from './build-dcai-parameter-registry.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const registry = JSON.parse(readFileSync(join(ROOT, 'data', 'dcai-parameters.json'), 'utf8'));
const schema = JSON.parse(readFileSync(join(ROOT, 'data', 'dcai-parameters.schema.json'), 'utf8'));

/* ── R1 schema ─────────────────────────────────────────────────────────────── */
function typeOf(v) { if (v === null) return 'null'; if (Array.isArray(v)) return 'array'; if (Number.isInteger(v)) return 'integer'; return typeof v; }
function matchesType(v, allowed) {
  const list = Array.isArray(allowed) ? allowed : [allowed]; const actual = typeOf(v);
  return list.some((t) => t === actual || (t === 'number' && actual === 'integer'));
}
function validate(value, spec, path, defs) {
  if (spec.$ref) return validate(value, defs[spec.$ref.split('/').pop()], path, defs);
  if (spec.enum) assert.ok(spec.enum.includes(value), `${path}: ${JSON.stringify(value)} is not one of ${spec.enum.join(', ')}`);
  if (spec.type) assert.ok(matchesType(value, spec.type), `${path}: expected ${spec.type}, got ${typeOf(value)}`);
  if (spec.pattern && typeof value === 'string') assert.ok(new RegExp(spec.pattern).test(value), `${path}: ${value} does not match ${spec.pattern}`);
  if (spec.minLength != null && typeof value === 'string') assert.ok(value.length >= spec.minLength, `${path}: shorter than ${spec.minLength}`);
  if (spec.minimum != null && typeof value === 'number') assert.ok(value >= spec.minimum, `${path}: below ${spec.minimum}`);
  if (Array.isArray(value)) {
    if (spec.minItems != null) assert.ok(value.length >= spec.minItems, `${path}: fewer than ${spec.minItems} items`);
    if (spec.items) value.forEach((item, i) => validate(item, spec.items, `${path}[${i}]`, defs));
    return;
  }
  if (value && typeof value === 'object') {
    for (const key of spec.required || []) assert.ok(Object.prototype.hasOwnProperty.call(value, key), `${path}: missing required key "${key}"`);
    if (spec.additionalProperties === false && spec.properties) for (const key of Object.keys(value)) assert.ok(spec.properties[key], `${path}: unexpected key "${key}"`);
    for (const [key, sub] of Object.entries(spec.properties || {})) if (Object.prototype.hasOwnProperty.call(value, key)) validate(value[key], sub, `${path}.${key}`, defs);
  }
}
validate(registry, schema, 'registry', schema.definitions);

/* ── R2 staleness ──────────────────────────────────────────────────────────── */
const built = buildRegistry();
assert.equal(`${JSON.stringify(built, null, 2)}\n`, readFileSync(join(ROOT, 'data', 'dcai-parameters.json'), 'utf8'),
  'data/dcai-parameters.json is stale — run: node tools/build-dcai-parameter-registry.mjs');
assert.equal(renderBrowserTwin(built), readFileSync(join(ROOT, 'js', 'dcai-parameters.js'), 'utf8'),
  'js/dcai-parameters.js is stale — run: node tools/build-dcai-parameter-registry.mjs');

/* ── R3 provenance ─────────────────────────────────────────────────────────── */
const byId = new Map(registry.parameters.map((p) => [p.id, p]));
const AUTHORED_EVIDENCE = new Set(['PUBLISHED', 'ADOPTED', 'ASSUMED', 'STANDARD', 'LABEL', 'VENDOR', 'SIMULATED']);
for (const p of registry.parameters) {
  assert.notEqual(p.evidenceClass, 'MEASURED', `${p.id}: nothing in this engine is MEASURED`);
  if (p.kind === 'authored' && typeof p.value === 'number') {
    assert.ok(p.source && p.source.ref, `${p.id}: an authored constant must cite where it came from`);
    assert.ok(AUTHORED_EVIDENCE.has(p.evidenceClass),
      `${p.id}: authored number carries "${p.evidenceClass}" — a model leaf with no // source: comment, or a structural constant that belongs in the model`);
    assert.ok(!/no \/\/ source: comment/.test(p.source.method || ''), `${p.id}: its model leaf has no // source: comment`);
  }
  if (p.kind !== 'authored') assert.equal(p.evidenceClass, 'DERIVED', `${p.id}: a ${p.kind} value is DERIVED by definition (got ${p.evidenceClass})`);
}

/* ── R4 wiring ─────────────────────────────────────────────────────────────── */
for (const p of registry.parameters) {
  for (const dep of p.deps || []) {
    const target = byId.get(dep);
    assert.ok(target, `${p.id}: declared dep "${dep}" is not a registered parameter`);
    const shared = (target.dependsOnInputs || []).filter((i) => (p.dependsOnInputs || []).includes(i));
    assert.ok(shared.length > 0 || (target.dependsOnInputs || []).length === 0,
      `${p.id}: declares a dependency on ${dep}, but nothing that moves ${dep} moves ${p.id}`);
  }
}
{
  const state = new Map();
  const visit = (id, trail) => {
    if (state.get(id) === 'done') return;
    assert.ok(state.get(id) !== 'open', `dependency cycle: ${[...trail, id].join(' -> ')}`);
    state.set(id, 'open');
    for (const dep of byId.get(id)?.deps || []) visit(dep, [...trail, id]);
    state.set(id, 'done');
  };
  for (const p of registry.parameters) visit(p.id, []);
}

/* ── R5 scope ──────────────────────────────────────────────────────────────── */
const BRANCH_SCOPE = Object.freeze({
  meta: ['meta'], compute: ['rack', 'hall', 'campus'], power: ['rack', 'hall', 'campus'], heat: ['hall', 'campus'],
  design: ['plant', 'site'], bins: ['site'], equipment: ['hall', 'plant'], network: ['network'], geometry: ['hall'],
  distribution: ['rack', 'hall', 'plant'],
  pue: ['site'], wue: ['site'],
});
for (const p of registry.parameters) {
  const branch = p.id.split('.')[0];
  assert.ok(BRANCH_SCOPE[branch], `${p.id}: unknown snapshot branch "${branch}" — register its scope rule`);
  assert.ok(BRANCH_SCOPE[branch].includes(p.scope), `${p.id}: scope "${p.scope}" is not valid for the ${branch} branch`);
}

/* ── R6 semantics ──────────────────────────────────────────────────────────── */
const EVIDENCE = new Set(['MEASURED', 'DERIVED', 'SIMULATED', 'ADOPTED', 'ASSUMED', 'VENDOR', 'PUBLISHED', 'STANDARD', 'LABEL', 'UNAVAILABLE']);
const valueOf = (id) => byId.get(id) && byId.get(id).value;
for (const p of registry.parameters) {
  if (!/(^|[._])evidence_class$/.test(p.id)) continue;
  for (const part of String(p.value).split('/')) assert.ok(EVIDENCE.has(part.trim()), `${p.id}: publishes "${p.value}", not in the taxonomy`);
}
assert.match(String(valueOf('meta.version')), /^\d+\.\d+\.\d+$/, 'meta.version must be semver');
assert.equal(String(valueOf('meta.version')), registry.engineVersion, 'meta.version disagrees with the registry header');
for (const f of String(valueOf('meta.retired_basis')).match(/js\/[\w-]+\.js/g) || []) {
  assert.ok(existsSync(join(ROOT, f)), `meta.retired_basis names ${f}, which does not exist — a retirement must point at the frozen file`);
}
assert.equal(valueOf('power.it_envelope'), 'rack-only', 'the owner decision "500 MW = rack IT" must be published as it_envelope');
assert.equal(valueOf('wue.l_per_kwh'), 0, 'dry-only basis: WUE must be structurally zero');
assert.equal(valueOf('meta.annual_evidence_class'), 'ASSUMED', 'annual figures are ASSUMED until a TMY exists');

/* ── S1 slack ──────────────────────────────────────────────────────────────── */
for (const p of registry.parameters) {
  if (p.kind === 'slack') {
    assert.ok(p.dependsOnInputsAtCliff.length > 0 && p.dependsOnInputs.length === 0, `${p.id}: slack must have cliff edges and no design edges`);
  }
  if (/^design\./.test(p.id) && (p.value === null || p.value === 0) && p.dependsOnInputsAtCliff.length > 0) {
    assert.notEqual(p.kind, 'authored', `${p.id}: is ${p.value} at design and moves past the cliff — it cannot be an authored constant`);
  }
}

/* ── R7 / R8 / R9 — reported with written flip conditions ───────────────────── */
const untested = registry.parameters.filter((p) => p.tests.length === 0);
const unread = registry.parameters.filter((p) => p.consumers.length === 0 && p.display !== 'internal');
const undocumented = registry.parameters.filter((p) => !p.docs || p.docs.length === 0);
const kinds = (k) => registry.parameters.filter((p) => p.kind === k).length;

console.log(`PASS DCAI parameter registry — ${registry.parameters.length} parameters (${kinds('derived')} derived, ${kinds('slack')} slack, ${kinds('authored')} authored), engine v${registry.engineVersion}`);
console.log('     schema OK · current · provenance complete from js/dcai-model.js · graph acyclic and measured (bidirectional, two operating points)');
/* R7 reached 176/176 on the first ship and is STRICT from day one — the Conventional registry
   carried "77 untested" for four releases because its gate was reporting, not failing. */
assert.equal(untested.length, 0,
  'parameters with no gate asserting them: ' + untested.map((p) => p.id).join(', ')
  + '. Add an identity to tools/test-dcai-engine.mjs — not an exemption.');
console.log(`     R7 tested: ${registry.parameters.length}/${registry.parameters.length} asserted by a gate (STRICT)`);
/* R8 flipped STRICT in v2.0.0 — the commit that switched datahallAI.html to this engine, as the
   flip condition written in v1.136.0 required. */
assert.equal(unread.length, 0,
  'parameters no cockpit renders and which are not declared internal: ' + unread.map((p) => p.id).join(', ')
  + '. Render it, or mark display: internal with a reason in data/dcai-parameters.curated.json.');
for (const p of registry.parameters) {
  if (p.display !== 'internal') continue;
  assert.ok(p.displayReason && p.displayReason.length >= 40, `${p.id}: declared internal but the reason is missing or too short`);
}
const internal = registry.parameters.filter((p) => p.display === 'internal').length;
console.log(`     R8 rendered: ${registry.parameters.length - internal}/${registry.parameters.length} read by datahallAI.html, ${internal} declared internal with a reason (STRICT)`);
console.log(`     R9 docs: ${registry.parameters.length - undocumented.length}/${registry.parameters.length} named by a file under manual/ or standarization/ (REPORTED)`);
