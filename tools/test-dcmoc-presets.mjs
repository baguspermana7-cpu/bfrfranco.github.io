/* test-dcmoc-presets.mjs — v3.25.0 presentation presets + selection process gate.
 *
 * Serves the repo root, opens /dcmoc/ in a FRESH browser profile (only the probe
 * auth + tour flags in localStorage) and asserts, from the persisted stores and
 * the rendered DOM, that:
 *   L1 the 5 demo_* projects and 5 demo_sc_* scenarios exist, 4 starred for comparison,
 *      console errors = 0, and the LIVE configuration is untouched by seeding
 *      (simulation itLoad stays at the 2,500 kW default);
 *   L3 every seeded scenario carries engine KPIs: OPEX/mo > 0, staff > 0, CAPEX > 0, PUE 1.0–2.0;
 *   L2 opening each preset makes the Results "Requirements" dimension read 100
 *      (intake completeness — useCase + deadline now sent) and the body shows no
 *      budget/redundancy rule warning;
 *   L4 Site page of SBY-DR-5 shows the Jakarta candidate SCREENED OUT (flood: extreme) while the
 *      recommended site is a PASS, and switching the criteria profile changes a Total Score;
 *   L5 Adopt writes siteStatus 'shortlisted' into the persisted requirements store.
 * Screenshots (dark + one light) land in ~/.cache/rz-scan/dcmoc325/ for the contact sheet.
 * Run: node tools/test-dcmoc-presets.mjs  (one browser — run under the kereta-browser flock). */
import puppeteer from 'puppeteer';
import http from 'http';
import { createReadStream, statSync, mkdirSync } from 'fs';
import { join, extname } from 'path';
import { homedir } from 'os';

const ROOT = new URL('..', import.meta.url).pathname;
const PORT = 8101;
const SHOTS = join(homedir(), '.cache/rz-scan/dcmoc325');
mkdirSync(SHOTS, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.txt': 'text/plain' };
const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const file = join(ROOT, p);
    try { statSync(file); res.setHeader('Content-Type', MIME[extname(file)] ?? 'application/octet-stream'); createReadStream(file).pipe(res); }
    catch { res.statusCode = 404; res.end('nf'); }
});
await new Promise((r) => server.listen(PORT, r));

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 950 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
page.on('pageerror', (e) => errors.push('PAGE: ' + String(e).slice(0, 200)));
await page.evaluateOnNewDocument(() => {
    localStorage.setItem('dcmoc.tour.v1', 'seen');
    localStorage.setItem('dcmoc-auth', JSON.stringify({ state: { user: { email: 'b@r.com', role: 'root' } }, version: 0 }));
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => { if (cond) { pass++; console.log('  ✔', name); } else { fail++; console.log('  ✘', name, detail); } };
const ls = (k) => page.evaluate((key) => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } }, k);
const bodyText = () => page.evaluate(() => document.body.innerText);
async function nav(group, leaf) {
    if (group && leaf) {
        await page.evaluate((g) => { const b = [...document.querySelectorAll('aside button')].find((x) => x.textContent.trim().toLowerCase().startsWith(g.toLowerCase()) || x.textContent.toLowerCase().includes(g.toLowerCase())); if (b) b.click(); }, group);
        await sleep(350);
    }
    const target = leaf ?? group;
    const clicked = await page.evaluate((l) => {
        const btns = [...document.querySelectorAll('aside button')];
        const exacts = btns.filter((x) => x.textContent.trim() === l);
        /* a group header and its leaf can share a label (Financial): the leaf is the LAST exact match in DOM order */
        const cands = exacts.length ? [exacts[exacts.length - 1]] : btns.filter((x) => x.textContent.toLowerCase().includes(l.toLowerCase()));
        cands.sort((a, b) => a.textContent.length - b.textContent.length);
        if (cands[0]) { cands[0].click(); return cands[0].textContent.trim().slice(0, 40); }
        return null;
    }, target);
    await sleep(1200);
    return clicked;
}
const shot = (name) => page.screenshot({ path: join(SHOTS, name), fullPage: false });

