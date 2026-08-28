/**
 * Build data/conv-parameters.json — the Conventional parameter registry.
 *
 * WHY
 * ---
 * Owner requirement: every variable and parameter wired to every other one, 100 %, and
 * traceable — held in a schema/database rather than hardcoded in three places. Three
 * separate `basisFor` dictionaries already state provenance by hand, and v1.132.0/v1.134.0
 * showed what that costs: a drawer can claim a provenance it does not have, and a page can
 * render a number nothing ever bound. One generated registry removes the hand-copying.
 *
 * WHAT IS GENERATED vs CURATED
 * ----------------------------
 *   GENERATED (never hand-edit): id, kind, value, deps, consumers, tests.
 *     - `value` and `kind` come from executing the real engine twice: once as shipped and
 *       once with every authored constant perturbed. A field that MOVES under perturbation
 *       is derived; a field that does not is authored. This is the same trick the binding
 *       gate uses on the DOM, applied to the engine itself — it cannot be fooled by a
 *       comment that claims a value is computed.
 *     - `consumers` and `tests` come from grepping the pages and the gates.
 *   CURATED (data/conv-parameters.curated.json): label, unit, scope, evidenceClass, source,
 *     explainKey, formula. A machine cannot know that 6.0 K is ASSUMED pending a coil
 *     selection, or that PUE is site-scoped and rack count is hall-scoped.
 *
 * Run:  node tools/build-conv-parameter-registry.mjs            # write
 *       node tools/build-conv-parameter-registry.mjs --check    # staleness only, exit 1 on drift
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { createHash } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const ENGINE = join(ROOT, 'js', 'conv-engine.js');
const CURATED = join(ROOT, 'data', 'conv-parameters.curated.json');
const OUT = join(ROOT, 'data', 'conv-parameters.json');
/* Browser-loadable twin. This site is zero-build and ES5, and its cockpits are opened over
   file:// by some gates, where fetch() of a JSON file fails. A plain <script> that assigns a
   global always loads. The twin is GENERATED from the same object as the JSON, and the gate
   asserts the two agree, so there is no second source of truth to drift. */
const OUT_JS = join(ROOT, 'js', 'conv-parameters.js');

/* The eight Conventional cockpits. A page is added here deliberately, never discovered —
   that is the point: a new cockpit must be registered, not silently uncovered. */
export const COCKPITS = Object.freeze([
    'dc-conventional.html', 'datahall.html', 'chiller-plant.html', 'water-system.html',
    'fire-system.html', 'fuel-system.html', 'ict.html', 'EPMS_Telemetry.html',
]);

function loadEngine(source) {
    const sandbox = { window: {}, module: { exports: {} }, console };
    vm.createContext(sandbox);
    vm.runInContext(source, sandbox, { filename: 'conv-engine.js' });
    const calc = sandbox.window.CONV_CALC || sandbox.module.exports;
    if (!calc || !calc.snapshot) throw new Error('conv-engine.js did not expose CONV_CALC.snapshot');
    return calc;
}

/** Flatten the snapshot to dotted paths. Arrays are summarised, not enumerated: the halls
 *  array is a projection of per-hall parameters, and enumerating it would register four
 *  near-identical copies of every hall field. */
function flatten(node, prefix, out) {
    for (const key of Object.keys(node)) {
        const value = node[key];
        const path = prefix ? `${prefix}.${key}` : key;
        if (Array.isArray(value)) {
            /* Summarise an array by its CONTENT, not its length. `[4 items]` never changed
               when a hall's load changed, so campus.halls measured as having no
               dependencies at all — a detector artefact that would have let a genuinely
               broken projection pass as wired. */
            out.set(path, `[${value.length} items] ${JSON.stringify(value)}`);
        } else if (value && typeof value === 'object') {
            flatten(value, path, out);
        } else {
            out.set(path, value);
        }
    }
    return out;
}

/* AUTHORED INPUTS are the numeric leaves of CONV_MODEL — the engine's actual input space.
   An earlier version of this generator scanned the source for SCREAMING_CASE `var`
   declarations and found only 11 of them, because most authored values live as properties
   on the model object. It therefore reported fuel autonomy and generator burn as having no
   dependencies at all, which was an artefact of the detector, not a property of the engine. */
