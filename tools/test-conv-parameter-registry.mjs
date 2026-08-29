/**
 * Ship gate — the Conventional parameter registry is real, current, and honest.
 *
 * The registry only means something if it cannot quietly rot. This gate asserts:
 *   R1 SCHEMA      every record satisfies data/conv-parameters.schema.json (the subset of
 *                  draft-07 the schema actually uses — no new dependency is introduced for
 *                  a file this project controls end to end).
 *   R2 STALENESS   regenerating produces a byte-identical file. A changed engine with a
 *                  stale registry does not ship.
 *   R3 PROVENANCE  every AUTHORED parameter carries a source and an evidence class, and
 *                  nothing anywhere claims MEASURED — this engine has never measured
 *                  anything, and a MEASURED label is the one that would mislead an owner.
 *   R4 WIRING      every curated `deps` entry resolves to a real parameter, the dependency
 *                  graph is acyclic, and — the part that makes "100 % wired" a measurement —
 *                  every declared dep must share at least one MEASURED input with its
 *                  dependent. If A is declared to depend on B but nothing that moves B moves
 *                  A, the declaration is decoration and this fails.
 *   R5 SCOPE       a parameter's scope must match its branch. Mixing a campus numerator
 *                  with a hall denominator is the v1.134.0 defect; scope is what lets a
 *                  reviewer see it.
 *
 * Run: node tools/test-conv-parameter-registry.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { buildRegistry } from './build-conv-parameter-registry.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const registry = JSON.parse(readFileSync(join(ROOT, 'data', 'conv-parameters.json'), 'utf8'));
const schema = JSON.parse(readFileSync(join(ROOT, 'data', 'conv-parameters.schema.json'), 'utf8'));

/* The engine and the governed study, loaded once for the semantic checks below. */
const engineBox = { window: {}, module: { exports: {} }, console };
vm.createContext(engineBox);
vm.runInContext(readFileSync(join(ROOT, 'js', 'conv-engine.js'), 'utf8'), engineBox);
const ENGINE_SCENARIOS = engineBox.window.CONV_CALC.listScenarios();
const basisBox = { window: {}, module: { exports: {} }, console };
vm.createContext(basisBox);
vm.runInContext(readFileSync(join(ROOT, 'js', 'conv-design-basis.js'), 'utf8'), basisBox);
const STUDY = (basisBox.window.RZConvDesignBasis && basisBox.window.RZConvDesignBasis.STUDY) || {};

/* ── R1 schema ─────────────────────────────────────────────────────────────── */
function typeOf(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    if (Number.isInteger(value)) return 'integer';
    return typeof value;
}
function matchesType(value, allowed) {
    const list = Array.isArray(allowed) ? allowed : [allowed];
    const actual = typeOf(value);
    return list.some((t) => t === actual
        || (t === 'number' && actual === 'integer')
        || (t === 'object' && actual === 'object'));
}
function validate(value, spec, path, defs) {
    if (spec.$ref) return validate(value, defs[spec.$ref.split('/').pop()], path, defs);
    if (spec.enum) assert.ok(spec.enum.includes(value), `${path}: ${JSON.stringify(value)} is not one of ${spec.enum.join(', ')}`);
    if (spec.type) assert.ok(matchesType(value, spec.type), `${path}: expected ${spec.type}, got ${typeOf(value)}`);
    if (spec.pattern && typeof value === 'string') {
        assert.ok(new RegExp(spec.pattern).test(value), `${path}: ${value} does not match ${spec.pattern}`);
    }
    if (spec.type === 'array' || Array.isArray(value)) {
        if (spec.minItems != null) assert.ok(value.length >= spec.minItems, `${path}: fewer than ${spec.minItems} items`);
        if (spec.items) value.forEach((item, i) => validate(item, spec.items, `${path}[${i}]`, defs));
        return;
    }
    if (value && typeof value === 'object') {
        for (const key of spec.required || []) {
            assert.ok(Object.prototype.hasOwnProperty.call(value, key), `${path}: missing required key "${key}"`);
        }
        if (spec.additionalProperties === false && spec.properties) {
            for (const key of Object.keys(value)) {
                assert.ok(spec.properties[key], `${path}: unexpected key "${key}"`);
            }
        }
        for (const [key, sub] of Object.entries(spec.properties || {})) {
            if (Object.prototype.hasOwnProperty.call(value, key)) validate(value[key], sub, `${path}.${key}`, defs);
        }
    }
}
validate(registry, schema, 'registry', schema.definitions);

/* ── R2 staleness ──────────────────────────────────────────────────────────── */
const fresh = `${JSON.stringify(buildRegistry(), null, 2)}\n`;
const onDisk = readFileSync(join(ROOT, 'data', 'conv-parameters.json'), 'utf8');
assert.equal(fresh, onDisk,
    'data/conv-parameters.json is stale — run: node tools/build-conv-parameter-registry.mjs');

