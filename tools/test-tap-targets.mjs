#!/usr/bin/env node
/**
 * A navigation link must be big enough to hit.
 *
 * WHY THIS GATE EXISTS
 *
 * WCAG 2.2 Success Criterion 2.5.8 (Target Size, Minimum, AA) asks for 24x24 CSS px. The
 * `.nav-right` bar used by the 25 protocol explainers and three hubs renders its links as bare
 * inline anchors, so the target box is the TEXT box — measured **17px tall at 390px on 28 pages**.
 *
 * The criterion has an "inline" exception for targets inside a sentence. It does not apply here:
 * this is a navigation bar, and its links are the only way off those pages on a phone.
 *
 * Found while verifying the mobile-nav work on the live site. The hamburger gate could not see it,
 * because these pages carry no hamburger at all — their navigation is two always-visible links,
 * which is a valid design, and the defect was that those links were too small to tap.
 *
 * WHAT IS CHECKED
 *
 * Every page with a `.nav-right` bar, at 390px: no link may render under 24px tall while visible.
 * Hidden links (height 0) are not targets and are not counted.
 *
 * Usage: node tools/test-tap-targets.mjs [--json]
 */
import puppeteer from 'puppeteer-core';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VENDORED = /^(Article|Apps|Data|dcmoc|games|Dunia-Emosi|worktrees|backups|node_modules|standarization|prompts|Automation|my-video|TestEA|Documents|cf-worker|obsidian-knowledge-vault)\//;
const MIN = 24;                                   /* WCAG 2.5.8 AA */

const pages = execFileSync('git', ['ls-files', '*.html'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n').filter(Boolean).filter((f) => !VENDORED.test(f))
    .filter((f) => existsSync(join(ROOT, f)))
    .filter((f) => readFileSync(join(ROOT, f), 'utf8').includes('class="nav-right"'));

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
        await new Promise((r) => setTimeout(r, 250));
        const small = await page.evaluate((min) => {
            const nav = document.querySelector('.navbar .nav-right, header .nav-right');
            if (!nav) { return []; }
            return [...nav.querySelectorAll('a')]
                .map((a) => ({ t: a.textContent.trim().slice(0, 20), r: a.getBoundingClientRect() }))
                .filter(({ r }) => r.height > 0 && r.width > 0 && r.height < min)
                .map(({ t, r }) => `${t} (${Math.round(r.width)}x${Math.round(r.height)})`);
        }, MIN);
        if (small.length) {
            findings.push({ page: rel, detail: small.slice(0, 3).join(', ') });
        }
    } catch (error) {
        findings.push({ page: rel, detail: `render error: ${String(error.message).slice(0, 44)}` });
    }
}
await browser.close();

if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ pages: pages.length, min: MIN, findings }, null, 2));
    process.exit(findings.length ? 1 : 0);
}
console.log('── NAV TAP TARGETS ──');
if (!findings.length) {
    console.log(`  ✓ ${pages.length} page(s) with a .nav-right bar: every visible link is at least ${MIN}px tall at 390px`);
    console.log('\nPASS — no navigation link is too small to hit.');
    process.exit(0);
}
for (const f of findings) { console.log(`  ✗ ${f.page}  ${f.detail}`); }
console.log(`\nFAIL — ${findings.length} page(s) with a navigation link under ${MIN}px tall.`);
console.log('WCAG 2.5.8 (AA) asks for 24x24 CSS px. The inline exception is for links inside a');
console.log('sentence; a navigation bar is not one. Raise the target box, not the font size.');
process.exit(1);
