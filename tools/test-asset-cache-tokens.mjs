#!/usr/bin/env node
/**
 * test-asset-cache-tokens.mjs — a cache token must change when the file changes.
 *
 * WHAT WENT WRONG. v3.9.1 rewrote the homepage photo card from an absolutely-positioned caption to
 * a flex column, and left `index.html` pointing at `styles-index.min.css?v=2026-09-20-photo` — the
 * token v3.9.0 had set. Browsers holding the v3.9.0 stylesheet therefore rendered v3.9.1's markup
 * under v3.9.0's rules: four caption blocks stacked upward from the card's bottom-left, straight
 * over the owner's face. He saw it on his phone before any gate did, because every gate here starts
 * with a cold cache and can never reproduce a stale one.
 *
 * It was not one page. `styles.min.css` has carried `?v=20260908-editorial` across 74 pages since
 * 2026-09-09 while the file changed in v3.6.2, v3.6.4 and v3.9.0 — including 39 contrast fixes that
 * never reached a returning visitor.
 *
 * THE RULE. The token embeds the file's own hash: `?v=<yyyymmdd>-<first 8 of sha256>`. Then "did I
 * remember to bump it" stops being a question a human answers.
 *
 *   STRICT   styles.min.css, styles-index.min.css — the two whose staleness has already shipped
 *   MONITOR  every other ?v= asset, listed with its expected token, flip condition written below
 *
 * Usage: node tools/test-asset-cache-tokens.mjs [--strict-all]
 */
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join, resolve, dirname, relative } from 'node:path';

const ROOT = process.cwd();
const STRICT_ALL = process.argv.includes('--strict-all');
/* v3.9.5 — the monitor reached zero, so the rule is now STRICT for every asset EXCEPT the version
   pins below. A pin is not a cache-bust: `js/conv-engine.js?v=2.2.0` is compared at runtime against
   CONV_CURRENT_ENGINE_VERSION (dc-conventional.html:1430) and datahallAI does the same for its
   model / engine / registry through datahallRequestedVersion(); the electrical trio's shared token
   is pinned by tools/test-datahall-ai-electrical-visual-map.mjs. Hashing those would break the
   authority contract they exist to enforce, and their correctness is already gate-backed. The tag's
   own authority attribute is the machine-readable half of this rule — the three electrical modules
   carry no attribute, so they are listed. */
const PINNED_BY_GATE = new Set([
    'js/datahall-ai/electrical-topology.js',
    'js/datahall-ai/electrical-live.js',
    'js/datahall-ai/electrical-visual-map.js',
]);
const AUTHORITY_ATTR = /data-(?:conv-engine|datahall-model|datahall-calc|datahall-registry)[-a-z]*/;

