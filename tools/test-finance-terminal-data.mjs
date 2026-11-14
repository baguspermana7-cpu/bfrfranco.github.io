#!/usr/bin/env node
/**
 * test-finance-terminal-data.mjs — Apps/finance-terminal reads market data ONLY through the first-party
 * gateway (plus one declared, official, keyless fallback for crypto prices), and never shows a fake zero.
 *
 * The page is served from this checkout on a free port; every gateway and third-party URL is intercepted
 * with recorded fixture responses, so the run is deterministic and offline (CDN libraries pass through).
 *
 * Laws:
 *   D1  no request to a public CORS proxy (corsproxy.io / allorigins / codetabs) on any tab, in any
 *       scenario; and no direct browser read of a market host the gateway fronts (CoinGecko, Yahoo,
 *       Frankfurter, Finnhub without a user key).
 *   D2  gateway /crypto answers 429 (and the Binance fallback is down): the crypto tiles on Overview and
 *       Crypto show "—" with a reason (rate-limited), never "$0", "0 coins" or "0.0%".
 *   D3  gateway healthy (fixtures): Overview, Stocks, Crypto and Forex show the fixture values.
 *   D4  gateway unreachable (request aborted): the banner "Market data gateway unreachable from this
 *       network" shows and no tile on any tab shows a fake zero.
 *   D5  no page errors on any tab, in all three scenarios, in both themes.
 *   D6  the terminal does not hammer the gateway: never more than 4 gateway requests in flight, and a 429
 *       is retried exactly once (2 /crypto requests per load, not 1 and not a storm).
 *
 * Usage: node tools/test-finance-terminal-data.mjs [--screens <dir>] [--only healthy|ratelimited|down]
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = process.cwd();
const argv = process.argv.slice(2);
const opt = (f) => (argv.includes(f) ? argv[argv.indexOf(f) + 1] : null);
const screens = opt('--screens');
const only = opt('--only');

const failures = [];
const law = (id, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${detail}`); if (!ok) failures.push(id); };

let puppeteer;
try { puppeteer = require('puppeteer'); } catch { puppeteer = require(path.join(process.env.HOME, 'rz-work/node_modules/puppeteer')); }

const GW = 'https://rz-finance-gateway.resistancezero0us.workers.dev';
const PROXY = /corsproxy\.io|allorigins\.win|codetabs\.com/;
const DIRECT_MARKET = /api\.coingecko\.com|finance\.yahoo\.com|api\.frankfurter\.|finnhub\.io/;
const BINANCE = /^https:\/\/data-api\.binance\.vision\//;
const ALLOW = /^https:\/\/(cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com|unpkg\.com)\//;

/* ── fixtures (recorded shapes of the live gateway, 2026-11-14) ── */
const PRICE = { SPY: 754.37, QQQ: 679.89, DIA: 523.15, IWM: 277.54, GLD: 355.45, TLT: 79.38, USO: 145.58, VGK: 71.22,
  AAPL: 356.27, MSFT: 512.4, NVDA: 188.1, 'BTC-USD': 66812.7 };
