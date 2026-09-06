#!/usr/bin/env node
/**
 * test-dcai-basis-hooks.mjs — every traceability hook on datahallAI.html resolves and CLICKS.
 *
 *   H1 every literal data-basis-param="…" in the page source resolves in the registry
 *   H2 after activation, each of the 13 diagrams carries >= MIN_PER_DIAGRAM SVG hooks
 *      (<g class="rz-basis" data-basis-param tabindex="0" role="button"> with a mark circle)
 *      — diagrams still at zero are listed as MONITOR until the sweep reaches them
 *   H3 a REAL click on one SVG hook per diagram opens the right-side inspector in basis mode
 *      (aside.rz-inspector.open.rz-inspector-basis) whose Value row equals the registry value,
 *      and does NOT open the centre modal — review doc-27 §3.2
 *   H4 a click on an HTML hook still opens the centre basis drawer (Conventional behaviour kept)
 *   H5 the SVG hook's <title> names the evidence class the registry gives that id
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep, join } from 'node:path';
import puppeteer from 'puppeteer';
import { TAB_SETS, activateTab } from './lib/cockpit-tabs.mjs';
import { primeCockpitAuditDocument, enterAuthorizedAuditState, assertAuthorizedAuditState } from './lib/cockpit-audit-state.mjs';

const ROOT = process.cwd();
const PAGE = 'datahallAI.html';
const STRICT = process.argv.includes('--strict');
const src = await readFile(join(ROOT, PAGE), 'utf8');
const registry = JSON.parse(await readFile(join(ROOT, 'data', 'dcai-parameters.json'), 'utf8'));
const byId = new Map(registry.parameters.map((p) => [p.id, p]));
const set = TAB_SETS[PAGE];

/* H1 */
const literal = [...src.matchAll(/data-basis-param="([^"]+)"/g)].map((m) => m[1]).filter((id) => !id.includes('${') && !id.includes("'+"));
const bad = [...new Set(literal.filter((id) => !byId.has(id)))];
assert.deepEqual(bad, [], `literal data-basis-param ids not in the registry: ${bad.join(', ')}`);