const hashOf = async (file) => createHash('sha256').update(await readFile(file)).digest('hex').slice(0, 8);
/* match the whole tag so the authority attribute beside the src is visible to the rule */
const TAG_RE = /<(?:link|script)\b[^>]*?(?:href|src)="([^"?]+\.(?:css|js))\?v=([^"]+)"[^>]*>/g;

const pinned = new Set();
/* v3.10.17 — every tracked page, not just the repository root.
   This used to be `readdir(ROOT)`, which reads ONE directory. Half the public surface lives in
   `network/`, `manual/`, `id/` and `prd/`, and the gate could not see any of it: 79 of those 90
   pages were serving a shared asset under a stale or legacy token, `styles.min.css` still at
   `?v=20260908-editorial` on 76 of them and `auth.js` on 43 — the same class of defect as the
   stale auth.min.js that once made the HOMEPAGE run old code. A gate that walks one directory
   reports a clean site by not looking at it. */
const VENDORED = /^(standarization|prompts|Automation|Article|Apps|Data|dcmoc|games|Dunia-Emosi|worktrees|backups|node_modules|my-video|TestEA|Documents|cf-worker|obsidian-knowledge-vault)\//;
const pages = execFileSync('git', ['ls-files', '*.html'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n').filter(Boolean).filter((f) => !VENDORED.test(f)).sort();

/* First pass: an asset is a version pin if ANY page loads it under an authority attribute (or the
   gate-pinned list). The attribute marks the contract, and the contract belongs to the FILE — seven
   conventional cockpits load js/conv-engine.js without the attribute while comparing the same
   version constant in their own script, so a per-tag rule would demand a hash token there and break
   the pin the other page declares. */
const sources = new Map();
for (const page of pages) { sources.set(page, await readFile(join(ROOT, page), 'utf8')); }
/* Keyed by the asset's path from the repository root: a sub-directory page writes
   `../../styles.min.css` for the file a root page calls `styles.min.css`, and treating those as
   two assets would split every pin and every token check down the middle. */
const assetKey = (page, href) => {
    const file = resolve(dirname(join(ROOT, page)), href);
    return file.startsWith(ROOT) ? relative(ROOT, file) : null;
};
for (const [page, html] of sources.entries()) {
    for (const [tag, href] of html.matchAll(TAG_RE)) {
        const key = assetKey(page, href);
        if (!key) { continue; }
        if (AUTHORITY_ATTR.test(tag) || PINNED_BY_GATE.has(key)) { pinned.add(key); }
    }
}
const strict = [];
const monitor = [];
const missing = [];
const seen = new Map();          /* asset -> Set(tokens) */

for (const page of pages) {
    const html = sources.get(page);
    for (const [, href, token] of html.matchAll(TAG_RE)) {
        if (/^https?:/.test(href)) { continue; }
        const key = assetKey(page, href);
        if (!key) { continue; }
        if (pinned.has(key)) { continue; }
        const file = join(ROOT, key);
        try { await stat(file); } catch { missing.push(`${page} -> ${href} (referenced, not on disk)`); continue; }
        const name = key.split('/').pop();
        const want = await hashOf(file);
        const carries = token.split('-').pop();
        const row = { page, href: key, token, want, name };
        if (!seen.has(key)) { seen.set(key, new Set()); }
        seen.get(key).add(token);
        if (carries === want) { continue; }
        strict.push(row);
    }
}

/* One asset, one token — the half tools/normalize-cache-bust.py owns for root-page assets. Held
   STRICT for the two stylesheets (a split token there means a fix reaches only some pages) and
   REPORTED for everything else: js/ carries a real backlog of multi-token assets that predates
   this gate, and blocking a caption fix on it would only teach the next author to weaken the gate. */
const splitAll = [...seen.entries()].filter(([, tokens]) => tokens.size > 1);
const split = splitAll;
const splitMonitor = [];

const byAsset = (rows) => {
    const out = new Map();
    for (const row of rows) {
        if (!out.has(row.href)) { out.set(row.href, { ...row, pages: 0 }); }
        out.get(row.href).pages += 1;
    }
    return [...out.values()];
};

console.log(`ASSET CACHE TOKENS — ${pages.length} pages scanned, ${pinned.size} version pin(s) exempt`);
const strictAssets = byAsset(strict);
const monitorAssets = byAsset(monitor);
for (const row of monitorAssets.sort((a, b) => b.pages - a.pages).slice(0, 12)) {
    console.log(`  MONITOR ${row.href.padEnd(38)} ?v=${row.token} → expected …-${row.want}  (${row.pages} page${row.pages > 1 ? 's' : ''})`);
}
if (monitorAssets.length > 12) { console.log(`  MONITOR … and ${monitorAssets.length - 12} more asset(s)`); }
if (splitMonitor.length) { console.log(`  MONITOR ${splitMonitor.length} asset(s) served under more than one token, e.g. ${splitMonitor[0][0]} (${[...splitMonitor[0][1]].slice(0, 3).join(', ')})`); }

let failed = false;
if (missing.length) { failed = true; console.error(`\nFAIL — referenced file(s) missing:\n  ${missing.slice(0, 8).join('\n  ')}`); }
if (split.length) {
    failed = true;
    console.error(`\nFAIL — one asset served under several tokens (a fix reaches only some pages):\n  ${split.map(([href, t]) => `${href}: ${[...t].join(', ')}`).join('\n  ')}`);
}
if (strictAssets.length) {
    failed = true;
    console.error('\nFAIL — a STRICT asset changed without its token:');
    for (const row of strictAssets) {
        console.error(`  ${row.href} on ${row.pages} page(s): ?v=${row.token} but the file hashes to ${row.want}`);
    }
    console.error('  Fix: set the token to <yyyymmdd>-<hash> for the built file, on every page that loads it.');
}
if (failed) { process.exit(1); }
console.log(`\nPASS — every STRICT asset's token matches its file${monitorAssets.length ? `; ${monitorAssets.length} asset(s) reported` : ''}`);