await page.goto(`http://localhost:${PORT}/dcmoc/`, { waitUntil: 'networkidle2', timeout: 60000 });
await sleep(3500);

console.log('— L1 seeding —');
const projects = await ls('dcmoc_projects_v1');
const demo = (projects?.projects ?? []).filter((p) => p.id.startsWith('demo_'));
ok('5 presentation projects seeded', demo.length === 5, `got ${demo.length}`);
ok('seed marker written', (await page.evaluate(() => localStorage.getItem('dcmoc_demo_seed'))) === '1');
const scen = await ls('dcmoc_scenarios');
const demoSc = (scen?.scenarios ?? []).filter((s) => s.id.startsWith('demo_sc_'));
ok('5 presentation scenarios seeded', demoSc.length === 5, `got ${demoSc.length}`);
ok('4 scenarios starred for comparison (persisted)', (scen?.comparisonIds ?? []).length === 4, JSON.stringify(scen?.comparisonIds));
const sim = await ls('dcmoc-simulation');
ok('live configuration untouched after seeding (itLoad 2500)', sim?.state?.inputs?.itLoad === 2500, `itLoad=${sim?.state?.inputs?.itLoad}`);
demo.forEach((p) => {
    const s = p.snapshot;
    ok(`${p.id}: country/budget/sites coherent`, s.capexInputs?.location === p.countryId && (s.requirements?.business?.budgetUsd ?? 0) > 0 && (s.sites?.sites?.length ?? 0) >= 2 && !!s.requirements?.overview?.projectName,
        `loc=${s.capexInputs?.location} budget=${s.requirements?.business?.budgetUsd} sites=${s.sites?.sites?.length}`);
});
console.log('— L3 scenario KPIs —');
demoSc.forEach((s) => {
    const k = s.summary ?? {};
    ok(`${s.id}: OPEX/mo ${k.monthlyOpex} · staff ${k.totalStaff} · CAPEX ${k.annualCapex} · PUE ${k.pue}`, k.monthlyOpex > 0 && k.totalStaff > 0 && k.annualCapex > 0 && k.pue >= 1 && k.pue <= 2);
});

console.log('— L2 open each preset → Results completeness —');
await nav('Projects');
await shot('01-projects-dark.png');
for (let i = 0; i < demo.length; i++) {
    const name = demo[i].name;
    const opened = await page.evaluate((n) => {
        const card = [...document.querySelectorAll('span')].find((s) => s.textContent.trim() === n)?.closest('div.rounded, div[class*="rounded"]');
        const btn = card ? [...card.querySelectorAll('button')].find((b) => b.textContent.startsWith('Open')) : null;
        if (btn) { btn.click(); return true; } return false;
    }, name);
    ok(`open ${name.split(' · ')[0]}`, opened);
    await sleep(800);
    // the Open click re-mounts the shell; a nav click that lands during the re-mount is lost (SG-COLO-20 and
    // CYB-HPC-15 stayed on Projects, 2026-11-07). Navigate, wait for a dimension row, retry up to three times.
    for (let attempt = 0; attempt < 3; attempt++) {
        await nav('AI Decision Engine', 'Results Engine');
        const landed = await page.waitForFunction(() => [...document.querySelectorAll('span')].some((s) => s.textContent.trim() === 'Requirements' && s.className.includes('truncate') && /(\d+)\s*$/.test(s.parentElement?.innerText ?? '')), { timeout: 4000, polling: 150 }).then(() => true).catch(() => false);
        if (landed) break;
        await sleep(700);
    }
    // the FIRST 'Requirements' span in document order is the sidebar nav item ("1 Requirements"),
    // so pick the dimension row: the one whose parent text ends in the score. The row renders a tick
    // or two after the tab paints, so poll up to 6 s instead of sampling once (null on 2 of 11 presets before).
    const readReq = () => {
        const rows = [...document.querySelectorAll('span')].filter((s) => s.textContent.trim() === 'Requirements' && s.className.includes('truncate')).map((s) => s.parentElement?.innerText ?? '');
        const m = rows.map((t) => t.match(/(\d+)\s*$/)).find(Boolean); return m ? +m[1] : null;
    };
    await page.waitForFunction(readReq, { timeout: 6000, polling: 150 }).catch(() => {});
    const reqScore = await page.evaluate(readReq);
    if (reqScore === null) console.log('    · Results body:', JSON.stringify((await bodyText()).replace(/\s+/g, ' ').slice(0, 900)));
    if (reqScore === null) console.log('    · Requirements rows seen:', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('span')].filter((s) => /Requirements/.test(s.textContent)).map((s) => (s.className || '').slice(0, 40) + ' | ' + (s.parentElement?.innerText ?? '').replace(/\s+/g, ' ').slice(0, 80)))).slice(0, 600));
    ok(`  Requirements dimension = 100 (got ${reqScore})`, reqScore === 100);
    const txt = (await bodyText()).toLowerCase();
    ok('  no budget / redundancy rule warning on Results', !/over budget|exceeds (the )?budget|redundancy .* (below|insufficient|mismatch)/.test(txt));
    if (i === 0) await shot('02-results-jkt-ai-40-dark.png');
    await nav('Projects');
}

