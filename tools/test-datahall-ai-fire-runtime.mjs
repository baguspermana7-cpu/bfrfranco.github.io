#!/usr/bin/env node
/**
 * test-datahall-ai-fire-runtime.mjs — the Fire & Safety workstation on datahallAI.html (Track A §A6;
 * owner comment (5), doc-27 §5.6, doc-24 §8, doc-08).
 *
 *   R1  the fire sub-tab strip is scoped: clicking it never touches the electrical sub-panels, and vice versa;
 *       aria-selected follows the strip
 *   R2  a point row opens the inspector in payload mode with an Isolate action; the dialog traps focus and
 *       gates submit on reason + expiry; submit isolates the point, returns focus, and the record lands in
 *       the Alarms workspace (saved view Fire)
 *   R3  a manual call point is never isolable: the action is aria-disabled with the reason
 *   R4  the two-means rule end to end: isolating Z12's aspirating unit and both spot loops makes the zone
 *       IMPAIRED with release inhibited; the page-wide banner shows FIRE WATCH on another tab; the alarm
 *       strip on that tab warns and its maintenance count equals the register; the sidebar agrees
 *   R5  cause & effect: suppression_release + the impaired zone → a matrix row reads BLOCKED
 *   R6  restoring every point clears the banner, the warning and the tile
 *   R7  three reloads at the pinned tick give identical point-list and summary text
 *   R8  a staged training run advances with the sim tick: T+60 s turns pending release rows DUE
 *   R9  ESC closes the isolation dialog with DHModal.activeTimers() empty and no inert leak
 *   R10 no Math.random call while the workstation runs (counter idiom)
 *   R11 the register survives a reload; Clear register empties it with a record
 *   R12 the coverage walker finds no untraced numeral in the point list or zones view with isolations applied
 *
 *   node tools/test-datahall-ai-fire-runtime.mjs
 */
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import puppeteer from 'puppeteer';
import { TAB_SETS, activateTab } from './lib/cockpit-tabs.mjs';
import { primeCockpitAuditDocument, enterAuthorizedAuditState, assertAuthorizedAuditState } from './lib/cockpit-audit-state.mjs';
import { WALKER_SOURCE } from './lib/dcai-coverage-walker.mjs';

const ROOT = process.cwd();
const PAGE = 'datahallAI.html';
const set = TAB_SETS[PAGE];
const FIRE = set.diagrams.filter((d) => d.tab === 'fire');
const entry = (sub) => FIRE.find((d) => d.sub === sub);
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