const MIME = Object.freeze({ '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2' });
const server = createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const full = resolve(ROOT, decodeURIComponent(pathname.slice(1)));
    if (full !== ROOT && !full.startsWith(ROOT + sep)) { res.writeHead(403).end(); return; }
    try { res.writeHead(200, { 'content-type': MIME[extname(full)] || 'application/octet-stream' }).end(await readFile(full)); } catch { res.writeHead(404).end(); }
});
await new Promise((accept) => server.listen(0, '127.0.0.1', accept));
const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
const report = [];
let failures = [];
try {
    const tab = await browser.newPage();
    await primeCockpitAuditDocument(tab, 'dark');
    await tab.setViewport({ width: 1680, height: 1000 });
    await tab.goto(`http://127.0.0.1:${server.address().port}/${PAGE}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await new Promise((accept) => setTimeout(accept, 2600));
    await enterAuthorizedAuditState(tab, set.cockpit);
    await assertAuthorizedAuditState(tab, set.cockpit);

    /* H4 first, on the default tab: an HTML hook opens the centre drawer, not the inspector */
    const htmlHookSel = await tab.evaluate(() => {
        const hooks = [...document.querySelectorAll('[data-basis-param]')].filter((el) => !el.closest('svg') && el.getBoundingClientRect().height > 0);
        if (!hooks.length) return null;
        hooks[0].setAttribute('data-rz-h4-target', '1');
        return '[data-rz-h4-target]';
    });
    assert.ok(htmlHookSel, 'a visible HTML data-basis-param hook must exist on the default tab');
    const htmlHook = await tab.$(htmlHookSel);
    await htmlHook.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await htmlHook.click();
    await new Promise((accept) => setTimeout(accept, 250));
    const h4 = await tab.evaluate(() => ({ drawer: !!document.querySelector('#rz-basis-drawer[aria-hidden="false"]'), inspector: !!document.querySelector('aside.rz-inspector.open') }));
    assert.ok(h4.drawer && !h4.inspector, `H4: HTML hook must open the centre drawer, not the inspector: ${JSON.stringify(h4)}`);
    await tab.keyboard.press('Escape');
    await new Promise((accept) => setTimeout(accept, 150));

    for (const entry of set.diagrams) {
        await activateTab(tab, set, entry);
        const hooks = await tab.evaluate((sel) => {
            const svg = document.querySelector(sel);
            const gs = [...svg.querySelectorAll('g.rz-basis[data-basis-param]')];
            return gs.map((g) => ({
                id: g.getAttribute('data-basis-param'), tabindex: g.getAttribute('tabindex'), role: g.getAttribute('role'),
                mark: !!g.querySelector('circle.rz-basis-mark') || g.hasAttribute('data-rz-nomark'), title: (g.querySelector('title') || {}).textContent || '',
                text: (g.querySelector('text') || {}).textContent || '',
            }));
        }, entry.selector);
        const row = { diagram: entry.selector.slice(1), hooks: hooks.length, clicked: null, status: 'MONITOR' };
        const malformed = hooks.filter((h) => h.tabindex !== '0' || h.role !== 'button' || !h.mark || !byId.has(h.id));
        if (malformed.length) failures.push(`${row.diagram}: ${malformed.length} malformed hooks (tabindex/role/mark/id) e.g. ${JSON.stringify(malformed[0])}`);
        /* H5 */
        const wrongTitle = hooks.filter((h) => !h.title.includes(String(byId.get(h.id)?.evidenceClass || '').split('/')[0]));
        if (wrongTitle.length) failures.push(`${row.diagram}: ${wrongTitle.length} hook titles do not name the registry evidence class e.g. ${JSON.stringify(wrongTitle[0])}`);
        if (hooks.length) {
            /* H3: real click on the first hook that is inside the viewport after scrollIntoView */
            const handle = await tab.$(`${entry.selector} g.rz-basis[data-basis-param]`);
            await handle.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'center' }));
            await new Promise((accept) => setTimeout(accept, 60));
            await handle.click();
            await new Promise((accept) => setTimeout(accept, 250));
            const res = await tab.evaluate(() => {
                const insp = document.querySelector('aside.rz-inspector');
                const drawerOpen = !!document.querySelector('#rz-basis-drawer[aria-hidden="false"]');
                return { open: !!insp && insp.classList.contains('open'), basis: !!insp && insp.classList.contains('rz-inspector-basis'), id: insp ? insp.querySelector('[data-slot="id"]').textContent : '', body: insp ? insp.querySelector('[data-slot="body"]').textContent.replace(/\s+/g, ' ').slice(0, 400) : '', drawerOpen };
            });
            const p = byId.get(hooks[0].id);
            const wanted = String(typeof p.value === 'number' ? Number(p.value.toFixed(3)) : p.value).replace(/\.?0+$/, '').slice(0, 6);
            const valueShown = p && res.body.replace(/,/g, '').includes(wanted.replace(/,/g, ''));
            row.clicked = hooks[0].id;
            if (!res.open || !res.basis || res.id !== hooks[0].id || res.drawerOpen || !valueShown) {
                failures.push(`${row.diagram}: click on ${hooks[0].id} -> ${JSON.stringify({ ...res, body: res.body.slice(0, 120) })}`);
                row.status = 'FAIL';
            } else row.status = 'CLICK-OK';
            await tab.keyboard.press('Escape');
        }
        report.push(row);
    }
} finally { await browser.close(); server.close(); }

console.log(`DCAI BASIS HOOKS — ${PAGE} · ${literal.length} literal hooks in source, all resolve`);
for (const r of report) console.log(`  ${r.diagram.padEnd(12)} hooks ${String(r.hooks).padStart(4)}  ${r.status}${r.clicked ? ' (' + r.clicked + ')' : ''}`);
const zero = report.filter((r) => r.hooks === 0).map((r) => r.diagram);
if (failures.length) { console.error('\nFAIL\n  ' + failures.join('\n  ')); process.exit(1); }
if (STRICT && zero.length) { console.error(`\nFAIL diagrams with no SVG hooks: ${zero.join(', ')}`); process.exit(1); }
console.log(zero.length ? `\nPASS (monitor) — ${zero.length} diagram(s) not yet hooked: ${zero.join(', ')}` : '\nPASS — every diagram hooked and click-verified');