console.log('— L4/L5 selection process on SBY-DR-5 —');
{
    const name = demo.find((p) => p.id === 'demo_sby-dr-5')?.name;
    await page.evaluate((n) => {
        const card = [...document.querySelectorAll('span')].find((s) => s.textContent.trim() === n)?.closest('div[class*="rounded"]');
        const btn = card ? [...card.querySelectorAll('button')].find((b) => b.textContent.startsWith('Open')) : null; if (btn) btn.click();
    }, name);
    await sleep(800);
    await nav('Site Intelligence', 'Site Intelligence');
    await sleep(1000);
    let txt = await bodyText();
    ok('gate matrix rendered', /Screening — gate matrix/i.test(txt));
    ok('Jakarta candidate SCREENED OUT (flood: extreme)', /SCREENED OUT/.test(txt));
    ok('a candidate passes screening', /\bPASS\b/.test(txt));
    ok('decision names a recommended site', /Recommended\s*Site [A-E]/i.test(txt));
    const scoreBefore = await page.evaluate(() => { const m = document.body.innerText.match(/Total Score \(engine\)[\s\S]{0,120}?(\d+(?:\.\d+)?)/); return m ? +m[1] : null; });
    await page.select('select', 'ai_training');
    await sleep(700);
    const scoreAfter = await page.evaluate(() => { const m = document.body.innerText.match(/Total Score \(engine\)[\s\S]{0,120}?(\d+(?:\.\d+)?)/); return m ? +m[1] : null; });
    ok(`criteria profile changes the engine score (${scoreBefore} → ${scoreAfter})`, scoreBefore != null && scoreAfter != null && scoreBefore !== scoreAfter);
    await page.select('select', 'enterprise_dr');
    await sleep(500);
    await shot('03-site-process-sby-dr-5-dark.png');
    const adopted = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /^Adopt Site/.test(x.textContent.trim())); if (b) { b.click(); return true; } return false; });
    ok('Adopt button present and clicked', adopted);
    await sleep(700);
    txt = await bodyText();
    ok('decision shows Adopted', /Adopted into the project/.test(txt));
    const req = await ls('dcmoc-requirements');
    ok(`requirements siteStatus = shortlisted, city set (${req?.state?.overview?.siteStatus} / ${req?.state?.overview?.cityRegion})`, req?.state?.overview?.siteStatus === 'shortlisted' && !!req?.state?.overview?.cityRegion);
    await page.evaluate(() => document.getElementById('sec-decision')?.scrollIntoView());
    await sleep(400);
    await shot('04-site-decision-adopted-dark.png');
    // light theme of the same page
    await page.evaluate(() => { localStorage.setItem('dcmoc-theme', 'light'); });
    await page.reload({ waitUntil: 'networkidle2' });
    await sleep(2500);
    await shot('05-site-process-light.png');
    await page.evaluate(() => { localStorage.setItem('dcmoc-theme', 'dark'); });
    await page.reload({ waitUntil: 'networkidle2' });
    await sleep(2500);
}