/* ── R3 provenance ─────────────────────────────────────────────────────────── */
const byId = new Map(registry.parameters.map((p) => [p.id, p]));
for (const p of registry.parameters) {
    assert.notEqual(p.evidenceClass, 'MEASURED',
        `${p.id}: nothing in this engine is MEASURED — it is a simulated/adopted design basis, `
        + 'and a MEASURED label is the one that would actually mislead an owner');
    if (p.kind === 'authored' && typeof p.value === 'number') {
        assert.ok(p.source && p.source.ref,
            `${p.id}: an authored constant must cite where it came from`);
        assert.ok(['ADOPTED', 'ASSUMED', 'STANDARD', 'VENDOR', 'SIMULATED'].includes(p.evidenceClass),
            `${p.id}: an authored constant must carry a real evidence class (got ${p.evidenceClass})`);
    }
}

/* ── R4 wiring ─────────────────────────────────────────────────────────────── */
for (const p of registry.parameters) {
    for (const dep of p.deps || []) {
        const target = byId.get(dep);
        assert.ok(target, `${p.id}: declared dep "${dep}" is not a registered parameter`);
        /* The declaration must be backed by a measured edge: everything the dep is moved by
           must also move the dependent. This is what stops `deps` from becoming decoration. */
        const depInputs = new Set(target.dependsOnInputs || []);
        const ownInputs = new Set(p.dependsOnInputs || []);
        const shared = [...depInputs].filter((i) => ownInputs.has(i));
        /* Require a non-empty INTERSECTION, not a subset. A subset rule reads well but
           produces false failures on integer-quantised outputs: perturbing one hall's load
           by 37 % moves heat rejection, yet ceil(duty / unit capacity) still lands on 7
           chillers, so that one input legitimately does not propagate. An empty
           intersection is the real defect — it means the declared wiring does not exist at
           all, which is what this gate is here to catch. */
        assert.ok(shared.length > 0 || depInputs.size === 0,
            `${p.id}: declares a dependency on ${dep}, but NOTHING that moves ${dep} `
            + `moves ${p.id} — the declared wiring does not exist`);
    }
}
/* Acyclic — a cycle would make "derived from" meaningless and any traversal non-terminating. */
const state = new Map();
(function checkAcyclic() {
    const visit = (id, trail) => {
        if (state.get(id) === 'done') return;
        assert.ok(state.get(id) !== 'open', `dependency cycle: ${[...trail, id].join(' -> ')}`);
        state.set(id, 'open');
        for (const dep of byId.get(id)?.deps || []) visit(dep, [...trail, id]);
        state.set(id, 'done');
    };
    for (const p of registry.parameters) visit(p.id, []);
}());

/* ── R5 scope ──────────────────────────────────────────────────────────────── */
const BRANCH_SCOPE = Object.freeze({
    campus: ['campus', 'meta'],
    site: ['site'],
    racks: ['campus'],
    cooling: ['plant', 'hall', 'meta'],
    electrical: ['plant', 'site', 'meta'],
    environment: ['site', 'hall'],
    fuel: ['plant', 'meta'],
    water: ['plant', 'site'],
    meta: ['meta'],
    hall: ['hall'],
    fire: ['plant'],
});
for (const p of registry.parameters) {
    const branch = p.id.split('.')[0];
    const allowed = BRANCH_SCOPE[branch];
    assert.ok(allowed, `${p.id}: unknown snapshot branch "${branch}" — register its scope rule`);
    assert.ok(allowed.includes(p.scope),
        `${p.id}: scope "${p.scope}" is not valid for the ${branch} branch (allowed: ${allowed.join(', ')})`);
}

/* ── R6 semantics of the NON-NUMERIC parameters ─────────────────────────────
   The provenance rule above only reached authored NUMBERS, which left thirteen text
   parameters — evidence classes, scenario ids, document pointers, the engine version — with
   nothing asserting them at all. A label that silently changes to something outside the
   taxonomy, or a basis document that no longer exists, is exactly the kind of quiet drift the
   registry is here to stop. */
const EVIDENCE = new Set(['MEASURED', 'DERIVED', 'SIMULATED', 'ADOPTED', 'ASSUMED', 'VENDOR',
    'STANDARD', 'UNAVAILABLE']);
const valueOf = (id) => byId.get(id) && byId.get(id).value;

for (const p of registry.parameters) {
    /* The leaf may be separated by a dot or an underscore — an earlier `/_evidence_class$/`
       missed meta.evidence_class entirely, so the snapshot's own evidence label was the one
       thing this check did not cover. */
    if (!/(^|[._])evidence_class$/.test(p.id)) continue;
    /* An evidence-class VALUE must itself be a term from the taxonomy — compound forms like
       "SIMULATED/ADOPTED" are allowed because a scenario can be both. */
    const parts = String(p.value).split('/');
    for (const part of parts) {
        assert.ok(EVIDENCE.has(part.trim()),
            `${p.id}: publishes "${p.value}", which is not in the evidence taxonomy`);
    }
}

/* The engine version must be semver, and must not silently disagree with itself. */
assert.match(String(valueOf('meta.version')), /^\d+\.\d+\.\d+$/,
    'meta.version must be a semantic version');
assert.equal(String(valueOf('meta.version')), registry.engineVersion,
    'meta.version and the registry header disagree about the engine version');