const symPrice = (s) => PRICE[s] || +(50 + [...s].reduce((a, c) => a + c.charCodeAt(0), 0) % 200 + 0.37).toFixed(2);
const symPct = (s) => +((([...s].reduce((a, c) => a + c.charCodeAt(0), 0) % 41) - 20) / 10 + 0.07).toFixed(2); // never exactly 0
const qRow = (s) => { const p = symPrice(s), dp = symPct(s), d = +(p * dp / 100).toFixed(2); return { sym: s, price: p, chg: d, chgPct: dp, prevClose: +(p - d).toFixed(2) }; };
const SECTORS = ['XLK', 'XLV', 'XLF', 'XLY', 'XLI', 'XLC', 'XLP', 'XLE', 'XLB', 'XLRE', 'XLU'];
const FUT = [['SPY', 'S&P 500 (ES)'], ['QQQ', 'Nasdaq 100 (NQ)'], ['DIA', 'Dow Jones (YM)'], ['IWM', 'Russell 2000 (RTY)'], ['USO', 'Crude Oil (CL)'], ['GLD', 'Gold (GC)']];
const BONDS = [['SHY', '1-3 Year Treasury'], ['IEF', '7-10 Year Treasury'], ['TLT', '20+ Year Treasury'], ['TIP', 'TIPS (Inflation)'], ['LQD', 'Investment Grade Corp'], ['HYG', 'High Yield Corp'], ['AGG', 'Total Bond Market']];
const RATES = { EUR: 0.90481, GBP: 0.75605, JPY: 160, CHF: 0.8384, AUD: 1.4738, CAD: 1.4258, NZD: 1.8076, SEK: 10.0502, NOK: 9.5634, CNY: 6.6719, INR: 94.25, IDR: 18245, SGD: 1.2881 };
const COINS = [
  ['bitcoin', 'btc', 'Bitcoin', 66812.7, 1.33e12, -2.1], ['ethereum', 'eth', 'Ethereum', 3105.2, 3.74e11, -3.4],
  ['tether', 'usdt', 'Tether', 1.0, 1.6e11, 0.01], ['solana', 'sol', 'Solana', 151.3, 7.1e10, -4.2], ['dogecoin', 'doge', 'Dogecoin', 0.1812, 2.6e10, -5.1],
].map(([id, symbol, name, price, mc, ch], i) => ({ id, symbol, name, current_price: price, market_cap: mc, market_cap_rank: i + 1, total_volume: mc / 20,
  price_change_percentage_24h: ch, price_change_percentage_24h_in_currency: ch, high_24h: price * 1.02, low_24h: price * 0.97,
  circulating_supply: mc / price, total_supply: mc / price, max_supply: id === 'bitcoin' ? 21e6 : null, ath: price * 1.4, ath_change_percentage: -28.5,
  ath_date: '2025-10-06T00:00:00.000Z', atl: price / 50, fully_diluted_valuation: mc * 1.05, image: '' }));
const CRYPTO = { global: { total_market_cap: { usd: 2.31e12 }, total_volume: { usd: 9.8e10 }, market_cap_percentage: { btc: 57.3, eth: 12.1, usdt: 4.4 },
  active_cryptocurrencies: 17654, markets: 1234, market_cap_change_percentage_24h_usd: -1.2 }, coins: COINS };
function candles(n = 260, base = 100) {
  const out = []; let c = base; const t0 = 1771000000;
  for (let i = 0; i < n; i++) { const o = c; c = +(c * (1 + Math.sin(i / 7) * 0.012 + 0.0008)).toFixed(2); out.push({ t: t0 + i * 86400, o, h: Math.max(o, c) * 1.004, l: Math.min(o, c) * 0.996, c, v: 1e6 + i * 1000 }); }
  return out;
}
const ANALYZE = { indicators: { rsi14: 55.2, sma20: 101, sma50: 99, sma200: 95, ema20: 100.4, macd: { macd: 0.8, signal: 0.6, hist: 0.2 }, bollinger: { upper: 104, lower: 97 }, atr14: 1.9, stoch: { k: 61 } },
  signals: { trend: 'Bullish', momentum: 'Neutral', volatility: 'Normal', ma_cross: 'Golden' }, gauge: { score: 62, label: 'Buy' }, prediction: { rationale: ['Trend up', 'Descriptive, not advice'] } };
const NEWS = [{ title: 'Fixture headline one', url: 'https://example.com/a', src: 'Fixture', summary: 'Summary.', ts: 1794657601000 }];

