/**
 * probe-finance-terminal.mjs — end-to-end tab verification harness (Task 1.10)
 *
 * Drives Apps/finance-terminal/index.html with the V2 gateway flag ON
 * (localStorage.rz_ft_v2='1' + localStorage.rz_ft_gw=<worker>) and asserts
 * that every tab populates within ~9s with ZERO JS pageerrors.
 *
 * Robustness contract:
 *   - A tab that legitimately surfaces a SOURCED "unavailable / retry"
 *     affordance (upstream network-blocked from this IP, e.g. datacenter-IP
 *     429s from Yahoo) counts as PASS — the client degraded gracefully.
 *   - A true JS `pageerror`, an infinite spinner ("Loading…" that never
 *     resolves), or a permanently-empty container = genuine FAIL.
 *
 * Config (env or positional args, args win):
 *   BASE  default http://127.0.0.1:8099   (static server for the worktree)
 *   GW    default http://127.0.0.1:8787   (wrangler dev worker)
 *   PAGE  default /Apps/finance-terminal/index.html
 *
 *   node tools/probe-finance-terminal.mjs [BASE] [GW] [PAGE]
 *
 * Exit code: 0 only if every tab PASSes AND pageerrors == 0; else 1.
 *
 * Runs from the repo root so `import puppeteer` resolves node_modules
 * (same pattern as tools/probe-all-pageerrors.mjs).
 */
import puppeteer from 'puppeteer';

const argv = process.argv.slice(2);
const BASE = (argv[0] || process.env.BASE || 'http://127.0.0.1:8099').replace(/\/$/, '');
const GW   = (argv[1] || process.env.GW   || 'http://127.0.0.1:8787').replace(/\/$/, '');
const PAGE = argv[2] || process.env.PAGE  || '/Apps/finance-terminal/index.html';

const TAB_TIMEOUT = 9000; // per-tab readiness budget (task: <9s)
const POLL = 250;

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

const page = await browser.newPage();
const pageErrors = [];
const consoleErrors = [];

page.on('pageerror', (e) => { pageErrors.push(String(e && e.stack ? e.stack : e)); });
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});

/**
 * waitNonEmpty — poll an in-page predicate until truthy or timeout.
 * `fn` runs in the browser; returns true when the readiness condition
 * holds. Resolves { ok, ms }.
 */
async function waitNonEmpty(fn, ms = TAB_TIMEOUT, arg = null) {
  const start = Date.now();
  for (;;) {
    let ok = false;
    try { ok = await page.evaluate(fn, arg); } catch { ok = false; }
    if (ok) return { ok: true, ms: Date.now() - start };
    if (Date.now() - start >= ms) return { ok: false, ms: Date.now() - start };
    await new Promise((r) => setTimeout(r, POLL));
  }
}

function txt(el) { return (el && el.textContent ? el.textContent : '').trim(); }

/* ── readiness predicates (run in page context) ──────────────────────
   Each returns true ONLY when the tab has real content. They explicitly
   reject skeletons / spinners / "Loading…" so an infinite spinner fails.
   They accept a sourced "unavailable / Retry" affordance as a terminal
   (non-spinner) state so network-blocked upstreams degrade to PASS. */

