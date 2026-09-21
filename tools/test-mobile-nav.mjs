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
import { existsSync, readFileSync } from 'node:fs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/* EVERY page the sitemap publishes that has a navbar and a menu — 138 of them — not a sample.
   The first cut of this gate sampled seven "navbar shapes" and passed while 25 pages were broken:
   24 article/FF/geopolitics pages had NO visible toggle at all, and one had a 4px-wide one. A
   sample tells you about the sample. */
const ROOT_PAGES = (() => {
    const xml = readFileSync(join(ROOT, 'sitemap.xml'), 'utf8');
    const out = [];
    for (const m of xml.matchAll(/<loc>https:\/\/resistancezero\.com\/([^<]*)<\/loc>/g)) {
        const rel = m[1];
        if (!rel.endsWith('.html') || !existsSync(join(ROOT, rel))) { continue; }
        const html = readFileSync(join(ROOT, rel), 'utf8');
        if (!/class="[^"]*\b(navbar|nav-bar|rfs-navbar|cx-nav)\b/.test(html)) { continue; }
        if (!/class="[^"]*\b(nav-menu|nav-links|cx-nav-links|rfs-nav-links)\b/.test(html)) { continue; }
        out.push(rel);
    }
    return out;
})();
const PAGES = ROOT_PAGES;

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

    /* offsetParent is null for a position:fixed element, so it is the wrong visibility test for a
       navbar button; a real box is the right one. It also catches the 4px-wide burger that opened
       the menu correctly and could not be hit. */
    const visibleToggles = await page.evaluate((sel) =>
        [...document.querySelectorAll(sel)]
            .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 8 && r.height > 8; })
            .length, TOGGLES);
    if (visibleToggles !== 1) {
        findings.push({ page: rel, rule: 'N1 exactly one visible toggle', detail: `found ${visibleToggles}` });
        if (visibleToggles === 0) { continue; }
    }

    /* "Open" is not a height. A closed slide-in drawer is 774px tall and parked at left:-601px;
       a centre hit-test fails on a gated page because a root overlay sits above the menu. What a
       reader needs is LINKS THEY CAN SEE AND TAP, so that is what is counted. */
    const measure = () => page.evaluate((sel) => {
        const m = document.querySelector(sel);
        if (!m) { return { on: false, w: 0, h: 0, links: 0 }; }
        const r = m.getBoundingClientRect();
        const cs = getComputedStyle(m);
        const onScreen = r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
        const painted = cs.display !== 'none' && cs.visibility !== 'hidden'
            && parseFloat(cs.opacity) > 0.05;
        const links = Array.from(m.querySelectorAll('a')).filter((a) => {
            const ar = a.getBoundingClientRect();
            return ar.width > 20 && ar.height > 10
                && ar.bottom > 0 && ar.top < innerHeight && ar.right > 0 && ar.left < innerWidth;
        }).length;
        return { on: onScreen && painted, w: Math.round(r.width), h: Math.round(r.height), links };
    }, MENUS);
    const click = () => page.evaluate((sel) => {
        const t = [...document.querySelectorAll(sel)]
            .find((e) => { const r = e.getBoundingClientRect(); return r.width > 8 && r.height > 8; });
        if (t) { t.click(); }
    }, TOGGLES);

    await click();
    await new Promise((r) => setTimeout(r, 500));
    const opened = await measure();
    if (!(opened.on && opened.links >= 2)) {
        findings.push({ page: rel, rule: 'N2 the toggle opens a menu with tappable links',
                        detail: `menu ${opened.w}x${opened.h}px, ${opened.links} link(s) on screen` });
    }

    await click();
    await new Promise((r) => setTimeout(r, 500));
    const closed = await measure();
    if (closed.on && closed.links >= 2) {
        findings.push({ page: rel, rule: 'N3 the toggle closes it again',
                        detail: `${closed.links} link(s) still on screen` });
    }

    await page.setViewport({ width: 1280, height: 900 });
    await new Promise((r) => setTimeout(r, 400));
    const desktopToggles = await page.evaluate((sel) =>
        [...document.querySelectorAll(sel)]
            .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 8 && r.height > 8; })
            .length, TOGGLES);
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
