#!/usr/bin/env node
/**
 * A text field on a phone is 16px, or iOS zooms the page and does not come back.
 *
 * WHY THIS GATE EXISTS
 *
 * iOS Safari zooms the viewport whenever a focused text-entry control has a font-size under 16px,
 * and it does NOT restore the zoom afterwards. The reader is left in a magnified page and has to
 * pinch out by hand, on every field.
 *
 * Measured at 390px across the pages sitemap.xml publishes: **1,471 controls on 154 pages** sat
 * between 10px and 15.2px. `spares-readiness-calculator.html` alone had 277. On a site whose main
 * offering is interactive calculators, that is most of the value of the site behaving badly on the
 * device most readers arrive with.
 *
 * WHAT IS CHECKED, AND WHAT IS NOT
 *
 * Only controls that actually zoom: text-like `input`, `select`, `textarea`. A checkbox, radio,
 * range or colour swatch has no text to size and is left alone — matching the rule that fixes it,
 * so the gate and the fix cannot disagree about scope.
 *
 * Hidden controls are skipped: a field inside a closed `<details>` or an `aria-hidden` panel is
 * not a field anyone can focus.
 *
 * WHY THE FIX NEEDS `!important`
 *
 * A page's own `.form-group input` (specificity 0,1,1) outranks a bare `input` (0,0,1). The first
 * cut of the rule left **377 controls on 54 pages** still zooming for exactly that reason. This is
 * an accessibility floor at a single breakpoint, not a style preference.
 *
 * Usage: node tools/test-mobile-forms.mjs [--json]
 */
import puppeteer from 'puppeteer-core';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MIN = 16;
const SELECTOR = 'input:not([type=hidden]):not([type=checkbox]):not([type=radio])'
    + ':not([type=range]):not([type=color]),select,textarea';

const xml = readFileSync(join(ROOT, 'sitemap.xml'), 'utf8');
const pages = [...xml.matchAll(/<loc>https:\/\/resistancezero\.com\/([^<]*)<\/loc>/g)]
    .map((m) => m[1]).filter((p) => p.endsWith('.html'))
    .filter((p) => existsSync(join(ROOT, p)));

const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

const findings = [];
for (const rel of pages) {
    try {
        await page.goto('file://' + join(ROOT, rel), { waitUntil: 'domcontentloaded', timeout: 20000 });
        await new Promise((r) => setTimeout(r, 220));
        const small = await page.evaluate((sel, min) => {
            const out = [];
            for (const e of document.querySelectorAll(sel)) {
                const cs = getComputedStyle(e);
                if (cs.display === 'none' || cs.visibility === 'hidden') { continue; }
                if (e.closest('[aria-hidden="true"],[hidden],details:not([open])')) { continue; }
                const fs = parseFloat(cs.fontSize);
                if (fs && fs < min) { out.push(`${e.tagName.toLowerCase()}[${e.type || ''}] ${Math.round(fs * 10) / 10}px`); }
            }
            return out;
        }, SELECTOR, MIN);
        if (small.length) {
            findings.push({ page: rel, count: small.length, detail: [...new Set(small)].slice(0, 3).join(', ') });
        }
    } catch (error) {
        findings.push({ page: rel, count: 0, detail: `render error: ${String(error.message).slice(0, 44)}` });
    }
}
await browser.close();

if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ pages: pages.length, min: MIN, findings }, null, 2));
    process.exit(findings.length ? 1 : 0);
}
console.log('── MOBILE FORM CONTROLS ──');
if (!findings.length) {
    console.log(`  ✓ ${pages.length} published page(s): every focusable text control is at least ${MIN}px at 390px`);
    console.log('\nPASS — no field will zoom the viewport on iOS.');
    process.exit(0);
}
const total = findings.reduce((n, f) => n + f.count, 0);
for (const f of findings.slice(0, 15)) { console.log(`  ✗ ${f.page}  ${f.count} control(s): ${f.detail}`); }
if (findings.length > 15) { console.log(`  … and ${findings.length - 15} more page(s)`); }
console.log(`\nFAIL — ${total} control(s) under ${MIN}px across ${findings.length} page(s).`);
console.log('iOS Safari zooms on focus and does not zoom back. Raise the control to 16px at the');
console.log('phone breakpoint; a page-local selector will outrank a bare element rule, so the');
console.log('floor needs !important.');
process.exit(1);
