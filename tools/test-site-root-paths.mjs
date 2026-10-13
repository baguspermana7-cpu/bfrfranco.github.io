#!/usr/bin/env node
/**
 * test-site-root-paths — URLs that must resolve from the SITE root, not from the page.
 *
 * WHY THIS EXISTS
 *
 * Two pages are served at more than one depth, and both resolved their URLs against the page:
 *
 *   404.html  GitHub Pages serves it for a missing path at ANY depth. On /manual/x.html its
 *             relative URLs became /manual/assets/..., /manual/js/... — the image, the favicon and
 *             three scripts 404'd, and every "popular page" link pointed at another missing page.
 *   js/rz-command-palette.js
 *             loaded by 40 manual/*.html pages. It fetched 'search-index.json' relative to the
 *             page, so on every manual page the index 404'd and search found nothing; its result
 *             links would have resolved under manual/ too.
 *
 *   P1 every href/src in 404.html is absolute (http:, /, #, mailto:, data:) — never page-relative
 *   P2 every fetch() in the palette goes through at(), which resolves against the script's own URL
 *   P3 every href the palette writes goes through at()
 *   P4 no search modal is built on `.search-input-wrapper`: the stylesheets style `.search-input-wrap`,
 *      so the palette's own injected markup (every manual page, 404) and articles 19-28 drew the
 *      magnifier unsized — 359 px wide at a 390 px phone, over the input.
 *
 * Proven RED on v3.20.1 (e40f0d0b): P1 x11, P2 x3, P3 x4 (commands, results, sections, preview image),
 *   P4 x11 (the palette + articles 19-28).
 *
 * Run: node tools/test-site-root-paths.mjs
 */
import { readFileSync, readdirSync } from 'node:fs';

const fails = [];

const page = readFileSync('404.html', 'utf8');
for (const m of page.matchAll(/\b(href|src)="([^"]*)"/g)) {
  if (!/^(https?:|\/|#|mailto:|data:)/.test(m[2])) fails.push(`P1 404.html: ${m[1]}="${m[2]}" is page-relative`);
}

const pal = readFileSync('js/rz-command-palette.js', 'utf8');
for (const m of pal.matchAll(/fetch\(([^)]*)\)/g)) {
  if (!/^at\(/.test(m[1])) fails.push(`P2 rz-command-palette.js: fetch(${m[1]}) bypasses at()`);
}
for (const m of pal.matchAll(/(href|src)="' \+ \(?([^ ]+)/g)) {
  if (!/^at\(/.test(m[2])) fails.push(`P3 rz-command-palette.js: ${m[1]} built from ${m[2]} bypasses at()`);
}

for (const f of [...readdirSync('.').filter((n) => n.endsWith('.html')), 'js/rz-command-palette.js']) {
  if (readFileSync(f, 'utf8').includes('class="search-input-wrapper"')) fails.push(`P4 ${f}: search modal on .search-input-wrapper, a class no stylesheet styles`);
}

if (fails.length) {
  for (const f of fails) console.log('  FAIL  ' + f);
  console.log(`[site-root-paths] ${fails.length} finding(s)`);
  process.exit(1);
}
console.log('[site-root-paths] PASS — 404.html is root-absolute; the palette resolves every fetch and link against its own URL');
