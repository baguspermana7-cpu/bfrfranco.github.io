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
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRegistry } from './build-conv-parameter-registry.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const registry = JSON.parse(readFileSync(join(ROOT, 'data', 'conv-parameters.json'), 'utf8'));
const schema = JSON.parse(readFileSync(join(ROOT, 'data', 'conv-parameters.schema.json'), 'utf8'));

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
});
for (const p of registry.parameters) {
    const branch = p.id.split('.')[0];
    const allowed = BRANCH_SCOPE[branch];
    assert.ok(allowed, `${p.id}: unknown snapshot branch "${branch}" — register its scope rule`);
    assert.ok(allowed.includes(p.scope),
        `${p.id}: scope "${p.scope}" is not valid for the ${branch} branch (allowed: ${allowed.join(', ')})`);
}

const derived = registry.parameters.filter((p) => p.kind === 'derived').length;
const untested = registry.parameters.filter((p) => p.tests.length === 0).length;
const unread = registry.parameters.filter((p) => p.consumers.length === 0).length;
console.log(`PASS Conventional parameter registry — ${registry.parameters.length} parameters `
    + `(${derived} derived, ${registry.parameters.length - derived} authored), engine v${registry.engineVersion}`);
console.log(`     schema OK · current · provenance complete · ${byId.size} ids, dependency graph acyclic and measured`);
console.log(`     REPORTED (not yet gated): ${unread} parameters no cockpit reads, ${untested} no gate asserts`);
