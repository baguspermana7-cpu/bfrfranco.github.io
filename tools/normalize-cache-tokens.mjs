#!/usr/bin/env node
/**
 * One asset, one token, and the token follows the SITE — never the clock.
 *
 * WHY THIS TOOL EXISTS
 *
 * v3.10.13 made every `?v=` token content-derived: `<yyyymmdd>-<first 8 of sha256>`. The digest
 * half is stable and is what `tools/test-asset-cache-tokens.mjs` compares. The DATE half was
 * minted from `date.today()` by a sweep script retyped by hand at each ship, and that is a defect
 * with two faces:
 *
 *   1. **Midnight churn.** Re-running the sweep the day after a release rewrites every token on
 *      every page — 253 pages, for assets whose bytes never changed. v3.10.19 hit exactly this
 *      through `build-changelog-html.py`, where the gate failed on a file nobody had touched.
 *   2. **A split token, introduced while fixing the first.** Regenerating ONE page with today's
 *      date leaves it as the only page carrying a different token for a shared asset — the
 *      "one asset served under several tokens" defect this repository has a gate for.
 *
 * So the rule is: **adopt the date the site already carries for this exact digest, and mint
 * today's date only when the digest shows the asset genuinely changed.** A content change still
 * busts the cache, because the digest changes; a rebuild of an unchanged file does nothing.
 *
 * WHY IT IS A TOOL AND NOT A SNIPPET
 *
 * This rule was carried in an ad-hoc Python block pasted at each ship. A rule that lives in the
 * author's head is applied when the author remembers it, which is how the clock got into the
 * token in the first place. `tools/test-asset-cache-tokens.mjs` checks the digest; this writes it.
 *
 * VERSION PINS ARE NOT CACHE TOKENS and are left alone: a tag carrying a `data-*-authority`
 * attribute, and the engine modules pinned by name, declare a CONTRACT version that the page
 * compares against the engine it loads. Hashing those blanks the cockpit fail-closed.
 *
 * Usage:
 *   node tools/normalize-cache-tokens.mjs            # report drift, write nothing
 *   node tools/normalize-cache-tokens.mjs --apply    # write
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const APPLY = process.argv.includes('--apply');

const VENDORED = /^(standarization|prompts|Automation|Article|Apps|Data|dcmoc|games|Dunia-Emosi|worktrees|backups|node_modules|my-video|TestEA|Documents|cf-worker|obsidian-knowledge-vault)\//;
const PINNED_BY_GATE = new Set([
    'js/dcai-model.js', 'js/dcai-engine.js', 'js/conv-engine.js',
    'js/datahall-ai/electrical-topology.js', 'js/datahall-ai/electrical-live.js',
    'js/datahall-ai/electrical-visual-map.js',
]);
const AUTHORITY_ATTR = /data-(?:conv-engine|datahall-model|datahall-calc|datahall-registry)[-a-z]*/;
const TAG_RE = /<(?:link|script)\b[^>]*?(?:href|src)="([^"?]+\.(?:css|js))\?v=([^"]+)"[^>]*>/g;

const pages = execFileSync('git', ['ls-files', '*.html'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n').filter(Boolean).filter((f) => !VENDORED.test(f)).sort();

const source = new Map(pages.map((p) => [p, readFileSync(join(ROOT, p), 'utf8')]));
const keyOf = (page, href) => {
    const file = resolve(dirname(join(ROOT, page)), href);
    return file.startsWith(ROOT) ? relative(ROOT, file) : null;
};

/* pass 1 — which assets are version pins */
const pinned = new Set(PINNED_BY_GATE);
for (const [page, html] of source) {
    for (const [tag, href] of html.matchAll(TAG_RE)) {
        const key = keyOf(page, href);
        if (key && AUTHORITY_ATTR.test(tag)) { pinned.add(key); }
    }
}

const digest = new Map();
const digestOf = (key) => {
    if (!digest.has(key)) {
        digest.set(key, createHash('sha256').update(readFileSync(join(ROOT, key))).digest('hex').slice(0, 8));
    }
    return digest.get(key);
};

/* pass 2 — the date the site already carries for each (asset, digest) pair, most common first */
const dateVotes = new Map();                       /* `${key}\0${digest}` -> Map(date -> count) */
for (const [page, html] of source) {
    for (const [, href, token] of html.matchAll(TAG_RE)) {
        const key = keyOf(page, href);
        if (!key || pinned.has(key) || !existsSync(join(ROOT, key))) { continue; }
        const m = /^(\d{8})-([0-9a-f]{8})$/.exec(token);
        if (!m || m[2] !== digestOf(key)) { continue; }   /* only a MATCHING digest votes */
        const id = `${key}\0${m[2]}`;
        if (!dateVotes.has(id)) { dateVotes.set(id, new Map()); }
        const votes = dateVotes.get(id);
        votes.set(m[1], (votes.get(m[1]) || 0) + 1);
    }
}
/* LOCAL date, not UTC. `tools/build-changelog-html.py` mints with Python's `date.today()`,
   which is local; this box is UTC+7, so a token minted at 00:30 would carry yesterday's date
   here and today's there — two dates for one digest, which is the split this tool prevents. */
const now = new Date();
const today = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
const dateFor = (key) => {
    const votes = dateVotes.get(`${key}\0${digestOf(key)}`);
    if (!votes || !votes.size) { return today; }       /* genuinely changed -> mint today */
    return [...votes].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0][0];
};

/* pass 3 — rewrite */
let changedPages = 0;
const perAsset = new Map();
for (const [page, html] of source) {
    let out = html;
    out = out.replace(TAG_RE, (tag, href, token) => {
        const key = keyOf(page, href);
        if (!key || pinned.has(key) || !existsSync(join(ROOT, key))) { return tag; }
        const want = `${dateFor(key)}-${digestOf(key)}`;
        if (token === want) { return tag; }
        perAsset.set(key, (perAsset.get(key) || 0) + 1);
        return tag.replace(`${href}?v=${token}`, `${href}?v=${want}`);
    });
    if (out !== html) {
        changedPages += 1;
        if (APPLY) { writeFileSync(join(ROOT, page), out); }
    }
}

console.log('── CACHE TOKENS ──');
console.log(`  ${pages.length} page(s) scanned, ${pinned.size} version pin(s) left alone`);
if (!perAsset.size) {
    console.log(`  ✓ every token already matches its file, on the date the site carries for it`);
    console.log('\nPASS — nothing to normalise.');
    process.exit(0);
}
for (const [key, n] of [...perAsset].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${APPLY ? 'set' : 'would set'} ${key} → ?v=${dateFor(key)}-${digestOf(key)}  on ${n} page(s)`);
}
console.log(`\n${APPLY ? 'WROTE' : 'DRIFT'} — ${perAsset.size} asset(s) across ${changedPages} page(s).`);
if (!APPLY) { console.log('Re-run with --apply to write. The date is adopted from the site, never from the clock.'); }
process.exit(0);