async function newTab(opts = {}) {
    const tab = await browser.newPage();
    const errors = [];
    tab.on('pageerror', (e) => errors.push(String(e && e.message ? e.message : e)));
    await primeCockpitAuditDocument(tab, 'dark');
    await tab.evaluateOnNewDocument((keep) => {
        window.__rzSimTick = 4242;
        window.__rzRandomCalls = 0;
        const orig = Math.random;
        Math.random = function () { window.__rzRandomCalls++; return orig(); };
        if (!keep) { try { localStorage.removeItem('dhFireIsolationRegister'); } catch (e) { /* no storage */ } }
    }, !!opts.keepRegister);
    await tab.setViewport({ width: opts.width || 1680, height: 1000 });
    await tab.goto(`${base}/${PAGE}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await sleep(2600);
    await enterAuthorizedAuditState(tab, set.cockpit);
    await assertAuthorizedAuditState(tab, set.cockpit);
    await tab.waitForFunction(() => document.body.getAttribute('data-rz-fire-workstation') === 'ready', { timeout: 15000 });
    await tab.evaluate(() => { window.__rzRandomCalls = 0; });   /* the analytics tracker rolls once at load; the workstation must not */
    return { tab, errors };
}
const clickRef = async (tab, ref) => {
    const ok = await tab.evaluate((r) => { const el = document.querySelector('[data-rz-equipment="' + r + '"]'); if (!el) return false; el.scrollIntoView({ block: 'center' }); el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window })); return true; }, ref);
    await sleep(250); return ok;
};
const inspector = (tab) => tab.evaluate(() => {
    const el = document.querySelector('aside.rz-inspector');
    return { open: !!el && el.classList.contains('open'), payload: !!el && el.classList.contains('rz-inspector-payload'), title: el ? el.querySelector('[data-slot="id"]').textContent : '',
        actions: el ? [...el.querySelectorAll('[data-rz-action]')].map((b) => ({ id: b.getAttribute('data-rz-action'), disabled: b.getAttribute('aria-disabled') === 'true', title: b.title })) : [],
        chip: el ? ((el.querySelector('.rz-inspector-chip') || {}).textContent || '') : '', body: el ? el.querySelector('[data-slot="body"]').textContent.replace(/\s+/g, ' ').slice(0, 400) : '' };
});
const summary = (tab) => tab.evaluate(() => window.RZDatahallAIFireWorkstation.summary());
const strip = (tab, panel) => tab.evaluate((p) => { const bar = document.querySelector('#' + p + ' .dh-alarmbar'); if (!bar) return null; const t = bar.textContent; const m = (k) => { const r = new RegExp(k + '\\s*(\\d+)').exec(t); return r ? Number(r[1]) : null; }; return { state: (bar.querySelector('.ab-state') || {}).textContent || '', crit: m('Critical'), warn: m('Warning'), maint: m('Maintenance') }; }, panel);

try {
    /* R1 — scoped sub-tabs */
    const { tab, errors } = await newTab();
    await activateTab(tab, set, set.diagrams.find((d) => d.sub === 'dh02'));
    const elecBefore = await tab.evaluate(() => ({ on: document.querySelector('#elecTabs .et.on').getAttribute('data-ep'), panels: [...document.querySelectorAll('.ep.on')].map((p) => p.id) }));
    await activateTab(tab, set, entry('zones'));
    const elecAfter = await tab.evaluate(() => ({ on: document.querySelector('#elecTabs .et.on').getAttribute('data-ep'), panels: [...document.querySelectorAll('.ep.on')].map((p) => p.id) }));
    note(JSON.stringify(elecBefore) === JSON.stringify(elecAfter) && elecBefore.on === 'dh02', `R1 fire sub-tab click left the electrical strip alone (${JSON.stringify(elecBefore)} -> ${JSON.stringify(elecAfter)})`);
    const fireState = await tab.evaluate(() => ({ on: [...document.querySelectorAll('#fireTabs .ft')].filter((b) => b.classList.contains('on')).map((b) => b.getAttribute('data-fp')), sel: [...document.querySelectorAll('#fireTabs .ft')].map((b) => b.getAttribute('aria-selected')), panels: [...document.querySelectorAll('#p-fire .fp.on')].map((p) => p.id) }));
    note(fireState.on.join() === 'zones' && fireState.panels.join() === 'fp-zones' && fireState.sel.join() === 'false,true,false,false', `R1 fire strip state after clicking zones: ${JSON.stringify(fireState)}`);
    await activateTab(tab, set, set.diagrams.find((d) => d.sub === 'dh03'));
    const fireAfterElec = await tab.evaluate(() => [...document.querySelectorAll('#p-fire .fp.on')].map((p) => p.id).join());
    note(fireAfterElec === 'fp-zones', `R1 electrical sub-tab click left the fire strip alone (${fireAfterElec})`);
    await activateTab(tab, set, entry('points'));
    const rows = await tab.evaluate(() => document.querySelectorAll('#firePointsBody tr[data-rz-equipment^="fire-point:"]').length);
    note(rows > 100, `R1 point list renders the hall inventory (${rows} rows)`);
    const sm0 = await summary(tab);
    note(sm0 && sm0.fire === 'NORMAL' && sm0.disabled === 0 && sm0.pointsTotal > 400, `R1 summary at boot: ${JSON.stringify(sm0)}`);

    /* R3 — life-safety refusal */
    note(await clickRef(tab, 'fire-point:DH-01-MCP-N'), 'R3 MCP row exists');
    const mcp = await inspector(tab);
    note(mcp.open && mcp.payload && mcp.actions.some((a) => a.id === 'isolate' && a.disabled && /life-safety/i.test(a.title)), `R3 MCP inspector offers a DISABLED isolate with the reason: ${JSON.stringify(mcp.actions)}`);
    const refusal = await tab.evaluate(() => window.RZDatahallAIFireWorkstation.isolate({ pointId: 'DH-01-MCP-N', owner: 'shift-a', reason: 'trying to isolate a call point', expiryId: '2h' }));
    note(refusal.ok === false && refusal.code === 'LIFE_SAFETY_POINT', `R3 API refuses with LIFE_SAFETY_POINT (${refusal.code})`);
    const refusedLogged = await tab.evaluate(() => window.RZDatahallAIAlarmWorkspace.events().some((e) => e.event === 'isolation-refused' && /LIFE_SAFETY_POINT/.test(e.message)));
    note(refusedLogged, 'R3 the refusal is in the Alarms workspace');

    /* R2 — isolate through the inspector + dialog */
    const target = 'DH-01-Z12-SD1-01';
    note(await clickRef(tab, 'fire-point:' + target), 'R2 point row exists');
    const ins = await inspector(tab);
    note(ins.open && ins.payload && ins.actions.some((a) => a.id === 'isolate' && !a.disabled), `R2 inspector open with an enabled Isolate action: ${JSON.stringify(ins.actions)}`);
    await tab.click('.rz-inspector [data-rz-action="isolate"]'); await sleep(400);
    const dlg = await tab.evaluate(() => { const d = document.getElementById('fireIsoDialog'); const a = document.activeElement; return { show: d.classList.contains('show'), focusInside: d.contains(a), submitDisabled: document.getElementById('fireIsoSubmit').disabled, inert: [...document.body.children].some((k) => k.hasAttribute('inert')), ariaModal: d.getAttribute('aria-modal'), consequence: document.getElementById('fireIsoConsequence').textContent }; });
    note(dlg.show && dlg.focusInside && dlg.submitDisabled && dlg.inert, `R2 dialog open, focus inside, submit gated, background inert: ${JSON.stringify(dlg)}`);
    await tab.keyboard.press('Tab'); await tab.keyboard.press('Tab'); await tab.keyboard.press('Tab'); await tab.keyboard.press('Tab'); await tab.keyboard.press('Tab'); await tab.keyboard.press('Tab'); await tab.keyboard.press('Tab');
    note(await tab.evaluate(() => document.getElementById('fireIsoDialog').contains(document.activeElement)), 'R2 Tab stays trapped in the dialog');
    await tab.evaluate(() => { const r = document.getElementById('fireIsoReason'); r.value = 'loop 1 detector head replacement'; r.dispatchEvent(new Event('input', { bubbles: true })); document.getElementById('fireIsoExpiry').value = '8h'; document.getElementById('fireIsoExpiry').dispatchEvent(new Event('change', { bubbles: true })); });
    await sleep(100);
    const gate = await tab.evaluate(() => ({ submitDisabled: document.getElementById('fireIsoSubmit').disabled, consequence: document.getElementById('fireIsoConsequence').textContent, ack: document.getElementById('fireIsoAckWrap').hidden }));
    note(!gate.submitDisabled && gate.ack, `R2 reason + expiry enable submit with no impairment (${JSON.stringify(gate)})`);
    await tab.click('#fireIsoSubmit'); await sleep(500);
    const after = await tab.evaluate((id) => ({ show: document.getElementById('fireIsoDialog').classList.contains('show'), row: (document.querySelector('[data-rz-equipment="fire-point:' + id + '"]') || {}).getAttribute?.('data-state'), active: document.activeElement ? (document.activeElement.closest('aside.rz-inspector') ? 'inspector' : document.activeElement.tagName) : 'none', timers: window.DHModal.activeTimers(), inert: [...document.body.children].some((k) => k.hasAttribute('inert')), chip: (document.querySelector('.rz-inspector-chip') || {}).textContent, disabled: window.RZDatahallAIFireWorkstation.summary().disabled, actions: [...document.querySelectorAll('.rz-inspector [data-rz-action]')].map((b) => b.getAttribute('data-rz-action')) }), target);
    note(!after.show && after.row === 'isolated' && after.disabled === 1 && after.chip === 'ISOLATED' && after.actions.includes('restore') && Object.keys(after.timers).length === 0 && !after.inert, `R2 after submit: ${JSON.stringify(after)}`);
    note(after.active === 'inspector', `R2 focus returned to the inspector action (${after.active})`);
    const logged = await tab.evaluate((id) => window.RZDatahallAIAlarmWorkspace.events().filter((e) => e.event === 'point-isolated' && e.tag === id).length, target);
    note(logged === 1, `R2 exactly one point-isolated record in the Alarms workspace (${logged})`);
    await tab.evaluate(() => { document.querySelector('#tabs [data-t="alarms"]').click(); const v = document.getElementById('alarmSavedView'); v.value = 'fire'; v.dispatchEvent(new Event('change', { bubbles: true })); }); await sleep(300);
    const alarmsText = await tab.evaluate(() => document.getElementById('alarmResultsBody').textContent);
    note(/point-isolated/.test(alarmsText) && /DH-01-Z12-SD1-01/.test(alarmsText), 'R2 the Alarms workspace (saved view Fire) lists the isolation');
    await activateTab(tab, set, entry('points'));

    /* R4 — impair Z12 (the strip already carries the page's standing criticals, e.g. UPS loading; only the deltas are ours) */
    await activateTab(tab, set, set.diagrams.find((d) => d.selector === '#coolSvg')); await sleep(4600);
    const st0 = await strip(tab, 'p-cool');
    await activateTab(tab, set, entry('points'));
    const impair = await tab.evaluate(() => {
        const W = window.RZDatahallAIFireWorkstation, inv = W.inventory(), out = [];
        const pts = inv.points.filter((p) => p.zoneIds.includes('DH-01-Z12') && (p.means === 'smoke_l1' || p.means === 'smoke_l2' || p.means === 'vesda'));
        for (const p of pts) { if (W.register().entries[p.id]) continue; const r = W.isolate({ pointId: p.id, owner: 'contractor', reason: 'ceiling works above the MDF room', expiryId: '2h', acknowledged: true }); out.push(p.id + ':' + (r.ok ? 'ok' : r.code)); }
        return out;
    });
    note(impair.every((x) => /:ok$/.test(x)), `R4 isolations accepted: ${impair.join(', ')}`);
    const sm4 = await summary(tab);
    note(sm4.impairedZones.join() === 'DH-01-Z12' && sm4.fireWatch && sm4.releaseInhibitedZones.join() === 'DH-01-Z12', `R4 summary impaired: ${JSON.stringify({ impaired: sm4.impairedZones, fw: sm4.fireWatch, disabled: sm4.disabled })}`);
    await activateTab(tab, set, entry('zones'));
    const tile = await tab.evaluate(() => { const t = document.querySelector('[data-rz-equipment="fire-zone:DH-01-Z12"]'); return { state: t.getAttribute('data-state'), text: t.textContent }; });
    note(tile.state === 'impaired' && /IMPAIRED/.test(tile.text) && /RELEASE INHIBITED/.test(tile.text), `R4 zone tile reads impaired (${JSON.stringify(tile)})`);
    await activateTab(tab, set, set.diagrams.find((d) => d.selector === '#coolSvg'));
    const banner = await tab.evaluate(() => { const b = document.getElementById('fireImpairmentBanner'); const r = b.getBoundingClientRect(); return { hidden: b.hidden, tone: b.getAttribute('data-tone'), text: b.textContent.replace(/\s+/g, ' '), visible: r.height > 0 }; });
    note(!banner.hidden && banner.visible && /FIRE WATCH/.test(banner.text) && /impaired/.test(banner.text) && banner.tone === 'warn', `R4 page-wide banner on the cooling tab: ${JSON.stringify(banner)}`);
    await sleep(4600);                                            /* the strip repaints every 4 s */
    const st = await strip(tab, 'p-cool');
    note(st && st.warn === (st0.warn || 0) + 1 && st.maint === sm4.disabled && st.crit === st0.crit, `R4 alarm strip on #p-cool warns and counts the register (${JSON.stringify(st0)} -> ${JSON.stringify(st)} vs disabled ${sm4.disabled})`);
    const sb = await tab.evaluate(() => ({ dis: document.getElementById('sbDisabled').textContent, maint: document.getElementById('sbMaint').textContent, fire: document.getElementById('sbFire').textContent, epo: document.getElementById('sbEpo').textContent }));
    note(Number(sb.dis) === sm4.disabled && /isolated/.test(sb.maint) && sb.fire === 'Normal' && sb.epo === 'Armed', `R4 sidebar: ${JSON.stringify(sb)}`);

    /* R5 — cause & effect blocked */
    await activateTab(tab, set, entry('cause-effect'));
    await tab.evaluate(() => { const s = document.getElementById('fireScenario'); s.value = 'suppression_release'; s.dispatchEvent(new Event('change', { bubbles: true })); const z = document.getElementById('fireZone'); z.value = 'DH-01-Z12'; z.dispatchEvent(new Event('change', { bubbles: true })); window.RZDatahallAIFireWorkstation.startRun('suppression_release', 'DH-01-Z12'); window.__rzSimTick = 4242 + 10; window.RZDatahallAIFireWorkstation.render(); });
    await sleep(200);
    const ce = await tab.evaluate(() => ({ statuses: [...document.querySelectorAll('#fireCauseEffectBody tr[aria-selected="true"] [data-fire-status]')].map((c) => c.textContent), summary: document.getElementById('fireCauseEffectSummary').textContent, elapsed: document.getElementById('fireElapsed').textContent }));
    note(ce.statuses.some((s) => /BLOCKED/.test(s)) && /blocked/.test(ce.summary), `R5 release row blocked while Z12 is impaired: ${JSON.stringify(ce)}`);
    await tab.evaluate(() => { window.RZDatahallAIFireWorkstation.stopRun(); window.__rzSimTick = 4242; window.RZDatahallAIFireWorkstation.render(); });

    /* R6 — restore all */
    const restored = await tab.evaluate(() => { const W = window.RZDatahallAIFireWorkstation; return Object.keys(W.register().entries).map((id) => W.restore({ pointId: id, owner: 'shift-b' }).ok); });
    note(restored.length >= 4 && restored.every(Boolean), `R6 restored ${restored.length} points`);
    const sm6 = await summary(tab);
    const banner6 = await tab.evaluate(() => document.getElementById('fireImpairmentBanner').hidden);
    await sleep(4600);
    const st6 = await strip(tab, 'p-fire');
    note(sm6.disabled === 0 && !sm6.fireWatch && banner6 && st6 && st6.warn === (st0.warn || 0) && st6.maint === 0 && st6.crit === st0.crit, `R6 banner hidden, strip clean after restore (${JSON.stringify({ sm: sm6.disabled, fw: sm6.fireWatch, banner6, st6 })})`);
    const zr = await tab.evaluate(() => window.RZDatahallAIAlarmWorkspace.events().some((e) => e.event === 'zone-restored'));
    note(zr, 'R6 a zone-restored record was logged');
    note(await tab.evaluate(() => window.__rzRandomCalls) === 0, `R10 Math.random calls during the workstation flow: ${await tab.evaluate(() => window.__rzRandomCalls)}`);

    /* R9 — ESC on the dialog */
    await activateTab(tab, set, entry('points'));
    await clickRef(tab, 'fire-point:DH-01-Z05-HD-01');
    await tab.click('.rz-inspector [data-rz-action="isolate"]'); await sleep(300);
    note(await tab.evaluate(() => document.getElementById('fireIsoDialog').classList.contains('show')), 'R9 dialog opened');
    await tab.keyboard.press('Escape'); await sleep(250);
    const esc = await tab.evaluate(() => ({ show: document.getElementById('fireIsoDialog').classList.contains('show'), timers: window.DHModal.activeTimers(), inert: [...document.body.children].some((k) => k.hasAttribute('inert')), inspectorOpen: document.querySelector('aside.rz-inspector').classList.contains('open') }));
    note(!esc.show && Object.keys(esc.timers).length === 0 && !esc.inert && esc.inspectorOpen, `R9 ESC closes the dialog cleanly: ${JSON.stringify(esc)}`);

    /* R12 — coverage walker over the workstation views with an isolation applied */
    await tab.evaluate(() => window.RZDatahallAIFireWorkstation.isolate({ pointId: 'DH-01-Z05-HD-01', owner: 'shift-a', reason: 'walker check with an isolation applied', expiryId: '2h' }));
    for (const view of ['points', 'zones', 'cause-effect']) {
        await activateTab(tab, set, entry(view));
        const w = await tab.evaluate((src, sel) => (new Function('return ' + src)())(document.querySelector(sel), { registryGlobal: 'RZ_DCAI_PARAMETERS', sampleLimit: 6, htmlOnly: true }), WALKER_SOURCE, entry(view).selector);
        note(w.untraced === 0 && w.mismatch === 0, `R12 ${view}: untraced ${w.untraced} mismatch ${w.mismatch} of ${w.numerals} (${JSON.stringify(w.samples)})`);
    }
    note(errors.length === 0, `page errors: ${errors.slice(0, 3).join(' | ')}`);
    await tab.close();

    /* R11 — persistence across reload + clear */
    const p1 = await newTab();
    await activateTab(p1.tab, set, entry('points'));
    await p1.tab.evaluate(() => window.RZDatahallAIFireWorkstation.isolate({ pointId: 'DH-02-Z03-SD2-01', owner: 'shift-a', reason: 'persistence check across reload', expiryId: '24h' }));
    await p1.tab.close();
    const p2 = await newTab({ keepRegister: true });
    const kept = await p2.tab.evaluate(() => ({ entries: Object.keys(window.RZDatahallAIFireWorkstation.register().entries), disabled: window.RZDatahallAIFireWorkstation.summary().disabled }));
    note(kept.entries.join() === 'DH-02-Z03-SD2-01' && kept.disabled === 1, `R11 register survived the reload (${JSON.stringify(kept)})`);
    await activateTab(p2.tab, set, entry('points'));
    await p2.tab.click('#firePointsClear'); await sleep(100); await p2.tab.click('#firePointsClear'); await sleep(300);
    const cleared = await p2.tab.evaluate(() => ({ entries: Object.keys(window.RZDatahallAIFireWorkstation.register().entries).length, rec: window.RZDatahallAIAlarmWorkspace.events().some((e) => e.event === 'register-cleared'), stored: localStorage.getItem('dhFireIsolationRegister') }));
    note(cleared.entries === 0 && cleared.rec && /"entries":\{\}/.test(cleared.stored || '{"entries":{}}'), `R11 clear register: ${JSON.stringify(cleared)}`);
    await p2.tab.close();

    /* R7 — determinism across reloads */
    const texts = [];
    for (let i = 0; i < 3; i++) {
        const t = await newTab();
        await activateTab(t.tab, set, entry('points'));
        texts.push(await t.tab.evaluate(() => document.getElementById('firePointsBody').textContent + '|' + document.getElementById('fireSummary').textContent));
        await t.tab.close();
    }
    note(texts[0] === texts[1] && texts[1] === texts[2], 'R7 point list + summary identical across 3 reloads at the pinned tick');

    /* R8 — staged run advances with the tick */
    const r8 = await newTab();
    await activateTab(r8.tab, set, entry('cause-effect'));
    const run = await r8.tab.evaluate(() => {
        const W = window.RZDatahallAIFireWorkstation;
        document.getElementById('fireScenario').value = 'suppression_release'; document.getElementById('fireZone').value = 'DH-01-Z05';
        document.getElementById('fireStart').click();
        const t0 = { elapsed: document.getElementById('fireElapsed').textContent, pending: [...document.querySelectorAll('#fireCauseEffectBody tr[aria-selected="true"] [data-fire-status]')].map((c) => c.textContent) };
        window.__rzSimTick = 4242 + 15; W.render();
        const t1 = { elapsed: document.getElementById('fireElapsed').textContent, due: [...document.querySelectorAll('#fireCauseEffectBody tr[aria-selected="true"] [data-fire-status]')].map((c) => c.textContent), stage: W.summary().stage, fire: W.summary().fire };
        document.getElementById('fireStop').click(); window.__rzSimTick = 4242;
        return { t0, t1 };
    });
    note(/T\+0 s/.test(run.t0.elapsed) && run.t0.pending.every((s) => /PENDING/.test(s)) && /T\+60 s/.test(run.t1.elapsed) && run.t1.due.every((s) => s === 'DUE') && run.t1.stage === 'discharged', `R8 staged run: ${JSON.stringify(run)}`);
    note(r8.errors.length === 0, `R8 page errors: ${r8.errors.slice(0, 3).join(' | ')}`);
    await r8.tab.close();
} finally { await browser.close(); server.close(); }

console.log(`DCAI FIRE WORKSTATION — ${PAGE}`);
if (failures.length) { console.error('\nFAIL\n  ' + failures.join('\n  ')); process.exit(1); }
console.log('PASS — point list home, scoped sub-tabs, isolation with consequence, two-means impairment, page-wide banner, strip + sidebar parity, C&E block, staged run, persistence, determinism, walker clean');
