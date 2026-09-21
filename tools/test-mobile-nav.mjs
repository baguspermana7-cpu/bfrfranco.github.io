#!/usr/bin/env node
/**
 * One hamburger, and it opens the menu.
 *
 * WHY THIS GATE EXISTS
 *
 * Owner, on `datacenter-solutions.html` at 390px: *"Hamburger button utk menu ada 2 dan nggak
 * working saat di klik. Ini critical."* Two buttons in one header, neither of which did anything.
 *
 * `js/rz-mobile-nav.js` says in its own header that it exists to prevent exactly that — it detects
 * an existing toggle and wires it up "instead of double-injecting". It missed, on seven pages, for
 * three compounding reasons, and none of them is visible by reading the file:
 *
 *   1. The detector's selector list did not include `.mobile-nav-toggle`, which is how these seven
 *      pages mark their button up. It fell through to the inject branch and added a SECOND burger.
 *   2. Those pages do not load `styles.min.css`, so none of its 45 `body.rz-nav-open` rules reach
 *      them. The surviving burger set the class correctly and nothing listened.
 *   3. They DO ship their own drawer — `.navbar.menu-open .nav-links`, in their own palette — but
 *      89 pages carry a mobile block with `.nav-menu, .nav-links { display: none !important }`,
 *      and importance beats specificity. A finished design sat behind a rule it could never win
 *      against.
 *
 * Reading the source would not have caught any of this. Only a rendered page at a phone width,
 * clicked, answers the question the owner asked.
 *
 * WHAT IS ASSERTED, at 390px on a sample of every navbar shape the site uses:
 *
 *   N1  exactly one VISIBLE toggle — two is the bug that prompted this gate
 *   N2  clicking it opens a menu of real size (> 100px tall), not a class nobody styles
 *   N3  clicking again closes it — a drawer that cannot be dismissed traps a phone reader
 *   N4  at 1280px no toggle is visible — the desktop nav is not a burger
 *
 * Usage: node tools/test-mobile-nav.mjs [--json]
 */
import puppeteer from 'puppeteer-core';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/* One page per navbar shape, not a crawl: the shapes are what differ, and a full crawl of 176
   pages at two viewports would cost more than it tells. `.mobile-nav-toggle` pages first —
   they are the ones that shipped broken. */
const PAGES = [
    'datacenter-solutions.html',        // .mobile-nav-toggle + dropdowns
    'pln-java-grid.html',               // .mobile-nav-toggle, own drawer design
    'pln-java-grid-jatim.html',
    'index.html',                       // .hamburger + shared stylesheet
    'articles.html',
    'glossary.html',
    'tools.html',
];

const TOGGLES = '.rz-nav-burger, .mobile-nav-toggle, .hamburger, .menu-toggle, .nav-toggle';
const MENUS = '.nav-menu, .nav-links, .cx-nav-links, .rfs-nav-links';

const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
});
const page = await browser.newPage();
const findings = [];

for (const rel of PAGES) {
    const file = join(ROOT, rel);
    if (!existsSync(file)) { findings.push({ page: rel, rule: 'page exists', detail: 'not on disk' }); continue; }

    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto('file://' + file, { waitUntil: 'networkidle0', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 800));

    const visibleToggles = await page.evaluate((sel) =>
        [...document.querySelectorAll(sel)].filter((e) => e.offsetParent !== null).length, TOGGLES);
    if (visibleToggles !== 1) {
        findings.push({ page: rel, rule: 'N1 exactly one visible toggle', detail: `found ${visibleToggles}` });
        if (visibleToggles === 0) { continue; }
    }

    const measure = () => page.evaluate((sel) => {
        const m = document.querySelector(sel);
        if (!m) { return { h: 0 }; }
        const r = m.getBoundingClientRect();
        return { h: Math.round(r.height), w: Math.round(r.width) };
    }, MENUS);
    const click = () => page.evaluate((sel) => {
        const t = [...document.querySelectorAll(sel)].find((e) => e.offsetParent !== null);
        if (t) { t.click(); }
    }, TOGGLES);

    await click();
    await new Promise((r) => setTimeout(r, 500));
    const opened = await measure();
    if (!(opened.h > 100 && opened.w > 100)) {
        findings.push({ page: rel, rule: 'N2 the toggle opens the menu', detail: `menu ${opened.w}x${opened.h}px` });
    }

    await click();
    await new Promise((r) => setTimeout(r, 500));
    const closed = await measure();
    if (closed.h > 100) {
        findings.push({ page: rel, rule: 'N3 the toggle closes it again', detail: `menu still ${closed.h}px tall` });
    }

    await page.setViewport({ width: 1280, height: 900 });
    await new Promise((r) => setTimeout(r, 400));
    const desktopToggles = await page.evaluate((sel) =>
        [...document.querySelectorAll(sel)].filter((e) => e.offsetParent !== null).length, TOGGLES);
    if (desktopToggles !== 0) {
        findings.push({ page: rel, rule: 'N4 no toggle on desktop', detail: `${desktopToggles} visible at 1280px` });
    }
}
await browser.close();

if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ pages: PAGES.length, findings }, null, 2));
    process.exit(findings.length ? 1 : 0);
}
console.log('── MOBILE NAV ──');
if (!findings.length) {
    console.log(`  ✓ ${PAGES.length} navbar shape(s): one toggle at 390px, it opens and closes, none at 1280px`);
    console.log('\nPASS — every navbar shape has exactly one working hamburger.');
    process.exit(0);
}
for (const f of findings) { console.log(`  ✗ ${f.page}  [${f.rule}] ${f.detail}`); }
console.log(`\nFAIL — ${findings.length} finding(s).`);
console.log('A second hamburger means the detector in js/rz-mobile-nav.js missed this page’s');
console.log('toggle class. A menu that does not open means nothing styles the open state at a');
console.log('weight that beats the `display:none !important` mobile block 89 pages carry.');
process.exit(1);