function gwData(u) {
  const p = u.pathname, q = u.searchParams;
  if (p === '/q') return (q.get('syms') || '').split(',').filter(Boolean).map((s) => qRow(s.toUpperCase()));
  if (p === '/sectors') return SECTORS.map((s) => { const r = qRow(s); return { sym: s, name: s, price: r.price, chgPct: r.chgPct, chg: r.chg }; });
  if (p === '/futures') return FUT.map(([s, n]) => { const r = qRow(s); return { sym: s, name: n, price: r.price, chgPct: r.chgPct, chg: r.chg }; });
  if (p === '/economy') return { yields: BONDS.map(([s, n]) => { const r = qRow(s); return { name: n, sym: s, price: r.price, chgPct: r.chgPct }; }),
    currencies: Object.entries(RATES).slice(0, 6).map(([c, r]) => ({ pair: 'USD/' + c, rate: r, inverse: 1 / r })) };
  if (p === '/crypto') return CRYPTO;
  if (p === '/fx') return { rates: RATES };
  if (p === '/fx-history') return { points: Array.from({ length: 22 }, (_, i) => ({ d: `2026-10-${String(i + 5).padStart(2, '0')}`, v: +(1.10 + i * 0.001).toFixed(4) })) };
  if (p === '/news') return NEWS;
  if (p === '/candles') return { candles: candles(260, symPrice((q.get('sym') || 'X').toUpperCase())) };
  if (p === '/analyze') return ANALYZE;
  if (p === '/quote') return { c: PRICE.AAPL, d: 1.39, dp: 0.3917, h: 360.83, l: 355.75, o: 357.96, pc: 354.88, t: 1794603600 };
  if (p === '/profile') return { name: 'Apple Inc', exchange: 'NASDAQ', finnhubIndustry: 'Technology', marketCapitalization: 5.3e6, country: 'US', currency: 'USD' };
  if (p === '/metric') return { metric: { '52WeekHigh': 380, '52WeekLow': 250, peTTM: 31.2 } };
  if (p === '/search') return { result: [{ symbol: 'AAPL', description: 'APPLE INC' }] };
  if (p === '/calendar/earnings') return { earningsCalendar: [{ symbol: 'NVDA', date: '2026-11-19', hour: 'amc', epsEstimate: 1.2 }] };
  if (p === '/calendar/ipo') return { ipoCalendar: [] };
  if (p === '/screener') return [{ sym: 'AAPL', name: 'Apple', price: PRICE.AAPL, chgPct: 0.39, vol: 5e7, marketCap: 5.3e12, pe: 31.2, sector: 'Technology', divYield: 0.4 }];
  return null;
}

/* ── server + browser ── */
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.csv': 'text/csv' };
const server = http.createServer((req, res) => {
  const abs = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''));
  if (!abs.startsWith(ROOT) || !fs.existsSync(abs) || fs.statSync(abs).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(abs)] || 'application/octet-stream' });
  fs.createReadStream(abs).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r)); // free port: never 8166/8081/8098
const BASE = `http://127.0.0.1:${server.address().port}/Apps/finance-terminal/index.html`;
const P = require(path.join(ROOT, 'js/rz-market-posture.js'));
const CSV = { [P.SOURCES.breadthDetail]: 'market_breadth_data.csv', [P.SOURCES.breadthSummary]: 'market_breadth_summary.csv',
  [P.SOURCES.uptrendTimeseries]: 'uptrend_ratio_timeseries.csv', [P.SOURCES.uptrendSectorSummary]: 'sector_summary.csv' };
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });

const TABS = ['overview', 'stocks', 'forex', 'crypto', 'commodities', 'screener', 'watchlist', 'news', 'sectors', 'posture', 'economy', 'futures', 'alerts'];
const CORS = { 'access-control-allow-origin': '*', 'content-type': 'application/json' };

