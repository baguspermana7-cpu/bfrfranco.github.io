#!/usr/bin/env node
/**
 * Every published page carries the metadata a search or answer engine needs.
 *
 * WHY THIS GATE EXISTS
 *
 * The 2026-09-20 SEO audit found `og:title`, `og:image` and JSON-LD on 152 of 176 published pages
 * and `twitter:card` on 143 — the 25 `network/**` protocol explainers had none of it, because
 * `tools/build-og-images.py` globbed the repository root only and never saw them. v3.10.17 brought
 * all four signals to 100%.
 *
 * Nothing held them there. That is the whole reason this file exists: a coverage number with no
 * gate is a snapshot, and the snapshot was 86% the last time anyone looked. The audit ledger
 * carried it as OPEN-7 rather than counting the sweep as done.
 *
 * WHAT IS REQUIRED, AND OF WHOM
 *
 * `sitemap.xml` is the site's own definition of "public", so it is the population. A page the
 * sitemap does not publish is not audited here — not skipped by a hand-kept list that can silently
 * grow, but excluded by the site's own statement about itself.
 *
 *   title · meta description · canonical · lang        — the four a page cannot be indexed without
 *   og:title · og:description · og:image · og:url      — what a share preview renders
 *   twitter:card · twitter:image                       — the same, for the other card renderer
 *   application/ld+json, and it must PARSE             — what an answer engine lifts as a citation
 *
 * Every JSON-LD block is parsed, not merely counted: a block that does not parse is worse than a
 * missing one, because the page looks marked up and is not.
 *
 * `og:image` must resolve to a file on disk. An advertised card that 404s is a missing card with
 * extra steps — ten pages once advertised the generic profile photo or another page's card, which
 * renders as the same picture for every one of them.
 *
 * Usage: node tools/test-page-metadata.mjs [--json]
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://resistancezero.com/';

const sitemap = readFileSync(join(ROOT, 'sitemap.xml'), 'utf8');
const pages = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => m[1].replace(SITE, ''))
    .filter((p) => p.endsWith('.html'))
    .filter((p) => existsSync(join(ROOT, p)));

const REQUIRED = [
    ['title', (h) => /<title>[^<]{5,}<\/title>/i.test(h)],
    ['meta description', (h) => /name="description"\s+content="[^"]{20,}"/i.test(h)],
    ['canonical', (h) => /rel="canonical"\s+href="[^"]+"/i.test(h)],
    ['html lang', (h) => /<html[^>]+lang="[a-z-]+"/i.test(h)],
    ['og:title', (h) => /property="og:title"\s+content="[^"]+"/i.test(h)],
    ['og:description', (h) => /property="og:description"\s+content="[^"]+"/i.test(h)],
    ['og:url', (h) => /property="og:url"\s+content="[^"]+"/i.test(h)],
    ['og:image', (h) => /property="og:image"\s+content="[^"]+"/i.test(h)],
    ['twitter:card', (h) => /name="twitter:card"\s+content="[^"]+"/i.test(h)],
    ['twitter:image', (h) => /name="twitter:image"\s+content="[^"]+"/i.test(h)],
    ['JSON-LD', (h) => /<script[^>]+application\/ld\+json/i.test(h)],
];

const ARTICLE_TYPES = new Set(['Article', 'TechArticle', 'TechnicalArticle', 'BlogPosting', 'NewsArticle', 'Report']);
const findings = [];
for (const page of pages) {
    const html = readFileSync(join(ROOT, page), 'utf8');
    for (const [name, test] of REQUIRED) {
        if (!test(html)) { findings.push({ page, rule: name, detail: 'absent or empty' }); }
    }
    /* a block that does not parse is worse than a missing one */
    for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
        try { JSON.parse(m[1]); }
        catch (e) { findings.push({ page, rule: 'JSON-LD parses', detail: String(e.message).slice(0, 60) }); }
    }
    /* An article-type node without a publication date is the freshness signal an answer engine
       looks for and does not find. The date this site can defend is the commit that ADDED the
       page — when it was published here, which git records exactly. That is a different claim
       from sitemap <lastmod>, which tools/build-sitemap.py:53 refuses precisely because a commit
       does not prove a CONTENT update; first appearance is not an update, it is a publication.
       dateModified is deliberately absent: nothing here can prove one. */
    for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
        let data;
        try { data = JSON.parse(m[1]); } catch { continue; }
        for (const node of Array.isArray(data) ? data : [data]) {
            if (node && ARTICLE_TYPES.has(node['@type']) && !node.datePublished) {
                findings.push({ page, rule: 'article datePublished', detail: node['@type'] });
            }
        }
    }

    /* the advertised card must exist */
    const img = html.match(/property="og:image"\s+content="([^"]+)"/i);
    if (img) {
        const rel = img[1].replace(SITE, '').replace(/^\//, '').split('?')[0];
        if (!/^https?:/.test(rel) && !existsSync(join(ROOT, rel))) {
            findings.push({ page, rule: 'og:image on disk', detail: rel });
        }
    }
}

if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ pages: pages.length, findings }, null, 2));
    process.exit(findings.length ? 1 : 0);
}

console.log('── PAGE METADATA ──');
if (!findings.length) {
    console.log(`  ✓ ${pages.length} published page(s) carry all ${REQUIRED.length} signals, every JSON-LD block parses and dates its articles, every card is on disk`);
    console.log('\nPASS — nothing published is invisible to a search or answer engine.');
    process.exit(0);
}
const byRule = new Map();
for (const f of findings) byRule.set(f.rule, [...(byRule.get(f.rule) || []), f]);
for (const [rule, list] of [...byRule].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ✗ ${rule}: ${list.length} page(s)`);
    for (const f of list.slice(0, 4)) console.log(`      ${f.page}  ${f.detail}`);
    if (list.length > 4) console.log(`      … and ${list.length - 4} more`);
}
console.log(`\nFAIL — ${findings.length} missing signal(s) across ${new Set(findings.map((f) => f.page)).size} published page(s).`);
console.log('sitemap.xml is what this site calls public; a page it publishes is a page someone');
console.log('will share or an answer engine will read. Add the signal, or stop publishing the page.');
process.exit(1);