const PREDICATES = {
  // Ticker strip shows a numeric price OR the index KPI grid has cards.
  overview() {
    const tape = document.getElementById('tickerTape');
    const tapeTxt = tape ? tape.textContent : '';
    const tapeHasNum = /[0-9]/.test(tapeTxt) &&
      !/Loading market data/i.test(tapeTxt) &&
      !!tape && !!tape.querySelector('.tape-price');
    const kpis = document.getElementById('overviewKpis');
    const kpiCards = kpis ? kpis.querySelectorAll('.kpi').length : 0;
    const worldKpis = document.getElementById('worldKpis');
    const worldCards = worldKpis ? worldKpis.querySelectorAll('.kpi').length : 0;
    // Sourced degradation: indices unavailable retry affordance present.
    const degraded = kpis && /unavailable/i.test(kpis.textContent) &&
      !!kpis.querySelector('a,button');
    return tapeHasNum || kpiCards > 0 || worldCards > 0 || !!degraded;
  },

  // #fxPairsGrid has .fx-card children AND no "Error loading forex data".
  forex() {
    const g = document.getElementById('fxPairsGrid');
    if (!g) return false;
    const t = g.textContent || '';
    if (/Error loading forex data/i.test(t)) return false;
    return g.querySelectorAll('.fx-card').length > 0;
  },

  // Crypto table has DATA rows (not skel/empty) AND Market Dominance
  // container non-empty — OR a sourced unavailable/retry affordance.
  crypto() {
    const tbl = document.getElementById('cryptoTable');
    const tb = tbl ? tbl.querySelector('tbody') : null;
    if (!tb) return false;
    const rows = tb.querySelectorAll('tr');
    const hasSkel = !!tb.querySelector('.skel');
    const bodyTxt = tb.textContent || '';
    const degraded = /Unavailable/i.test(bodyTxt) && !!tb.querySelector('a,button');
    if (degraded) return true; // sourced graceful degradation
    if (hasSkel || rows.length === 0) return false;
    if (/No crypto data/i.test(bodyTxt)) return false;
    const dataRows = [...rows].filter((r) => !r.querySelector('.skel') && !r.querySelector('.empty'));
    if (dataRows.length === 0) return false;
    // Market Dominance: either the bar card (#domCard) or the original
    // dominance canvas's card must be non-empty.
    const domCard = document.getElementById('domCard');
    const domCanvas = document.getElementById('dominanceChart');
    const domHostCard = domCanvas ? domCanvas.closest('.card') : null;
    const domEl = domCard || domHostCard;
    const domOk = !!domEl && (domEl.offsetParent === null ? true : (domEl.textContent || '').replace(/\s/g, '').length > 'MarketDominance'.length || domEl.querySelector('canvas'));
    return dataRows.length > 0 && !!domOk;
  },

  // Chart container rendered (lightweight-charts div OR legacy canvas)
  // AND the commodities table has populated rows.
  commodities() {
    const lwc = document.getElementById('cmdChart-lwc');
    const lwcRendered = !!lwc && lwc.style.display !== 'none' &&
      !/Loading\.\.\./i.test(lwc.textContent || '') &&
      (lwc.querySelector('canvas') || lwc.querySelector('table') || lwc.children.length > 0);
    const lwcDegraded = !!lwc && /unavailable/i.test(lwc.textContent || '') && !!lwc.querySelector('button,a');
    const cv = document.getElementById('cmdChart');
    const cvVisible = !!cv && cv.style.display !== 'none' && cv.offsetParent !== null;
    const chartOk = lwcRendered || lwcDegraded || cvVisible;
    const tbl = document.getElementById('cmdTable');
    const tb = tbl ? tbl.querySelector('tbody') : null;
    if (!tb) return false;
    const t = tb.textContent || '';
    const tableDegraded = /API key|unavailable/i.test(t) && tb.querySelectorAll('tr').length === 0;
    const rows = [...tb.querySelectorAll('tr')].filter((r) => !r.querySelector('.skel'));
    const tableOk = rows.length > 0 || tableDegraded;
    return chartOk && tableOk;
  },

  // After clicking a preset: it has .active AND results table has rows
  // (or a sourced unavailable/no-match affordance — not a skeleton).
  screener() {
    const bar = document.getElementById('presetBar');
    const active = bar ? bar.querySelector('.btn.active') : null;
    const tbl = document.getElementById('screenerTable');
    const tb = tbl ? tbl.querySelector('tbody') : null;
    if (!active || !tb) return false;
    if (tb.querySelector('.skel')) return false; // still loading
    const dataRows = [...tb.querySelectorAll('tr')].filter((r) => !r.querySelector('.skel'));
    if (dataRows.length === 0) return false;
    // Real result rows OR a terminal "No matches"/"unavailable" affordance.
    const bodyTxt = tb.textContent || '';
    const terminal = /No matches|unavailable/i.test(bodyTxt);
    const realRows = dataRows.some((r) => !r.querySelector('.empty'));
    return realRows || terminal;
  },

  // News resolves to items OR an explicit Retry affordance — never a
  // permanent "Loading news..." spinner.
  news() {
    const el = document.getElementById('newsFeed');
    if (!el) return false;
    const t = el.textContent || '';
    if (el.querySelector('.spinner') || /Loading news/i.test(t)) return false; // spinner
    if (el.querySelector('.news-title')) return true; // real items
    // Sourced unavailable + explicit Retry button = graceful degradation.
    if (/unavailable/i.test(t) && el.querySelector('button,a')) return true;
    return false;
  },

  sectors() {
    const tbl = document.getElementById('sectorTable');
    const tb = tbl ? tbl.querySelector('tbody') : null;
    if (!tb) return false;
    if (tb.querySelector('.skel')) return false;
    const rows = [...tb.querySelectorAll('tr')].filter((r) => !r.querySelector('.skel'));
    if (rows.length === 0) return false;
    const bodyTxt = tb.textContent || '';
    const degraded = /Unavailable/i.test(bodyTxt) && !!tb.querySelector('a,button');
    const realRows = rows.some((r) => !r.querySelector('.empty'));
    return realRows || degraded;
  },

  economy() {
    const yt = document.getElementById('yieldTable');
    const ytb = yt ? yt.querySelector('tbody') : null;
    if (!ytb) return false;
    if (ytb.querySelector('.skel')) return false;
    const rows = [...ytb.querySelectorAll('tr')].filter((r) => !r.querySelector('.skel'));
    if (rows.length === 0) return false;
    const bodyTxt = ytb.textContent || '';
    const degraded = /Unavailable/i.test(bodyTxt) && !!ytb.querySelector('a,button');
    const realRows = rows.some((r) => !r.querySelector('.empty'));
    return realRows || degraded;
  },

  futures() {
    const tbl = document.getElementById('futuresTable');
    const tb = tbl ? tbl.querySelector('tbody') : null;
    if (!tb) return false;
    if (tb.querySelector('.skel')) return false;
    const rows = [...tb.querySelectorAll('tr')].filter((r) => !r.querySelector('.skel'));
    if (rows.length === 0) return false;
    const bodyTxt = tb.textContent || '';
    const degraded = /Unavailable/i.test(bodyTxt) && !!tb.querySelector('a,button');
    const realRows = rows.some((r) => !r.querySelector('.empty'));
    return realRows || degraded;
  },
};