function modelLeaves(node, prefix, out) {
    for (const key of Object.keys(node)) {
        const value = node[key];
        const path = prefix ? `${prefix}.${key}` : key;
        if (Array.isArray(value)) {
            value.forEach((item, i) => {
                if (item && typeof item === 'object') modelLeaves(item, `${path}.${i}`, out);
            });
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
    if (value && typeof value === 'object') {
        const out = {};
        for (const k of Object.keys(value)) out[k] = clone(value[k]);
        return out;
    }
    return value;
}

function setAt(root, path, value) {
    const parts = path.split('.');
    let node = root;
    for (let i = 0; i < parts.length - 1; i += 1) node = node[parts[i]];
    node[parts[parts.length - 1]] = value;
}

function grepCount(haystack, needle) {
    let count = 0;
    let index = haystack.indexOf(needle);
    while (index !== -1) { count += 1; index = haystack.indexOf(needle, index + needle.length); }
    return count;
}

/** Tokens that count as a page reading a parameter.
 *
 *  `.<parent>.<leaf>` catches the common `var S = CALC.snapshot; ... S.cooling.chws_c` form.
 *  It is NOT enough on its own: fuel-system.html destructures one level further
 *  (`var FUEL = SNAP.fuel; ... FUEL.level_pct`), which contains no `.fuel.` at all — so the
 *  first version of this generator reported that page as reading ZERO parameters while it
 *  plainly reads the whole fuel branch. A detector that silently under-reports coverage is
 *  worse than no detector, so a bare `.<leaf>` also counts WHEN THAT LEAF IS UNIQUE across
 *  the registry. Ambiguous leaves (`wue_l_per_kwh` lives on both environment and water;
 *  `it_load_kw` on site, campus and each hall) keep the strict two-part token, because
 *  crediting the wrong branch would be a different lie. */
function readTokens(id, uniqueLeaves) {
    const parts = id.split('.');
    const leaf = parts[parts.length - 1];
    const tokens = [`.${parts.slice(-2).join('.')}`];
    if (uniqueLeaves.has(leaf)) tokens.push(`.${leaf}`);
    return tokens;
}

function gateFiles() {
    return readdirSync(join(ROOT, 'tools'))
        .filter((f) => /^test-(conv|datahall|epms|ict)[-\w]*\.mjs$/.test(f))
        .sort();
}

export function renderBrowserTwin(built) {
    return `/* GENERATED by tools/build-conv-parameter-registry.mjs — DO NOT EDIT.
 * Browser-loadable twin of data/conv-parameters.json. Cockpits read this through
 * js/rz-basis-drawer.js so a basis drawer renders the registry instead of restating it by
 * hand — the defect repaired in v1.132.0 was a drawer claiming a provenance it did not have.
 */
window.RZ_CONV_PARAMETERS = ${JSON.stringify(built)};
`;
}

export function buildRegistry() {
    const source = readFileSync(ENGINE, 'utf8');
    const live = loadEngine(source);
    const liveFlat = flatten(live.snapshot, '', new Map());

    /* HALL-SCOPED parameters. A cockpit that depicts one hall (datahall.html) needs its
       numbers registered too, and campus.halls is summarised as a digest rather than
       enumerated — four near-identical copies of every field would be noise. Register the
       hall fields ONCE under a `hall.` prefix, taking the first hall as representative.
       That is only honest while the halls are identical, so it is ASSERTED: if a future
       study gives the halls different capacities, this throws instead of quietly letting one
       hall stand for all four. */
    const halls = live.snapshot.campus.halls;
    const shape = (h) => JSON.stringify(Object.keys(h).sort().map((k) => [k, h[k]])
        .filter(([k]) => k !== 'id' && k !== 'code'));
    for (let i = 1; i < halls.length; i += 1) {
        if (shape(halls[i]) !== shape(halls[0])) {
            throw new Error(`hall ${halls[i].code} differs from hall ${halls[0].code}; the `
                + 'registry can no longer register one hall as representative — enumerate them');
        }
    }
    for (const key of Object.keys(halls[0])) {
        if (key === 'id' || key === 'code') continue;
        const value = halls[0][key];
        if (value !== null && typeof value === 'object') continue;
        liveFlat.set(`hall.${key}`, value);
    }

    /* Dependency edges, MEASURED. For every authored model input, recompute the whole engine
       with only that input changed and record which snapshot paths moved. A path that moves
       under input I depends on I. Nothing here trusts a comment, a catalogue or a naming
       convention — this is what turns "everything is wired" into a measurement. */
    const model = clone(live.model);
    const inputs = modelLeaves(model, '', new Map());
    if (inputs.size === 0) throw new Error('no authored numeric inputs found on CONV_MODEL');
    const dependsOn = new Map([...liveFlat.keys()].map((id) => [id, []]));
    const mirrors = new Map();
    for (const [inputPath, inputValue] of inputs) {
        const probeModel = clone(live.model);
        const probeValue = inputValue === 0 ? 3.7 : inputValue * 1.37;
        setAt(probeModel, inputPath, probeValue);
        let probeFlat;
        try {
            const probeSnapshot = live.recompute(probeModel);
            probeFlat = flatten(probeSnapshot, '', new Map());
            /* Mirror the hall expansion so hall.* paths get measured edges too. */
            const probeHall = probeSnapshot.campus.halls[0];
            for (const key of Object.keys(probeHall)) {
                if (key === 'id' || key === 'code') continue;
                const v = probeHall[key];
                if (v !== null && typeof v === 'object') continue;
                probeFlat.set(`hall.${key}`, v);
            }
        } catch {
            /* A fail-closed guard rejecting an off-design input is correct behaviour, not a
               missing edge — skip it rather than recording a false independence. */
            continue;
        }
        for (const [id, value] of liveFlat) {
            const next = probeFlat.get(id);
            if (next === value) continue;
            dependsOn.get(id).push(inputPath);
            /* A path that simply BECOMES the perturbed input is that input republished, not
               something computed from it. Only conclude that when it is the SOLE edge. */
            if (next === probeValue) mirrors.set(id, inputPath);
        }
    }

    const curated = JSON.parse(readFileSync(CURATED, 'utf8'));
    const curatedById = new Map(curated.parameters.map((p) => [p.id, p]));

    const pageSources = COCKPITS.map((page) => ({ page, text: readFileSync(join(ROOT, page), 'utf8') }));
    const gateSources = gateFiles().map((file) => ({ file, text: readFileSync(join(ROOT, 'tools', file), 'utf8') }));

    /* A leaf is unique when exactly one registered id ends with it. */
    const leafCounts = new Map();
    for (const id of liveFlat.keys()) {
        const leaf = id.split('.').pop();
        leafCounts.set(leaf, (leafCounts.get(leaf) || 0) + 1);
    }
    const uniqueLeaves = new Set([...leafCounts.entries()].filter(([, n]) => n === 1).map(([leaf]) => leaf));

    const parameters = [];
    for (const [id, value] of [...liveFlat.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
        const edges = (dependsOn.get(id) || []).sort();
        const mirror = mirrors.get(id) || null;
        /* authored = the path republishes exactly one input unchanged, or nothing upstream
           moves it at all (a string, or a genuinely disconnected constant).
           derived  = an input moves it and it is not merely that input echoed back. */
        const moved = edges.length > 0 && !(mirror && edges.length === 1);
        const meta = curatedById.get(id) || {};
        const tokens = readTokens(id, uniqueLeaves);

        const consumers = [];
        for (const { page, text } of pageSources) {
            const reads = tokens.reduce((sum, t) => sum + grepCount(text, t), 0);
            if (reads > 0) consumers.push({ page, reads });
        }
        const tests = gateSources
            .filter(({ text }) => tokens.some((t) => text.includes(t)))
            .map(({ file }) => file);

        const record = {
            id,
            label: meta.label ?? null,
            unit: meta.unit ?? null,
            kind: moved ? 'derived' : 'authored',
            /* An array's comparison key is its full JSON (so a change inside it registers as
               a dependency), but storing 1.5 kB of it would bury the registry. Persist a
               digest: stable, diffable, and it still changes whenever the content does. */
            value: (typeof value === 'string' && /^\[\d+ items\] /.test(value))
                ? `${value.slice(0, value.indexOf('] ') + 1)} sha1:${createHash('sha1').update(value).digest('hex').slice(0, 12)}`
                : value,
            formula: meta.formula ?? null,
            deps: meta.deps ?? [],
            scope: meta.scope ?? 'site',
            evidenceClass: meta.evidenceClass ?? 'UNAVAILABLE',
            explainKey: meta.explainKey ?? null,
            dependsOnInputs: edges,
            consumers,
            tests,
        };
        if (meta.source) record.source = meta.source;
        /* Drop the nulls the schema allows to be absent, so the file stays readable and the
           byte-identical staleness check is not defeated by key ordering noise. */
        if (record.label === null) delete record.label;
        parameters.push(record);
    }

    return {
        generatedBy: 'tools/build-conv-parameter-registry.mjs',
        engineVersion: String(live.snapshot.meta.version),
        note: 'GENERATED — do not hand-edit. Curated metadata lives in data/conv-parameters.curated.json.',
        parameters,
    };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
    const built = buildRegistry();
    const text = `${JSON.stringify(built, null, 2)}\n`;
    if (process.argv.includes('--check')) {
        let current = '';
        let currentJs = '';
        try { current = readFileSync(OUT, 'utf8'); } catch { /* first run */ }
        try { currentJs = readFileSync(OUT_JS, 'utf8'); } catch { /* first run */ }
        if (current !== text || currentJs !== renderBrowserTwin(built)) {
            console.error('STALE — data/conv-parameters.json does not match a fresh build.');
            console.error('Run: node tools/build-conv-parameter-registry.mjs');
            process.exit(1);
        }
        console.log(`PASS registry is current — ${built.parameters.length} parameters, engine v${built.engineVersion}`);
    } else {
        writeFileSync(OUT, text);
        writeFileSync(OUT_JS, renderBrowserTwin(built));
        const derived = built.parameters.filter((p) => p.kind === 'derived').length;
        console.log(`Wrote ${OUT}`);
        console.log(`Wrote ${OUT_JS}`);
        console.log(`  ${built.parameters.length} parameters (${derived} derived, ${built.parameters.length - derived} authored), engine v${built.engineVersion}`);
    }
}