console.log('— L6 tariff model: business model → MRC/NRC defaults (v3.25.0) —');
{
    const openPreset = async (prefix) => {
        await nav('Projects'); await sleep(500);
        const name = demo.find((d) => d.name.startsWith(prefix))?.name;
        const opened = await page.evaluate((n) => {
            const card = [...document.querySelectorAll('span')].find((s) => s.textContent.trim() === n)?.closest('div.rounded, div[class*="rounded"]');
            const btn = card ? [...card.querySelectorAll('button')].find((b) => b.textContent.startsWith('Open')) : null;
            if (btn) { btn.click(); return true; } return false;
        }, name);
        ok(`open ${prefix}`, opened); await sleep(900);
    };
    const engineResolve = (o) => page.evaluate((args) => { const r = window.RZEngine?.models?.tariffs?.resolve(args); return r ? { mrc: r.mrcPerKwMonth, nrc: r.nrcPerKw, gpus: r.gaas?.gpus ?? null, hw: r.gaas?.hardwareCapexUsd ?? null } : null; }, o);
    // GaaS preset (JKT-AI-40, 40 MW, H200 reserved 70 %)
    await openPreset('JKT-AI-40');
    let req = await ls('dcmoc-requirements'); let sim = await ls('dcmoc-simulation');
    ok(`JKT-AI-40 persisted revenueModel = gaas (${req?.state?.business?.revenueModel})`, req?.state?.business?.revenueModel === 'gaas');
    const exp = await engineResolve({ model: 'gaas', itLoadKw: sim?.state?.inputs?.itLoad, countryId: 'ID', sku: 'h200', pricingMode: 'reserved', utilization: 0.7 });
    ok(`sim revenue basis = engine GaaS kW-equivalent (${sim?.state?.inputs?.revenuePerKwMonth} vs ${exp && Math.round(exp.mrc)})`, exp && sim?.state?.inputs?.revenuePerKwMonth === Math.round(exp.mrc) && exp.mrc > 500);
    ok(`sim itHardwareCapexUsd = GPU fleet (${sim?.state?.inputs?.itHardwareCapexUsd} vs ${exp && Math.round(exp.hw)})`, exp && sim?.state?.inputs?.itHardwareCapexUsd === Math.round(exp.hw) && exp.hw > 1e8);
    await nav('Requirements', 'Requirements & Workload'); await sleep(700);
    await page.evaluate(() => document.getElementById('sec-business')?.scrollIntoView());
    await sleep(500);
    let txt = await page.evaluate(() => document.querySelector('[data-testid="req-revenue-model"]')?.innerText ?? '');
    ok('Requirements 1.5 shows the GaaS fleet + hardware CAPEX line', /GPU-as-a-Service/.test(txt) && /hardware CAPEX/.test(txt) && /GPUs/.test(txt));
    await shot('08-requirements-business-gaas-dark.png');
    await nav('Financial', 'Financial'); await sleep(1200);
    // the business-model block lives on the Financial page's "Pro Forma (Full)" sub-tab
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Pro Forma (Full)'); if (b) b.click(); });
    await sleep(900);
    const finSel = await page.evaluate(() => document.querySelector('[data-testid="fin-business-model"] select')?.value ?? null);
    ok(`Financial business-model select = gaas (${finSel})`, finSel === 'gaas');
    txt = await page.evaluate(() => document.querySelector('[data-testid="fin-tariff-basis"]')?.innerText ?? '');
    ok('Financial tariff basis names price, utilisation and the fleet', /GPU-hr/.test(txt) && /utilisation/.test(txt) && /Fleet/.test(txt));
    const mrcField = await page.evaluate(() => { const lab = [...document.querySelectorAll('label')].find((l) => /^MRC\b/.test(l.textContent.trim())); const box = lab?.parentElement; return box ? box.innerText.replace(/\s+/g, ' ') : ''; });
    ok(`Financial MRC AUTO field carries the GaaS value (${mrcField.slice(0, 60)})`, exp && new RegExp(String(Math.round(exp.mrc)).replace(/\B(?=(\d{3})+(?!\d))/g, ',?')).test(mrcField));
    await shot('09-financial-gaas-dark.png');
    // switch the model in Financial → MRC follows the engine
    await page.select('[data-testid="fin-business-model"] select', 'retail_colo'); await sleep(900);
    req = await ls('dcmoc-requirements'); sim = await ls('dcmoc-simulation');
    const expRetail = await engineResolve({ model: 'retail_colo', itLoadKw: sim?.state?.inputs?.itLoad, countryId: 'ID' });
    ok(`switch to retail_colo persists + sim revenue follows (${sim?.state?.inputs?.revenuePerKwMonth} vs ${expRetail && Math.round(expRetail.mrc)})`, req?.state?.business?.revenueModel === 'retail_colo' && expRetail && sim?.state?.inputs?.revenuePerKwMonth === Math.round(expRetail.mrc));
    ok('hardware capex cleared when leaving GaaS', (sim?.state?.inputs?.itHardwareCapexUsd ?? 0) === 0);
    await page.select('[data-testid="fin-business-model"] select', 'gaas'); await sleep(600);
    // Hyperscale preset (BTM-HYPER-100): block-size curve 10 MW+ on the Indonesia index
    await openPreset('BTM-HYPER-100');
    req = await ls('dcmoc-requirements'); sim = await ls('dcmoc-simulation');
    // the app resolves the tariff on the CAPEX market (Batam index), not the country default — same as tariffFromStores()
    const capexH = await ls('dcmoc-capex'); const mkH = String(capexH?.state?.inputs?.cityMarket ?? 'none').replace(/_/g, '-');
    const expH = await engineResolve({ model: 'hyperscale_lease', itLoadKw: sim?.state?.inputs?.itLoad, countryId: 'ID', marketKey: mkH !== 'none' ? mkH : undefined });
    ok(`BTM-HYPER-100: hyperscale_lease, sim revenue = ${mkH} index × 10 MW+ factor (${sim?.state?.inputs?.revenuePerKwMonth} vs ${expH && Math.round(expH.mrc)})`, req?.state?.business?.revenueModel === 'hyperscale_lease' && expH && sim?.state?.inputs?.revenuePerKwMonth === Math.round(expH.mrc));
    await nav('AI Decision Engine', 'Results Engine'); await sleep(900);
    txt = (await bodyText());
    ok('Results page renders for the hyperscale preset (no $280 legacy basis text)', !/\$280\/kW/.test(txt));
}

console.log('— Scenarios + comparison —');
await nav('Scenarios');
await sleep(600);
let t = await bodyText();
ok('scenarios table shows non-zero OPEX for presets', !/\$0\b/.test(t.split('OPEX')[1]?.slice(0, 400) ?? ''));
await shot('06-scenarios-dark.png');
await nav('Scenario Comparison');
await sleep(900);
t = await bodyText();
ok('comparison page compares the 4 starred presets', /JKT-AI-40/.test(t) && /SG-COLO-20/.test(t) && /SBY-DR-5/.test(t) && /CYB-HPC-15/.test(t));
await shot('07-scenario-comparison-dark.png');

ok(`console errors = 0 (${errors.length})`, errors.length === 0, errors.slice(0, 3).join(' | '));
console.log(`\nDCMOC PRESETS GATE — ${pass} passed, ${fail} failed`);
await browser.close(); server.close();
process.exit(fail ? 1 : 0);
