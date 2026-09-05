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

const PIN = /(?:const|var|let)\s+(?:CONV_CURRENT_ENGINE_VERSION|currentEngineVersion)\s*=\s*'([^']+)'/;
const TOKEN = /(?:src|href)="[^"]*?conv-engine\.js\?v=([^"&]+)"/;

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

    const pin = html.match(PIN);
    assert.ok(pin, `${page}: loads the engine but pins no version — it cannot fail closed on a `
        + 'stale or unknown authority, which is the whole point of the check the other cockpits make');
    assert.equal(pin[1], published,
        `${page}: pins engine ${pin[1]} but the engine publishes ${published}. The page will fail `
        + 'CLOSED and render UNAVAILABLE everywhere — silently, with no error in the console.');

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
console.log(`PASS Conventional engine version pins — ${checked} pages agree with the published `
    + `engine ${published} on both the pinned version and the cache token`);
console.log(`     ${loadsEngine.join(', ')}`);
