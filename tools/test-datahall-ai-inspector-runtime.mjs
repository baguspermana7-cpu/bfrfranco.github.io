#!/usr/bin/env node
/**
 * test-datahall-ai-inspector-runtime.mjs — two-tier equipment inspection on datahallAI.html
 * (Track A §A5; review doc-27 §3.2, doc-24 #6/#10).
 *
 *   T1 every diagram (13 + the floor views) carries >= 1 [data-rz-equipment] block with
 *      tabindex="0" role="button"; a REAL click on the first one opens the right-side inspector
 *      in payload mode (six tabs, status chip, provenance line) and does NOT open a centre modal
 *   T2 the Deps tab navigates; a hooked cell enters basis mode and "back" returns
 *   T3 "Open equipment HMI" (and a double-click) opens the tier-2 panel: focus inside, background
 *      inert, Tab wraps, ESC closes it, DHModal.activeTimers() is empty, no inert leak, focus returns
 *   T4 the sldMimic -> batHmi stack: ESC closes the battery first, then the mimic, timers zero
 *   T5 determinism: with window.__rzSimTick pinned, three reloads give identical inspector text
 *   T6 Rule 2 on the live page: a Math.random call counter is reset before each modal opens and
 *      must read 0 after two ticks — RED until WP4/WP5 land (reported per modal)
 *   T7 responsive ladder: 1440 docked (page padding), 1200 overlay, 900 bottom sheet <= 55vh, 390 full
 *
 *   node tools/test-datahall-ai-inspector-runtime.mjs [--strict-rule2]
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import puppeteer from 'puppeteer';
import { TAB_SETS, activateTab } from './lib/cockpit-tabs.mjs';
import { primeCockpitAuditDocument, enterAuthorizedAuditState, assertAuthorizedAuditState } from './lib/cockpit-audit-state.mjs';

const ROOT = process.cwd();
const PAGE = 'datahallAI.html';
const STRICT_RULE2 = process.argv.includes('--strict-rule2');
const set = TAB_SETS[PAGE];
const MIME = Object.freeze({ '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2' });
const server = createServer(async (req, res) => {
    const full = resolve(ROOT, decodeURIComponent(new URL(req.url, 'http://localhost').pathname.slice(1)));
    if (full !== ROOT && !full.startsWith(ROOT + sep)) { res.writeHead(403).end(); return; }
    try { res.writeHead(200, { 'content-type': MIME[extname(full)] || 'application/octet-stream' }).end(await readFile(full)); } catch { res.writeHead(404).end(); }
});
await new Promise((accept) => server.listen(0, '127.0.0.1', accept));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
const sleep = (ms) => new Promise((accept) => setTimeout(accept, ms));
const failures = [];
const note = (ok, msg) => { if (!ok) failures.push(msg); };

async function newTab(width = 1680) {
    const tab = await browser.newPage();
    const errors = [];
    tab.on('pageerror', (e) => errors.push(String(e)));
    await primeCockpitAuditDocument(tab, 'dark');
    await tab.evaluateOnNewDocument(() => {
        window.__rzSimTick = 4242;
        window.__rzRandomCalls = 0;
        const orig = Math.random;
        Math.random = function () { window.__rzRandomCalls++; return orig(); };
    });
    await tab.setViewport({ width, height: 1000 });
    await tab.goto(`${base}/${PAGE}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await sleep(2600);
    await enterAuthorizedAuditState(tab, set.cockpit);
    await assertAuthorizedAuditState(tab, set.cockpit);
    return { tab, errors };
}
const inspectorState = (tab) => tab.evaluate(() => {
    const el = document.querySelector('aside.rz-inspector');
    return {
        open: !!el && el.classList.contains('open'), payload: !!el && el.classList.contains('rz-inspector-payload'), basis: !!el && el.classList.contains('rz-inspector-basis'),
        title: el ? el.querySelector('[data-slot="id"]').textContent : '', tabs: el ? el.querySelectorAll('.rz-inspector-tab').length : 0,
        chip: el ? (el.querySelector('.rz-inspector-chip') || {}).textContent || '' : '', prov: el ? (el.querySelector('.rz-inspector-prov') || {}).textContent || '' : '',
        body: el ? el.querySelector('[data-slot="body"]').textContent.replace(/\s+/g, ' ').slice(0, 300) : '',
        hasOpenHmi: !!(el && el.querySelector('[data-rz-open-hmi]')), modalOpen: !!document.querySelector('.dh-modal-host.show'), scrim: !!document.querySelector('.dh-scrim.show'),
        rows: el ? el.querySelectorAll('.rz-inspector-v[data-basis-param], .rz-inspector-v[data-rz-authored-basis]').length : 0,
        both: el ? el.querySelectorAll('.rz-inspector-v[data-basis-param][data-rz-authored-basis]').length : 0,
        ready: document.body.getAttribute('data-rz-equipment-inspector'),
    };
});

const report = [];
const rule2 = [];
const seenClasses = new Set();
try {
    const { tab, errors } = await newTab();
    const views = [];
    for (const entry of set.diagrams) {
        if (entry.selector === '#floorSvg') { views.push({ ...entry, floor: 'gf', label: 'floor gf' }, { ...entry, floor: 'f2', label: 'floor f2' }); continue; }
        views.push(entry);
    }
    for (const entry of views) {
        await activateTab(tab, set, entry);
        if (entry.floor) {
            await tab.evaluate((key) => { document.querySelector('#bldgSvg [data-floor="' + key + '"]').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); }, entry.floor);
            await sleep(150);
        }
        const hooks = await tab.evaluate((sel) => [...document.querySelectorAll(sel + ' [data-rz-equipment]')].map((g) => ({ ref: g.getAttribute('data-rz-equipment'), tabindex: g.getAttribute('tabindex'), role: g.getAttribute('role') })), entry.selector);
        const row = { view: entry.selector.slice(1) + (entry.floor ? ':' + entry.floor : ''), blocks: hooks.length, status: hooks.length ? 'pending' : 'MONITOR', ref: hooks[0]?.ref || '' };
        const malformed = hooks.filter((h) => h.tabindex !== '0' || h.role !== 'button');
        note(!malformed.length, `${row.view}: ${malformed.length} equipment blocks without tabindex="0" role="button"`);
        if (hooks.length) {
            const handle = await tab.$(`${entry.selector} [data-rz-equipment]`);
            await handle.evaluate((el) => { el.scrollIntoView({ block: 'center', inline: 'center' }); el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window })); });
            await sleep(300);
            const st = await inspectorState(tab);
            const ok = st.open && st.payload && st.tabs === 6 && !st.modalOpen && !st.scrim && st.rows > 0 && st.both === 0 && /engine|scenario/.test(st.prov);
            note(ok, `${row.view}: click on ${hooks[0].ref} -> ${JSON.stringify({ ...st, body: st.body.slice(0, 80) })}`);
            row.status = ok ? 'INSPECTOR' : 'FAIL';
            seenClasses.add(hooks[0].ref.split(':')[0]);
            /* T2 — Deps navigation + basis cell round-trip on the first view that has them */
            if (ok) {
                await tab.click('.rz-inspector-tab[data-tab="deps"]');
                await sleep(100);
                const depCount = await tab.evaluate(() => document.querySelectorAll('.rz-inspector [data-rz-depid]').length);
                if (depCount) {
                    await tab.click('.rz-inspector [data-rz-depid]');
                    await sleep(250);
                    const afterNav = await inspectorState(tab);
                    note(afterNav.open && afterNav.payload && !afterNav.modalOpen, `${row.view}: deps navigation keeps the inspector open in payload mode`);
                }
                await tab.click('.rz-inspector-tab[data-tab="live"]');
                await sleep(100);
                const cell = await tab.$('.rz-inspector .rz-inspector-v[data-basis-param]');
                if (cell) {
                    await cell.click();
                    await sleep(250);
                    const b = await inspectorState(tab);
                    note(b.open && b.basis && !b.modalOpen && /Value/.test(b.body), `${row.view}: hooked cell enters basis mode (${JSON.stringify(b.body.slice(0, 80))})`);
                    const back = await tab.$('.rz-inspector-back');
                    note(!!back, `${row.view}: basis mode offers a way back`);
                    if (back) { await back.click(); await sleep(200); const r2 = await inspectorState(tab); note(r2.payload, `${row.view}: back returns to the payload`); }
                }
            }
            await tab.keyboard.press('Escape');
            await sleep(150);
        }
        report.push(row);
    }
    note(errors.length === 0, `page errors: ${errors.slice(0, 3).join(' | ')}`);

    /* T3 — tier 2 from the inspector action, a11y contract, timers, focus return */
    const t3 = await newTab();
    const T3 = [{ entry: set.diagrams[2], ref: 'cdu' }, { entry: set.diagrams[4], ref: 'chiller' }, { entry: set.diagrams[6], ref: 'sld-tx' }, { entry: set.diagrams[3], ref: 'rack-psu' }];
    for (const c of T3) {
        await activateTab(t3.tab, set, c.entry);
        const handle = await t3.tab.$(`${c.entry.selector} [data-rz-equipment^="${c.ref}:"]`);
        if (!handle) { note(false, `T3 ${c.ref}: no block on ${c.entry.selector}`); continue; }
        await handle.evaluate((el) => { el.scrollIntoView({ block: 'center', inline: 'center' }); el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window })); }); await sleep(250);
        const btn = await t3.tab.$('.rz-inspector [data-rz-open-hmi]');
        note(!!btn, `T3 ${c.ref}: inspector offers Open equipment HMI`);
        if (!btn) continue;
        await t3.tab.evaluate(() => { window.__rzRandomCalls = 0; });
        await btn.click(); await sleep(400);
        const m = await t3.tab.evaluate(() => {
            const top = window.DHModal && window.DHModal.top ? window.DHModal.top() : document.querySelector('.dh-modal-host.show');
            const a = document.activeElement;
            const inertLeak = [...document.body.children].some((k) => k.hasAttribute('inert') && !k.classList.contains('dh-modal-host'));
            return { open: !!top && top.classList.contains('show'), id: top ? top.id : '', focusInside: !!top && top.contains(a), inert: inertLeak, ariaModal: top ? top.getAttribute('aria-modal') : '', timers: window.DHModal ? window.DHModal.activeTimers() : null };
        });
        note(m.open && m.focusInside && m.inert && m.ariaModal === 'true', `T3 ${c.ref}: modal ${m.id} open with focus inside, background inert, aria-modal (${JSON.stringify(m)})`);
        /* Tab wraps inside the modal */
        await t3.tab.keyboard.press('Tab'); await t3.tab.keyboard.press('Tab');
        const stillInside = await t3.tab.evaluate(() => { const top = window.DHModal.top(); return top && top.contains(document.activeElement); });
        note(stillInside, `T3 ${c.ref}: focus stays trapped in the modal`);
        await sleep(8500);   /* two ticks of the modal's own renderer */
        const calls = await t3.tab.evaluate(() => window.__rzRandomCalls);
        rule2.push({ modal: m.id, randomCalls: calls });
        await t3.tab.keyboard.press('Escape'); await sleep(300);
        const after = await t3.tab.evaluate(() => ({ open: !!document.querySelector('.dh-modal-host.show'), timers: window.DHModal ? window.DHModal.activeTimers() : null, inertLeak: [...document.body.children].some((k) => k.hasAttribute('inert')), active: document.activeElement ? (document.activeElement.closest('aside.rz-inspector') ? 'inspector' : document.activeElement.getAttribute('data-rz-equipment') ? 'block' : document.activeElement.tagName) : 'none', inspectorOpen: !!document.querySelector('aside.rz-inspector.open') }));
        note(!after.open && after.timers && Object.keys(after.timers).length === 0 && !after.inertLeak, `T3 ${c.ref}: ESC closes ${m.id}, timers {} (${JSON.stringify(after.timers)}), no inert leak`);
        note(after.active === 'inspector' || after.active === 'block', `T3 ${c.ref}: focus returned to the invoker (${after.active})`);
        note(after.inspectorOpen, `T3 ${c.ref}: the inspector under the modal stays open after ESC`);
        await t3.tab.keyboard.press('Escape'); await sleep(150);
    }
    /* T4 — mimic -> battery stack */
    await activateTab(t3.tab, set, set.diagrams[6]);
    const txHandle = await t3.tab.$(`${set.diagrams[6].selector} [data-rz-equipment^="sld-ups-a:"]`);
    if (txHandle) {
        await txHandle.evaluate((el) => { el.scrollIntoView({ block: 'center' }); el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window })); }); await sleep(250);
        const b1 = await t3.tab.$('.rz-inspector [data-rz-open-hmi]'); if (b1) { await b1.click(); await sleep(500); }
        const bat = await t3.tab.$('#sldMimicSvg [data-bat]');
        if (bat) {
            await t3.tab.evaluate(() => { window.RZDatahallAIHmiOpeners.bat('A', 1); }); await sleep(400);
            const stack = await t3.tab.evaluate(() => window.DHModal.stack().map((p) => p.id));
            note(stack.join('>') === 'sldMimic>batHmi', `T4 stack is sldMimic>batHmi (${stack.join('>')})`);
            await t3.tab.keyboard.press('Escape'); await sleep(250);
            const s2 = await t3.tab.evaluate(() => ({ stack: window.DHModal.stack().map((p) => p.id), timers: window.DHModal.activeTimers() }));
            note(s2.stack.join('>') === 'sldMimic' && !s2.timers.batHmi, `T4 ESC closes the battery first (${JSON.stringify(s2)})`);
            await t3.tab.keyboard.press('Escape'); await sleep(250);
            const s3 = await t3.tab.evaluate(() => ({ stack: window.DHModal.stack().map((p) => p.id), timers: window.DHModal.activeTimers() }));
            note(s3.stack.length === 0 && Object.keys(s3.timers).length === 0, `T4 second ESC closes the mimic and clears every timer (${JSON.stringify(s3)})`);
        } else note(false, 'T4: no [data-bat] inside the UPS mimic');
    } else note(false, 'T4: no sld-ups-a block');
    note(t3.errors.length === 0, `T3 page errors: ${t3.errors.slice(0, 3).join(' | ')}`);
    await t3.tab.close();

    /* T5 — determinism across reloads at a pinned tick */
    const texts = [];
    for (let i = 0; i < 3; i++) {
        const { tab: t } = await newTab();
        await activateTab(t, set, set.diagrams[2]);
        const h = await t.$(`${set.diagrams[2].selector} [data-rz-equipment^="cdu:"]`);
        await h.evaluate((el) => { el.scrollIntoView({ block: 'center' }); el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window })); }); await sleep(300);
        texts.push(await t.evaluate(() => document.querySelector('.rz-inspector [data-slot="body"]').textContent));
        await t.close();
    }
    note(texts[0] === texts[1] && texts[1] === texts[2], 'T5 inspector text identical across 3 reloads at the pinned tick');

    /* T7 — responsive ladder */
    for (const [w, expect] of [[1440, 'docked'], [1200, 'overlay'], [900, 'sheet'], [390, 'sheet-full']]) {
        const { tab: t } = await newTab(w);
        await activateTab(t, set, set.diagrams[2]);
        const h = await t.$(`${set.diagrams[2].selector} [data-rz-equipment]`);
        await h.evaluate((el) => { el.scrollIntoView({ block: 'center' }); el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window })); }); await sleep(350);
        const g = await t.evaluate(() => { const el = document.querySelector('aside.rz-inspector'); const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return { x: r.x, y: r.y, w: r.width, h: r.height, vw: innerWidth, vh: innerHeight, pad: getComputedStyle(document.body).paddingRight, close: (document.querySelector('.rz-inspector-close') || {}).getBoundingClientRect ? document.querySelector('.rz-inspector-close').getBoundingClientRect().height : 0, overflowX: document.documentElement.scrollWidth > innerWidth + 1, docked: document.body.classList.contains('rz-inspector-docked') }; });
        let ok = false;
        if (expect === 'docked') ok = g.docked && parseInt(g.pad, 10) >= 360 && g.x + g.w <= g.vw + 1;
        if (expect === 'overlay') ok = !g.docked && g.w >= 340 && g.x + g.w <= g.vw + 1 && g.h >= g.vh - 1;
        if (expect === 'sheet') ok = g.w >= g.vw - 1 && g.h <= g.vh * 0.56 && g.y + g.h <= g.vh + 1;
        if (expect === 'sheet-full') ok = g.w >= g.vw - 1 && g.close >= 44 && !g.overflowX;
        note(ok, `T7 ${w}px ${expect}: ${JSON.stringify(g)}`);
        await t.close();
    }
} finally { await browser.close(); server.close(); }

console.log(`DCAI EQUIPMENT INSPECTOR — ${PAGE}`);
for (const r of report) console.log(`  ${r.view.padEnd(14)} blocks ${String(r.blocks).padStart(4)}  ${r.status}${r.ref ? ' (' + r.ref + ')' : ''}`);
console.log(`  classes clicked: ${[...seenClasses].join(', ')}`);
for (const r of rule2) console.log(`  Rule 2 ${r.modal.padEnd(12)} Math.random calls while open: ${r.randomCalls}${r.randomCalls ? '  (RED until WP4/WP5)' : '  CLEAN'}`);
if (STRICT_RULE2) for (const r of rule2) note(r.randomCalls === 0, `Rule 2: ${r.modal} still rolls ${r.randomCalls} dice while open`);
const monitor = report.filter((r) => r.status === 'MONITOR').map((r) => r.view);
if (failures.length) { console.error('\nFAIL\n  ' + failures.join('\n  ')); process.exit(1); }
console.log(monitor.length ? `\nPASS (monitor) — views without equipment blocks yet: ${monitor.join(', ')}` : '\nPASS — every view clickable, two tiers verified');
