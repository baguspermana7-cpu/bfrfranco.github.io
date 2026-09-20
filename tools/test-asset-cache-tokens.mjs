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
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';

const ROOT = process.cwd();
const STRICT_ALL = process.argv.includes('--strict-all');
/* flip condition: when the MONITOR list below reaches zero mismatches, move the asset into
   STRICT_ASSETS (or pass --strict-all in the ship gate and delete this note). */
const STRICT_ASSETS = new Set(['styles.min.css', 'styles-index.min.css']);

const hashOf = async (file) => createHash('sha256').update(await readFile(file)).digest('hex').slice(0, 8);
const TOKEN_RE = /(?:href|src)="([^"?]+\.(?:css|js))\?v=([^"]+)"/g;

const pages = (await readdir(ROOT)).filter((f) => f.endsWith('.html')).sort();
const strict = [];
const monitor = [];
const missing = [];
const seen = new Map();          /* asset -> Set(tokens) */

for (const page of pages) {
    const html = await readFile(join(ROOT, page), 'utf8');
    for (const [, href, token] of html.matchAll(TOKEN_RE)) {
        if (/^https?:/.test(href)) { continue; }
        const file = resolve(dirname(join(ROOT, page)), href);
        if (!file.startsWith(ROOT)) { continue; }
        try { await stat(file); } catch { missing.push(`${page} -> ${href} (referenced, not on disk)`); continue; }
        const name = href.split('/').pop();
        const want = await hashOf(file);
        const carries = token.split('-').pop();
        const row = { page, href, token, want, name };
        if (!seen.has(href)) { seen.set(href, new Set()); }
        seen.get(href).add(token);
        if (carries === want) { continue; }
        if (STRICT_ALL || STRICT_ASSETS.has(name)) { strict.push(row); } else { monitor.push(row); }
    }
}

/* One asset, one token — the half tools/normalize-cache-bust.py owns for root-page assets. Held
   STRICT for the two stylesheets (a split token there means a fix reaches only some pages) and
   REPORTED for everything else: js/ carries a real backlog of multi-token assets that predates
   this gate, and blocking a caption fix on it would only teach the next author to weaken the gate. */
const splitAll = [...seen.entries()].filter(([, tokens]) => tokens.size > 1);
const isStrict = (href) => STRICT_ALL || STRICT_ASSETS.has(href.split('/').pop());
const split = splitAll.filter(([href]) => isStrict(href));
const splitMonitor = splitAll.filter(([href]) => !isStrict(href));

const byAsset = (rows) => {
    const out = new Map();
    for (const row of rows) {
        if (!out.has(row.href)) { out.set(row.href, { ...row, pages: 0 }); }
        out.get(row.href).pages += 1;
    }
    return [...out.values()];
};

console.log(`ASSET CACHE TOKENS — ${pages.length} pages scanned`);
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
