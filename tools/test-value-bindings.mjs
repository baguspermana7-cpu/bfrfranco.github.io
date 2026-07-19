#!/usr/bin/env node
/**
 * test-value-bindings.mjs — AUTO-LINKING coherence + staleness gate (SHIP GATE).
 *
 * Enforces the owner mandate "setiap perubahan perhitungan/algo/database/logic
 * harus tersambung/binding — dan itu AUTO":
 *   1. Binding coherence — every entry in dcmoc/src/lib/value-bindings.ts:
 *      unique ids · provenance:'engine' entries carry an engineFn · every
 *      engineFn naming models.* / rzData().* RESOLVES against the LIVE engine
 *      (catches renamed/removed functions) · pages[] ⊆ Shell navItems tab ids.
 *   2. Catalog staleness — regenerates the engine catalog in-memory
 *      (tools/build-engine-catalog.mjs buildCatalog) and deep-compares vs the
 *      committed dcmoc/src/lib/engine-catalog.json. An engine change cannot
 *      ship with stale docs: the Knowledge Base + FAQ render the catalog live,
 *      so once regenerated every doc surface is current BY CONSTRUCTION.
 *
 * Run: node tools/test-value-bindings.mjs      (exit 0 = pass, 1 = fail)
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import vm from 'node:vm';
import { buildCatalog } from './build-engine-catalog.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

let pass = 0, fail = 0;
const fails = [];
const ok = (name, cond, detail) => { if (cond) pass++; else { fail++; fails.push(name + (detail ? ' — ' + detail : '')); } };

/* ── load engine ── */
function loadEngine() {
    const src = readFileSync(join(ROOT, 'rz-engine.js'), 'utf8');
    const win = {};
    win.window = win;
    win.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
    win.CustomEvent = function () {};
    win.dispatchEvent = function () {};
    win.addEventListener = function () {};
    win.removeEventListener = function () {};
    win.console = console;
    vm.runInContext(src, vm.createContext(win), { filename: 'rz-engine.js' });
    return win.RZEngine;
}
const E = loadEngine();

/* ── 1a. parse value-bindings.ts (regex extraction — entries are flat literals) ── */
const vbSrc = readFileSync(join(ROOT, 'dcmoc', 'src', 'lib', 'value-bindings.ts'), 'utf8');
const entryRe = /\{\s*id:\s*'([^']+)'[\s\S]*?provenance:\s*'([^']+)'[\s\S]*?\}/g;
// safer: split per top-level entry by `{ id: '...'` anchors
const ids = [...vbSrc.matchAll(/\{ id: '([^']+)'/g)].map((m) => m[1]);
ok('bindings: entries found', ids.length >= 40, `found ${ids.length} (floor 40 — catalog must not shrink)`);
ok('bindings: ids unique', new Set(ids).size === ids.length, 'duplicate binding ids');

/* per-entry blocks: from each `{ id:` to the next `{ id:` (flat array of literals) */
const anchors = [...vbSrc.matchAll(/\{ id: '/g)].map((m) => m.index);
const blocks = anchors.map((a, i) => vbSrc.slice(a, anchors[i + 1] ?? vbSrc.length));
void entryRe;

/* ── 1b. engineFn resolution against the live engine ── */
const resolveEngineFn = (fn) => {
    // models.ns.fn (allow trailing text like " / ..." — take the first token)
    const m1 = fn.match(/models\.([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)/);
    if (m1) {
        const ns = E.models?.[m1[1]];
        return !!ns && typeof ns[m1[2]] === 'function';
    }
    const m2 = fn.match(/models\.([A-Za-z_$][\w$]*)/);
    if (m2) return !!E.models?.[m2[1]];
    const m3 = fn.match(/rzData\(\)\.([A-Za-z_$][\w$]*)/);
    if (m3) return E.data?.[m3[1]] !== undefined;
    return null; // module-level fn (CapexEngine.calculateCapex etc.) — not engine-resolvable here
};

for (const b of blocks) {
    const id = b.match(/id: '([^']+)'/)?.[1] ?? '?';
    const prov = b.match(/provenance: '([^']+)'/)?.[1];
    const engineFn = b.match(/engineFn: '([^']+)'/)?.[1];
    if (prov === 'engine') ok(`bindings: ${id} engine-provenance has engineFn`, !!engineFn);
    if (engineFn) {
        const r = resolveEngineFn(engineFn);
        if (r !== null) ok(`bindings: ${id} engineFn resolves (${engineFn})`, r, 'renamed/removed in rz-engine.js?');
    }
}

/* ── 1c. pages ⊆ Shell tab ids ── */
const shellSrc = readFileSync(join(ROOT, 'dcmoc', 'src', 'components', 'layout', 'Shell.tsx'), 'utf8');
const pageSrc = readFileSync(join(ROOT, 'dcmoc', 'src', 'app', 'page.tsx'), 'utf8');
const tabIds = new Set([
    ...[...shellSrc.matchAll(/id: '([\w-]+)'/g)].map((m) => m[1]),
    ...[...pageSrc.matchAll(/case '([\w-]+)':/g)].map((m) => m[1]),   // router cases (dashboard + composed tabs)
]);
ok('shell: tab ids parsed', tabIds.size > 20, `found ${tabIds.size}`);
for (const b of blocks) {
    const id = b.match(/id: '([^']+)'/)?.[1] ?? '?';
    const pagesM = b.match(/pages: \[([^\]]*)\]/);
    if (!pagesM) continue;
    const pages = [...pagesM[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    const unknown = pages.filter((p) => !tabIds.has(p));
    ok(`bindings: ${id} pages exist in Shell`, unknown.length === 0, `unknown tabs: ${unknown.join(',')}`);
}

/* ── 2. catalog staleness: regenerate and deep-compare ── */
const committed = JSON.parse(readFileSync(join(ROOT, 'dcmoc', 'src', 'lib', 'engine-catalog.json'), 'utf8'));
const fresh = buildCatalog();
const same = JSON.stringify(committed) === JSON.stringify(fresh);
ok('catalog: committed engine-catalog.json is CURRENT', same,
    'engine or consumers changed — run: node tools/build-engine-catalog.mjs (docs render the catalog; regen = all doc surfaces current)');
ok('catalog: has namespaces', (committed.namespaces?.length ?? 0) >= 30, `got ${committed.namespaces?.length}`);
ok('catalog: has sources', (committed.sources?.length ?? 0) >= 80, `got ${committed.sources?.length}`);

/* ── report ── */
console.log(`VALUE-BINDINGS GATE — ${pass} passed, ${fail} failed`);
if (fail) { fails.forEach((f) => console.log('  FAIL: ' + f)); process.exit(1); }
console.log('ALL GREEN — bindings coherent, engineFns resolve, catalog current (auto-link chain intact).');
