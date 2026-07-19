#!/usr/bin/env node
/**
 * build-engine-catalog.mjs — AUTO-LINKING catalog generator (owner mandate
 * 2026-07-19: "bener2 auto linking satu sama lain — harus AUTO").
 *
 * Single-source generation: loads rz-engine.js in a vm, walks every
 * models.* namespace/function, parses parameter names, greps the whole repo
 * (site *.html pages + dcmoc/src) for real consumers of each namespace, and
 * emits a deterministic machine-readable catalog consumed LIVE by the DCMOC
 * Knowledge Base + FAQ. Docs update themselves: engine change → re-run this
 * → every doc surface is current BY CONSTRUCTION.
 *
 * Staleness is gate-enforced by tools/test-value-bindings.mjs (regenerates
 * in-memory and diffs vs the committed JSON — a changed engine cannot ship
 * with a stale catalog).
 *
 * Run: node tools/build-engine-catalog.mjs          (writes the catalog)
 * Lib: import { buildCatalog } from this file       (used by the gate)
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, relative } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const ENGINE = join(ROOT, 'rz-engine.js');
const OUT = join(ROOT, 'dcmoc', 'src', 'lib', 'engine-catalog.json');

function loadEngine() {
    const src = readFileSync(ENGINE, 'utf8');
    const win = {};
    win.window = win;
    win.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
    win.CustomEvent = function () {};
    win.dispatchEvent = function () {};
    win.addEventListener = function () {};
    win.removeEventListener = function () {};
    win.console = console;
    const ctx = vm.createContext(win);
    vm.runInContext(src, ctx, { filename: 'rz-engine.js' });
    if (!win.RZEngine) throw new Error('RZEngine did not attach to window');
    return win.RZEngine;
}

/** Parameter names from fn.toString() — screening-grade (destructured objects → 'input'). */
function paramNames(fn) {
    const src = String(fn);
    const m = src.match(/^\s*(?:function[^(]*)?\(([^)]*)\)/) || src.match(/^\s*([\w$]+)\s*=>/);
    if (!m) return [];
    return m[1].split(',')
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => (p.startsWith('{') || p.startsWith('[') ? 'input' : p.replace(/=.*$/, '').trim()))
        .filter((p) => p && p !== 'input' || p === 'input');
}

/** Collect scannable source files: site root *.html + dcmoc/src recursive ts/tsx. */
function sourceFiles() {
    const files = [];
    for (const f of readdirSync(ROOT)) {
        if (f.endsWith('.html')) files.push(join(ROOT, f));
    }
    const walk = (dir) => {
        for (const f of readdirSync(dir)) {
            const p = join(dir, f);
            const st = statSync(p);
            if (st.isDirectory()) { if (f !== 'node_modules' && f !== 'out' && f !== '.next') walk(p); }
            else if (/\.(ts|tsx)$/.test(f)) files.push(p);
        }
    };
    walk(join(ROOT, 'dcmoc', 'src'));
    return files;
}

export function buildCatalog() {
    const E = loadEngine();
    const D = E.data;
    const M = E.models || {};

    /* consumer scan: which real files call models.<ns> (grep-derived, never hand-listed) */
    const nsNames = Object.keys(M).sort();
    const consumers = Object.fromEntries(nsNames.map((n) => [n, new Set()]));
    for (const file of sourceFiles()) {
        const rel = relative(ROOT, file);
        // exclude generated/doc pages that merely MENTION model names in prose
        if (rel === 'rz-engine.js' || rel.startsWith('tools/') || rel === 'changelog.html' || rel === 'secondbrain.html') continue;
        let txt;
        try { txt = readFileSync(file, 'utf8'); } catch { continue; }
        for (const ns of nsNames) {
            if (txt.includes(`models.${ns}.`) || txt.includes(`models.${ns} `) || txt.includes(`models.${ns})`) || txt.includes(`models.${ns};`) || txt.includes(`models['${ns}']`)) {
                consumers[ns].add(rel);
            }
        }
    }

    const namespaces = nsNames.map((ns) => {
        const obj = M[ns];
        const fns = Object.keys(obj)
            .filter((k) => typeof obj[k] === 'function')
            .sort()
            .map((k) => ({ name: k, params: paramNames(obj[k]) }));
        return { name: ns, functions: fns, consumers: [...consumers[ns]].sort() };
    });

    const sources = Object.keys(D.sources || {}).sort().map((k) => {
        const s = D.sources[k] || {};
        return {
            key: k,
            source: String(s.source ?? ''),
            asOf: String(s.asOf ?? ''),
            ...(s.method ? { method: String(s.method) } : {}),
        };
    });

    return {
        generator: 'tools/build-engine-catalog.mjs',
        note: 'AUTO-GENERATED from rz-engine.js — do not hand-edit. Consumers are grep-derived from real usage.',
        dataVersion: String(D.version ?? ''),
        modelCount: namespaces.length,
        functionCount: namespaces.reduce((a, n) => a + n.functions.length, 0),
        sourceCount: sources.length,
        namespaces,
        sources,
    };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
    const cat = buildCatalog();
    writeFileSync(OUT, JSON.stringify(cat, null, 1) + '\n', 'utf8');
    console.log(`engine-catalog.json written — ${cat.modelCount} namespaces · ${cat.functionCount} functions · ${cat.sourceCount} sources · DATA v${cat.dataVersion}`);
}
