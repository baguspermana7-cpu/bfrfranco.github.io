/**
 * Ship gate — the engine version pinned on a page equals the version the engine publishes.
 *
 * Eight Conventional cockpits fail CLOSED on an engine they do not recognise, which is the
 * right behaviour: a page must not render numbers from an authority it cannot vouch for.
 * Each does it by comparing `CONV_CALC.snapshot.meta.version` against a version written into
 * the page (`CONV_CURRENT_ENGINE_VERSION` / `currentEngineVersion`), and by comparing the
 * `?v=` cache token on its own script tag.
 *
 * The consequence, found the hard way in v1.134.23: bumping the engine from 2.0.0 to 2.1.0
 * blanked EVERY cockpit at once. No page threw, nothing logged — the authority check simply
 * returned false and each screen rendered UNAVAILABLE, so nineteen unrelated gates timed out
 * waiting for elements that were never drawn. The failure looked like a browser problem and
 * was a one-line staleness.
 *
 * Three things must agree, so this checks all three:
 *   V1  the version pinned in the page == the version the engine publishes
 *   V2  the ?v= cache token on the page's conv-engine script == that same version
 *   V3  every page that loads the engine is actually covered here (no silent omission)
 *   V4  (P16) the pin is READ from the generated js/rz-engine-versions.js, never typed, and that module
 *       loads before the engine; the module equals both engines; datahallAI follows the same rule
 *
 * Run: node tools/test-conv-engine-version-pins.mjs
 */
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const ROOT = process.cwd();
const require = createRequire(import.meta.url);
const engine = require(join(ROOT, 'js', 'conv-engine.js'));
const published = (engine.CONV_CALC || engine).snapshot.meta.version;
assert.ok(published, 'the engine publishes no meta.version');

/* P16 (v3.36.x): the pin is no longer typed into the page. The page reads it from the GENERATED
   js/rz-engine-versions.js (tools/build-engine-versions.mjs), which must load BEFORE the engine.
   A typed literal is now a failure: it is the 16-edit bump this module exists to remove. */
const PIN_READ = /(?:const|var|let)\s+(?:CONV_CURRENT_ENGINE_VERSION|currentEngineVersion)\s*=\s*\(window\.RZ_ENGINE_VERSIONS\s*\|\|\s*\{\}\)\.conv\s*\|\|\s*null/;
const PIN_LITERAL = /(?:const|var|let)\s+(?:CONV_CURRENT_ENGINE_VERSION|currentEngineVersion)\s*=\s*'[^']*'/;
const TOKEN = /(?:src|href)="[^"]*?conv-engine\.js\?v=([^"&]+)"/;
const MODULE_TAG = /<script[^>]+src="js\/rz-engine-versions\.js\?v=[^"]+"[^>]*>/;

/* The module itself must agree with both engines, evaluated the way a browser would. */
const modSrc = await readFile(join(ROOT, 'js', 'rz-engine-versions.js'), 'utf8').catch(() => '');
const sandbox = {};
new Function('window', 'globalThis', modSrc)(sandbox, sandbox);
const mod = sandbox.RZ_ENGINE_VERSIONS || {};
assert.equal(mod.conv, published, `js/rz-engine-versions.js says conv ${mod.conv} but the engine publishes `
    + `${published} — run node tools/build-engine-versions.mjs --apply`);
require(join(ROOT, 'js', 'dcai-model.js'));
const dcai = require(join(ROOT, 'js', 'dcai-engine.js'));
const dcaiPublished = (dcai.DCAI_CALC || dcai).snapshot.meta.version;
assert.equal(mod.dcai, dcaiPublished, `js/rz-engine-versions.js says dcai ${mod.dcai} but dcai-engine publishes `
    + `${dcaiPublished} — run node tools/build-engine-versions.mjs --apply`);

const pages = (await readdir(ROOT)).filter((f) => f.endsWith('.html'));
let checked = 0;
const loadsEngine = [];
for (const page of pages) {
    const html = await readFile(join(ROOT, page), 'utf8');
    /* changelog.html is a GENERATED archive that QUOTES the script tags of past releases while
       describing them. It loads nothing and pins nothing; scanning it would assert against
       prose. The real page set is the cockpits. */
    if (page === 'changelog.html') continue;
    if (!/<script[^>]+conv-engine\.js/.test(html)) continue;
    loadsEngine.push(page);

    assert.ok(!PIN_LITERAL.test(html), `${page}: types the engine version as a literal — read it from `
        + 'window.RZ_ENGINE_VERSIONS.conv (P16) so a bump is one generator run, not a 16-edit sweep');
    assert.ok(PIN_READ.test(html), `${page}: loads the engine but its pin does not read `
        + '(window.RZ_ENGINE_VERSIONS || {}).conv || null — it cannot fail closed on a stale or unknown authority');
    const modAt = html.search(MODULE_TAG);
    const engAt = html.search(/<script[^>]+conv-engine\.js/);
    assert.ok(modAt >= 0 && modAt < engAt, `${page}: js/rz-engine-versions.js must load before conv-engine.js `
        + '(and before the inline pin) — otherwise the pin reads undefined and the page renders UNAVAILABLE');

    const token = html.match(TOKEN);
    assert.ok(token, `${page}: loads conv-engine.js with no ?v= cache token, so a browser that has `
        + 'the old engine will keep serving it forever');
    assert.equal(token[1], published,
        `${page}: requests conv-engine.js?v=${token[1]} but the engine is ${published} — returning `
        + 'visitors would be served the cached older engine');
    checked += 1;
}

assert.ok(checked >= 8, `only ${checked} pages checked; the cockpit set is at least 8 — `
    + 'a page that stopped loading the engine should be investigated, not silently skipped');

/* datahallAI: same rule for the DCAI pin. */
const ai = await readFile(join(ROOT, 'datahallAI.html'), 'utf8');
assert.ok(/var DATAHALL_CURRENT_ASSET_VERSION=\(window\.RZ_ENGINE_VERSIONS\|\|\{\}\)\.dcai\|\|null/.test(ai),
    'datahallAI.html: DATAHALL_CURRENT_ASSET_VERSION must read (window.RZ_ENGINE_VERSIONS||{}).dcai||null');
const aiMod = ai.search(MODULE_TAG), aiEng = ai.search(/<script[^>]+dcai-model\.js/);
assert.ok(aiMod >= 0 && aiMod < aiEng, 'datahallAI.html: js/rz-engine-versions.js must load before dcai-model.js');
for (const f of ['dcai-model', 'dcai-engine', 'dcai-parameters']) {
    const t = ai.match(new RegExp(`src="js/${f}\\.js\\?v=([^"&]+)"`));
    assert.ok(t && t[1] === dcaiPublished, `datahallAI.html: js/${f}.js?v=${t && t[1]} but dcai publishes ${dcaiPublished}`);
}

console.log(`PASS engine version pins — module conv ${mod.conv} / dcai ${mod.dcai} equal the engines; `
    + `${checked} Conventional pages + datahallAI read the module (0 typed literals), load it first, and carry matching tokens`);
console.log(`     ${loadsEngine.join(', ')}`);