/** clickTab — invoke the app's switchTab(); fall back to clicking the
 *  visible tab button if the function is unavailable. */
async function clickTab(tab) {
  await page.evaluate((t) => {
    if (typeof window.switchTab === 'function') { window.switchTab(t); return; }
    const b = document.querySelector(`.tab[data-tab="${t}"]`);
    if (b) b.click();
  }, tab);
}

const results = [];
function record(tab, ok, reason) {
  results.push({ tab, ok, reason });
  console.log(ok ? `PASS ${tab}` : `FAIL ${tab}: ${reason}`);
}

let navOk = false;
try {
  // 1) initial load (no flags yet) so localStorage is same-origin writable
  await page.goto(BASE + PAGE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.evaluate((gw) => {
    localStorage.setItem('rz_ft_v2', '1');
    localStorage.setItem('rz_ft_gw', gw);
  }, GW);
  // 2) reload with flags active; let network settle
  await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
  navOk = true;
} catch (e) {
  console.log(`FAIL navigation: ${String(e)}`);
}

if (navOk) {
  // Confirm flags actually took (guards against a same-origin/localStorage
  // mishap silently leaving V2 off and every tab "passing" on legacy data).
  const flags = await page.evaluate(() => ({
    v2: typeof CFG !== 'undefined' ? CFG.V2 : null,
    gw: typeof CFG !== 'undefined' ? CFG.GW : null,
  }));
  console.log(`flags: V2=${flags.v2} GW=${flags.gw}`);
  if (flags.v2 !== true) {
    record('flags', false, `CFG.V2 not enabled (got ${flags.v2}) — probe would not exercise the gateway`);
  }

  const TABS = [
    'overview', 'forex', 'crypto', 'commodities',
    'screener', 'news', 'sectors', 'economy', 'futures',
  ];

  for (const tab of TABS) {
    try {
      await clickTab(tab);

      if (tab === 'screener') {
        // Wait for preset bar to render, then click "High Dividend".
        const barReady = await waitNonEmpty(
          () => {
            const b = document.getElementById('presetBar');
            return !!b && b.querySelectorAll('.btn').length > 0;
          }, 9000);
        if (!barReady.ok) { record(tab, false, 'preset bar never rendered'); continue; }
        const clicked = await page.evaluate(() => {
          const btns = [...document.querySelectorAll('#presetBar .btn')];
          const hd = btns.find((b) => /High Dividend/i.test(b.textContent)) || btns[0];
          if (!hd) return false;
          hd.click();
          return true;
        });
        if (!clicked) { record(tab, false, 'no preset button to click'); continue; }
      }

      const r = await waitNonEmpty(PREDICATES[tab], TAB_TIMEOUT);
      if (r.ok) {
        record(tab, true, '');
      } else {
        // Capture a short diagnostic of what the container actually held.
        const diag = await page.evaluate((t) => {
          const map = {
            overview: 'tickerTape', forex: 'fxPairsGrid', crypto: 'cryptoTable',
            commodities: 'cmdTable', screener: 'screenerTable', news: 'newsFeed',
            sectors: 'sectorTable', economy: 'yieldTable', futures: 'futuresTable',
          };
          const el = document.getElementById(map[t]);
          return el ? (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 140) : '(container missing)';
        }, tab);
        record(tab, false, `not ready in ${r.ms}ms — container="${diag}"`);
      }
    } catch (e) {
      record(tab, false, `exception: ${String(e)}`);
    }
  }
}

console.log(`pageerrors=${pageErrors.length}`);
for (const pe of pageErrors) console.log('  PAGEERROR ' + pe.replace(/\s+/g, ' ').slice(0, 300));
if (consoleErrors.length) {
  console.log(`console.error=${consoleErrors.length}`);
  for (const ce of consoleErrors.slice(0, 12)) console.log('  CONSOLE.ERROR ' + ce.replace(/\s+/g, ' ').slice(0, 200));
}

await browser.close();

const allPass = navOk && results.length > 0 && results.every((r) => r.ok);
const green = allPass && pageErrors.length === 0;
console.log(green ? 'RESULT: GREEN' : 'RESULT: RED');
process.exit(green ? 0 : 1);