async function run({ scenario, theme, width = 1440 }) {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 900 });
  const errors = [], proxyHits = [], directHits = [];
  let inflight = 0, maxInflight = 0, cryptoReqs = 0;
  page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 160) + (process.env.FT_STACK ? ' @ ' + String(e.stack).split('\n').slice(1, 3).join(' ') : '')));
  await page.evaluateOnNewDocument((t) => {
    try {
      localStorage.setItem('rz_ft_theme', t);
      localStorage.setItem('rz_ft_wl', JSON.stringify(['AAPL']));
      localStorage.setItem('rz_ft_port', JSON.stringify([{ tk: 'AAPL', price: 300, qty: 2, date: '2026-01-02' }]));
      localStorage.setItem('rz_ft_alerts', JSON.stringify([{ sym: 'AAPL', dir: 'below', price: 340, created: 1, triggered: false }]));
    } catch (e) {}
  }, theme);
  await page.setRequestInterception(true);
  page.on('request', (r) => {
    const u = r.url();
    if (PROXY.test(u)) { proxyHits.push(u.slice(0, 90)); return r.abort(); }
    if (u.startsWith(GW)) {
      const url = new URL(u);
      inflight++; maxInflight = Math.max(maxInflight, inflight);
      const done = () => { inflight--; };
      if (url.pathname === '/crypto') cryptoReqs++;
      setTimeout(() => {
        try {
          if (scenario === 'down') { done(); return r.abort('failed'); }
          if (scenario === 'ratelimited' && url.pathname === '/crypto') { done(); return r.respond({ status: 429, headers: { ...CORS, 'retry-after': '1' }, body: JSON.stringify({ ok: false, error: 'upstream_429', message: 'CoinGecko 429' }) }); }
          const data = gwData(url);
          done();
          if (data == null) return r.respond({ status: 404, headers: CORS, body: JSON.stringify({ ok: false, error: 'not_found' }) });
          return r.respond({ status: 200, headers: CORS, body: JSON.stringify({ ok: true, data }) });
        } catch (e) { done(); try { r.abort(); } catch (_) {} }
      }, 120);
      return;
    }
    if (BINANCE.test(u)) return r.abort('failed'); // fallback down in every scenario: D2/D4 must hold without it
    if (DIRECT_MARKET.test(u)) {
      directHits.push(u.replace(/token=[^&]+/, 'token=…').slice(0, 90));
      // what the live hosts do today: CoinGecko 429 with no CORS header (browser sees a CORS failure)
      return r.respond({ status: 429, headers: { 'content-type': 'application/json' }, body: '{"status":{"error_code":429}}' });
    }
    if (CSV[u]) return r.respond({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'text/csv' }, body: fs.readFileSync(path.join(ROOT, 'tools/fixtures/market-posture', CSV[u])) });
    if (u.startsWith('http://127.0.0.1') || ALLOW.test(u) || u.startsWith('data:') || u.startsWith('blob:')) return r.continue();
    return r.abort();
  });
  const settle = async (ms = 900) => {
    const t0 = Date.now(); let quietSince = Date.now();
    while (Date.now() - t0 < 20000) { await new Promise((r) => setTimeout(r, 100)); if (inflight > 0) quietSince = Date.now(); else if (Date.now() - quietSince > ms) break; }
  };
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate((t) => { document.documentElement.setAttribute('data-theme', t); const m = document.getElementById('apiModal'); if (m) m.style.display = 'none'; }, theme);
  await settle(1500);
  const text = {};
  const grab = (ids) => page.evaluate((ids) => { const o = {}; ids.forEach((id) => { const el = document.getElementById(id); o[id] = el ? el.innerText : null; }); return o; }, ids);
  // a 429 retry waits Retry-After with nothing in flight: wait for the KPI tiles to be drawn (skeletons gone), max 15 s
  await page.waitForFunction(() => { const el = document.getElementById('overviewKpis'); return el && el.querySelectorAll('.kpi').length >= 4 && !el.querySelector('.skel'); }, { timeout: 15000 }).catch(() => {});
  Object.assign(text, await grab(['overviewKpis', 'worldKpis', 'commodityKpis', 'heatmapGrid', 'tickerTape', 'gaugeWrap', 'gainersTable', 'overviewEarnings']));
  const banner = await page.evaluate(() => { const b = [...document.querySelectorAll('[role=alert],[role=status],.gw-banner')].find((x) => /gateway unreachable/i.test(x.innerText)); return b ? { text: b.innerText, visible: !!(b.offsetWidth || b.offsetHeight) } : null; });
  for (const tab of TABS.slice(1)) {
    await page.evaluate((t) => switchTab(t), tab);
    if (tab === 'stocks') await page.evaluate(() => selectStock('AAPL'));
    if (tab === 'screener') await page.evaluate(() => { try { runStockScreen(); } catch (e) {} });
    await settle(tab === 'crypto' ? 1800 : 900);
    if (tab === 'stocks') Object.assign(text, await grab(['stockHero']));
    if (tab === 'forex') Object.assign(text, await grab(['fxPairsGrid']));
    if (tab === 'crypto') Object.assign(text, await grab(['cryptoKpis', 'cryptoTable', 'trendingCoins']));
    if (tab === 'commodities') Object.assign(text, await grab(['cmdKpis', 'cmdTable']));
    if (tab === 'watchlist') Object.assign(text, await grab(['wlTable', 'portSummary', 'portTable']));
    if (tab === 'sectors') Object.assign(text, await grab(['sectorTable']));
    if (tab === 'economy') Object.assign(text, await grab(['econKpis', 'yieldTable']));
    if (tab === 'futures') Object.assign(text, await grab(['futuresKpis', 'futuresTable']));
    if (tab === 'alerts') Object.assign(text, await grab(['alertTable']));
    if (screens && theme === 'dark' && ['overview', 'crypto'].includes(tab)) await page.screenshot({ path: path.join(screens, `w6f-test-${scenario}-${tab}.png`) });
  }
  if (screens && theme === 'dark') { await page.evaluate(() => switchTab('overview')); await settle(900); await page.screenshot({ path: path.join(screens, `w6f-test-${scenario}-overview.png`) }); }
  await page.close();
  return { scenario, theme, errors, proxyHits, directHits, maxInflight, cryptoReqs, text, banner };
}

