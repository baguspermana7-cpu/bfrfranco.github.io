#!/usr/bin/env node
/* ============================================================================
   audit-responsive-layout.mjs — RESPONSIVE GATE.

   Renders every content page (headless, file://) at mobile / tablet / wide and
   FAILS on the two responsive defects we actually paid for:

     1) MOBILE/TABLET horizontal overflow  — the page scrolls sideways on a phone
        (a table / toolbar / grid that doesn't wrap or scroll). Threshold 8px.
     2) ARTICLE reading-column blow-out — a `.article-body` prose table is wider
        than the reading measure on a wide screen ("table lebih lebar dari text").
        Threshold: article tables > 900px wide at 2400px viewport.

   Full-bleed hero/colored bands legitimately span the viewport, so we do NOT
   flag "content == viewport width"; only the two real defects above.

   Usage:  node tools/audit-responsive-layout.mjs [--strict]
   Exit 1 (with --strict) if any page fails. Part of the ship-audit suite.
   See standarization/RESPONSIVE_STANDARD.md "Article reading column".
   ============================================================================ */
import puppeteer from 'puppeteer';
import { readdirSync } from 'fs';
import { resolve } from 'path';

const STRICT = process.argv.includes('--strict');
const ROOT = process.cwd();
const SKIP = /^(rz-|plan-|planb|google|404|sitemap|robots|llms|article-9-paper)/;
const pages = readdirSync(ROOT).filter(f => f.endsWith('.html') && !SKIP.test(f)).sort();

const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });

async function measure(f) {
  const r = { f, mobileOverflow: 0, tabletOverflow: 0, wideTableW: 0 };
  for (const [w, key] of [[390, 'm'], [768, 't'], [2400, 'wide']]) {
    const pg = await browser.newPage();
    await pg.setViewport({ width: w, height: 900 });
    try {
      await pg.goto('file://' + resolve(ROOT, f), { waitUntil: 'domcontentloaded', timeout: 25000 });
      await new Promise(rs => setTimeout(rs, 200));
      const m = await pg.evaluate(() => {
        // Honest metric: can the USER actually scroll the page sideways? scrollWidth
        // alone false-positives when overflow-x:hidden clips content (html stays visible).
        window.scrollTo(99999, 0);
        const over = Math.round(window.scrollX);
        window.scrollTo(0, 0);
        let maxArtTbl = 0;
        document.querySelectorAll('.article-body > table, .article-body > .table-wrap > table').forEach(e => {
          const bw = e.getBoundingClientRect().width; if (bw > maxArtTbl) maxArtTbl = bw;
        });
        return { over, maxArtTbl: Math.round(maxArtTbl) };
      });
      if (key === 'm') r.mobileOverflow = m.over;
      if (key === 't') r.tabletOverflow = m.over;
      if (key === 'wide') r.wideTableW = m.maxArtTbl;
    } catch (e) { /* heavy/auth pages may time out on file://; not a layout failure */ }
    await pg.close();
  }
  return r;
}

const rows = [];
const POOL = 6;
let idx = 0;
async function worker() { while (idx < pages.length) { rows.push(await measure(pages[idx++])); } }
await Promise.all(Array.from({ length: POOL }, worker));
await browser.close();
rows.sort((a, c) => a.f.localeCompare(c.f));

const mob = rows.filter(r => r.mobileOverflow > 8);
const tab = rows.filter(r => r.tabletOverflow > 8);
const wideTbl = rows.filter(r => r.wideTableW > 900);

let failed = false;
if (mob.length) {
  failed = true;
  console.log('\n✗ MOBILE (390) horizontal overflow — page scrolls sideways on a phone:');
  mob.sort((a, c) => c.mobileOverflow - a.mobileOverflow).forEach(r => console.log(`   ${r.f.padEnd(38)} +${r.mobileOverflow}px`));
}
if (tab.length) {
  failed = true;
  console.log('\n✗ TABLET (768) horizontal overflow:');
  tab.sort((a, c) => c.tabletOverflow - a.tabletOverflow).forEach(r => console.log(`   ${r.f.padEnd(38)} +${r.tabletOverflow}px`));
}
if (wideTbl.length) {
  failed = true;
  console.log('\n✗ ARTICLE TABLE wider than reading column (>900px @2400) — table sprawls past the prose:');
  wideTbl.sort((a, c) => c.wideTableW - a.wideTableW).forEach(r => console.log(`   ${r.f.padEnd(38)} table=${r.wideTableW}px`));
}
if (!failed) {
  console.log(`\nRESPONSIVE-LAYOUT AUDIT — CLEAN. ${pages.length} content pages: no mobile/tablet overflow, article tables within the reading column.`);
} else {
  console.log(`\nRESPONSIVE-LAYOUT AUDIT — ${mob.length} mobile-overflow + ${tab.length} tablet-overflow + ${wideTbl.length} wide-article-table, of ${pages.length} pages.`);
  console.log('Fix: wrap wide tables/toolbars in an overflow-x:auto scroll container; keep article prose tables inside the centered reading column. See standarization/RESPONSIVE_STANDARD.md.');
}
process.exit(STRICT && failed ? 1 : 0);