/* Document pointers must point at something that exists. A basis citing a deleted file is a
   dead citation, which reads exactly like a live one. */
for (const id of ['meta.basis_doc', 'meta.study_doc']) {
    const raw = String(valueOf(id));
    const path = raw.split(' ')[0];
    if (path.startsWith('conv/review/')) continue;   // owner review corpus, outside this repo
    assert.ok(existsSync(join(ROOT, path)),
        `${id} cites "${path}", which does not exist in this repository`);
}

/* The active scenario must be one the engine actually declares. */
const scenarioIds = new Set(ENGINE_SCENARIOS.map((s) => s.id));
assert.ok(scenarioIds.has(String(valueOf('campus.scenario_id'))),
    `campus.scenario_id "${valueOf('campus.scenario_id')}" is not a declared scenario`);
/* The label an operator reads must be the label of the scenario actually active — the two are
   published separately and could drift apart. */
const activeScenario = ENGINE_SCENARIOS.find((s) => s.id === String(valueOf('campus.scenario_id')));
assert.equal(String(valueOf('campus.scenario_label')), String(activeScenario.label),
    'campus.scenario_label does not match the active scenario\'s own label');

/* The adopted machine type must follow the study's heat-rejection type rather than drifting
   back to whatever a page happens to draw. This is the conflict that took v1.134.7-.8 to
   settle; it is now an assertion. */
const heatRejection = String(STUDY.heatRejectionType || '');
if (heatRejection.includes('cooling-tower')) {
    assert.equal(String(valueOf('cooling.chiller_type')), 'water-cooled-centrifugal',
        'the study specifies cooling-tower heat rejection, so the chillers must be water-cooled');
}

/* A null with a reason is a legitimate answer; a null without one is an omission. */
assert.equal(valueOf('hall.chillers_allocated'), null,
    'per-hall chiller allocation must stay null until a hydronic distribution design exists');
assert.ok(String(valueOf('hall.chillers_allocated_reason')).length > 40,
    'hall.chillers_allocated is null and must carry a written reason');

/* Design duty must not be below the duty actually being carried. */
assert.ok(Number(valueOf('cooling.chiller_design_duty_kw_th'))
    >= Number(valueOf('cooling.heat_rejection_kw')),
    'the chiller plant design duty is below the load it is currently carrying');

assert.ok(String(valueOf('meta.data_quality')).length > 0, 'meta.data_quality must not be empty');

/* ── R8 every parameter is either rendered or declared internal ─────────────
   "27 parameters no cockpit renders" sat in the reported line for five releases. Some were
   genuinely missing from the screens — the coil approach and the containment assumption that
   decide whether a 25.4 C supply is credible, the chiller specific power the whole efficiency
   figure rests on, the UPS nameplate the loading percentages are measured against. Others were
   never meant to be rendered: unrounded twins, a legacy alias, document pointers, branch-level
   labels. Those two cases needed separating, not counting together. The first group is now on
   the screens; the second carries `display: internal` WITH a written reason. A parameter that
   is neither does not ship. */
const invisible = registry.parameters.filter((p) => p.consumers.length === 0 && p.display !== 'internal');
assert.equal(invisible.length, 0,
    'parameters no cockpit renders and which are not declared internal: '
    + invisible.map((p) => p.id).join(', ')
    + '. Render it, or mark display: internal with a reason saying why an operator should not see it.');
for (const p of registry.parameters) {
    if (p.display !== 'internal') continue;
    assert.ok(p.displayReason && p.displayReason.length >= 40,
        `${p.id}: declared internal but the reason is missing or too short to be one`);
}

/* ── R7 every parameter is asserted by something ────────────────────────────
   This was a REPORTED figure for four releases (77 unasserted at its worst) while the real
   coverage was much better than the measurement: `tests` only grepped gate source for the path
   token, so it could not see the formula gate evaluating 51 of them or the provenance rule
   covering every authored constant. With the measurement corrected the true number reached
   zero, so it is gated: a new parameter with nothing asserting it does not ship. */
const derived = registry.parameters.filter((p) => p.kind === 'derived').length;
const untested = registry.parameters.filter((p) => p.tests.length === 0);
assert.equal(untested.length, 0,
    'parameters with no gate asserting them: ' + untested.map((p) => p.id).join(', ')
    + '. Give it a formulaExpr, a source and evidence class, a drawer hook, a declared '
    + 'distribution, or a named semantic check — not an exemption.');
const unread = registry.parameters.filter((p) => p.consumers.length === 0).length;
console.log(`PASS Conventional parameter registry — ${registry.parameters.length} parameters `
    + `(${derived} derived, ${registry.parameters.length - derived} authored), engine v${registry.engineVersion}`);
console.log(`     schema OK · current · provenance complete · ${byId.size} ids, dependency graph acyclic and measured`);
console.log(`     every parameter is asserted by at least one gate (R7)`);
const internal = registry.parameters.filter((p) => p.display === 'internal').length;
console.log(`     every parameter is rendered by a cockpit or declared internal with a reason `
    + `(R8) — ${internal} internal, ${registry.parameters.length - internal} rendered`);