/* fake-zero detector: what a failed load used to print */
const FAKE = [/\$0(?:\.0+)?(?![\d.,]*[1-9])/, /(?<![\d.])[+-]?0\.0+%/, /(?<![\d.,])0 (?:coins|active)\b/, /(?<![\d.])0\.0000(?!\d)/];
const fakeIn = (s) => (s == null ? [] : FAKE.map((re) => (s.match(re) || [])[0]).filter(Boolean));

const scen = only ? [only] : ['healthy', 'ratelimited', 'down'];
const runs = [];
for (const s of scen) for (const theme of ['dark', 'light']) {
  const r = await run({ scenario: s, theme });
  runs.push(r);
  console.log(`    ${s}/${theme}: page errors ${r.errors.length}${r.errors.length ? ' [' + r.errors[0] + ']' : ''}, proxy hits ${r.proxyHits.length}, direct market hits ${r.directHits.length}${r.directHits.length ? ' [' + r.directHits[0] + ']' : ''}, max gateway in flight ${r.maxInflight}, /crypto requests ${r.cryptoReqs}, banner ${r.banner ? 'yes' : 'no'}`);
}
await browser.close(); server.close();

const proxy = runs.reduce((a, r) => a + r.proxyHits.length, 0), direct = runs.reduce((a, r) => a + r.directHits.length, 0);
law('D1', proxy === 0 && direct === 0, `public CORS proxy requests across ${runs.length} runs x ${TABS.length} tabs: ${proxy}; direct CoinGecko/Yahoo/Frankfurter/Finnhub reads: ${direct}`);

const rl = runs.filter((r) => r.scenario === 'ratelimited');
if (rl.length) {
  const bad = [];
  for (const r of rl) {
    const ov = r.text.overviewKpis || '', ck = r.text.cryptoKpis || '';
    const f = [...fakeIn(ov).map((x) => 'overview "' + x + '"'), ...fakeIn(ck).map((x) => 'crypto "' + x + '"')];
    if (f.length) bad.push(`${r.theme}: fake ${f.join(', ')}`);
    if (!/—/.test(ov) || !/rate.?limited/i.test(ov)) bad.push(`${r.theme}: overview crypto tiles lack "—" + rate-limited reason [${ov.replace(/\s+/g, ' ').slice(0, 160)}]`);
    if (!/—/.test(ck) || !/rate.?limited/i.test(ck)) bad.push(`${r.theme}: crypto KPIs lack "—" + rate-limited reason [${ck.replace(/\s+/g, ' ').slice(0, 160)}]`);
  }
  law('D2', !bad.length, bad.length ? bad.join(' | ') : 'gateway /crypto 429 + fallback down: Overview + Crypto tiles show "—" and "rate-limited", no $0 / 0 coins / 0.0%');
}

const hl = runs.filter((r) => r.scenario === 'healthy');
if (hl.length) {
  const want = { overviewKpis: ['$754.37', '$66.8K', '$2.3T', '17.7K coins', '57.3%'], stockHero: ['$356.27', 'Apple Inc'], cryptoKpis: ['$2.3T', '57.3%', '17.7K'], cryptoTable: ['Bitcoin', '66812.70'], fxPairsGrid: ['1.1052', '160.0000'] };
  const miss = [];
  for (const r of hl) for (const [id, list] of Object.entries(want)) for (const w of list) if (!(r.text[id] || '').includes(w)) miss.push(`${r.theme} ${id} lacks ${w}`);
  law('D3', !miss.length, miss.length ? miss.slice(0, 8).join(' | ') : 'healthy gateway fixtures: Overview SPY $754.37 / BTC $66.8K / cap $2.3T / 17.7K coins / 57.3%, Stocks AAPL $356.27, Crypto table + KPIs, Forex EUR/USD 1.1052 + USD/JPY 160.0000');
}

const dn = runs.filter((r) => r.scenario === 'down');
if (dn.length) {
  const bad = [];
  for (const r of dn) {
    if (!r.banner || !r.banner.visible || !/Market data gateway unreachable from this network/.test(r.banner.text)) bad.push(`${r.theme}: banner ${r.banner ? JSON.stringify(r.banner.text.slice(0, 80)) : 'missing'}`);
    for (const [id, s] of Object.entries(r.text)) { const f = fakeIn(s); if (f.length) bad.push(`${r.theme} #${id} shows ${f.map((x) => '"' + x + '"').join(',')}`); }
  }
  law('D4', !bad.length, bad.length ? bad.slice(0, 10).join(' | ') : `gateway aborted: banner shown in both themes, 0 fake zeros across ${Object.keys(dn[0].text).length} tile regions on every tab`);
}

const errs = runs.filter((r) => r.errors.length);
law('D5', !errs.length, errs.length ? errs.map((r) => `${r.scenario}/${r.theme}: ${r.errors.slice(0, 2).join(' ; ')}`).join(' | ') : `0 page errors on ${TABS.length} tabs x ${runs.length} runs (scenarios x dark/light)`);

const maxIn = Math.max(...runs.map((r) => r.maxInflight));
const rlCrypto = rl.map((r) => r.cryptoReqs);
law('D6', maxIn <= 4 && (!rl.length || rlCrypto.every((n) => n === 2)), `max gateway requests in flight ${maxIn} (limit 4); /crypto requests per rate-limited run [${rlCrypto.join(', ')}] (want 2: one call + one retry)`);

console.log(failures.length ? `\nFAIL ${failures.join(', ')}` : '\nALL FINANCE-TERMINAL DATA LAWS PASS');
process.exit(failures.length ? 1 : 0);
