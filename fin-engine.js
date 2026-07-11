/**
 * fin-engine.js — ResistanceZero FIN Engine
 *
 * The finance sibling of rz-engine.js (which covers data-centre technical math).
 * ONE shared, gate-tested, provenance-sourced brain for every finance surface on the
 * site (Finance Terminal screener + advisor scorecard, StockMap, future pages). The
 * SAME scoring model (models.score) powers both the screener ranking and the per-stock
 * scorecard, so all finance features correlate through one engine.
 *
 * Load order: (auth.js ->) fin-engine.js -> page IIFE. No build step. Vanilla ES5/ES6.
 * No external deps. Live prices come from the deployed Cloudflare gateway; this engine
 * holds only sourced methodology/structural constants + deterministic math.
 *
 * IMPORTANT — this is an EDUCATIONAL ANALYSIS / decision-support tool. It is NOT
 * personalized investment advice and NOT a licensed financial advisor. Every scored
 * output carries FINEngine.DISCLAIMER. See standarization/FIN_ENGINE.md.
 *
 * Provides:
 *   - FINEngine.data            Single source of truth (markets, universes, factor weights…).
 *   - FINEngine.models.ratios   P/E, P/B, PEG, EV/EBITDA, ROE, margins, current/quick, D/E.
 *   - FINEngine.models.valuation DCF, Graham number, dividend-discount, multiples fair value.
 *   - FINEngine.models.technical sma/ema/rsi/macd/bollinger/stoch/atr + 0-100 gauge (parity w/ ta.js).
 *   - FINEngine.models.risk     returns, volatility, beta, sharpe, max-drawdown, position size.
 *   - FINEngine.models.score    multi-factor composite score + rank + explainable rationale.
 *   - FINEngine.models.portfolio weights, correlation, diversification.
 *   - FINEngine.format.*        multi-currency (incl IDR), percent, T/B/M, ticker.
 */
(function (root) {
    'use strict';

    if (root.FINEngine) {
        try { console.warn('[FINEngine] already loaded; skipping re-init'); } catch (e) {}
        return;
    }

    var DISCLAIMER = 'Educational analysis only — not investment advice and not a licensed ' +
        'financial advisor. Rule-based signals from public data; combine with your own research ' +
        'and risk limits.';

    /* ====================================================================
     * I. DATA — single source of truth. Every economically-material value is
     * registered in DATA.sources with a citation (SUPER_ENGINE §Z). No model
     * function body may hardcode a value that lives here.
     * ==================================================================== */
    var DATA = {
        version: '1.0.0',
        lastUpdated: '2026-07-11',
        asOf: '2026-07',

        meta: {
            schemaVersion: '1.0.0',
            engineVersion: '1.0.0',
            asOf: '2026-07',
            lastReviewed: '2026-07-11',
            license: 'CC-BY-4.0 (methodology + compiled constituent lists) — see DATA.provenance'
        },

        // Markets the engine understands. riskFree = local 10Y govt yield snapshot (for DCF/DDM/sharpe).
        markets: {
            US: { name: 'United States', currency: 'USD', index: '^GSPC', indexName: 'S&P 500', suffix: '', riskFree: 0.043 },
            ID: { name: 'Indonesia', currency: 'IDR', index: '^JKSE', indexName: 'IHSG', suffix: '.JK', riskFree: 0.068 }
        },

        currency: {
            USD: { symbol: '$', code: 'USD', decimals: 2, per1USD: 1 },
            IDR: { symbol: 'Rp', code: 'IDR', decimals: 0, per1USD: 16300 }
        },

        // Ticker universes per market. Each list is a curated, sourced snapshot (membership as-of).
        // US = liquid mega/large-caps; ID = IDX blue chips (Yahoo `.JK`), incl the 25 StockMap names.
        universes: {
            US: [
                { sym: 'AAPL', name: 'Apple', sector: 'Technology' },
                { sym: 'MSFT', name: 'Microsoft', sector: 'Technology' },
                { sym: 'GOOGL', name: 'Alphabet', sector: 'Communication' },
                { sym: 'AMZN', name: 'Amazon', sector: 'Consumer Discretionary' },
                { sym: 'NVDA', name: 'NVIDIA', sector: 'Technology' },
                { sym: 'META', name: 'Meta Platforms', sector: 'Communication' },
                { sym: 'TSLA', name: 'Tesla', sector: 'Consumer Discretionary' },
                { sym: 'BRK.B', name: 'Berkshire Hathaway', sector: 'Financials' },
                { sym: 'JPM', name: 'JPMorgan Chase', sector: 'Financials' },
                { sym: 'V', name: 'Visa', sector: 'Financials' },
                { sym: 'JNJ', name: 'Johnson & Johnson', sector: 'Healthcare' },
                { sym: 'WMT', name: 'Walmart', sector: 'Consumer Staples' },
                { sym: 'UNH', name: 'UnitedHealth', sector: 'Healthcare' },
                { sym: 'XOM', name: 'Exxon Mobil', sector: 'Energy' },
                { sym: 'PG', name: 'Procter & Gamble', sector: 'Consumer Staples' },
                { sym: 'MA', name: 'Mastercard', sector: 'Financials' },
                { sym: 'HD', name: 'Home Depot', sector: 'Consumer Discretionary' },
                { sym: 'KO', name: 'Coca-Cola', sector: 'Consumer Staples' },
                { sym: 'AVGO', name: 'Broadcom', sector: 'Technology' },
                { sym: 'COST', name: 'Costco', sector: 'Consumer Staples' }
            ],
            ID: [
                { sym: 'BBCA.JK', name: 'Bank Central Asia', sector: 'Financials' },
                { sym: 'BBRI.JK', name: 'Bank Rakyat Indonesia', sector: 'Financials' },
                { sym: 'BMRI.JK', name: 'Bank Mandiri', sector: 'Financials' },
                { sym: 'BBNI.JK', name: 'Bank Negara Indonesia', sector: 'Financials' },
                { sym: 'TLKM.JK', name: 'Telkom Indonesia', sector: 'Communication' },
                { sym: 'ASII.JK', name: 'Astra International', sector: 'Consumer Discretionary' },
                { sym: 'UNTR.JK', name: 'United Tractors', sector: 'Industrials' },
                { sym: 'ICBP.JK', name: 'Indofood CBP', sector: 'Consumer Staples' },
                { sym: 'INDF.JK', name: 'Indofood Sukses Makmur', sector: 'Consumer Staples' },
                { sym: 'KLBF.JK', name: 'Kalbe Farma', sector: 'Healthcare' },
                { sym: 'SMGR.JK', name: 'Semen Indonesia', sector: 'Materials' },
                { sym: 'PGAS.JK', name: 'Perusahaan Gas Negara', sector: 'Energy' },
                { sym: 'PTBA.JK', name: 'Bukit Asam', sector: 'Energy' },
                { sym: 'ITMG.JK', name: 'Indo Tambangraya Megah', sector: 'Energy' },
                { sym: 'ANTM.JK', name: 'Aneka Tambang', sector: 'Materials' },
                { sym: 'INCO.JK', name: 'Vale Indonesia', sector: 'Materials' },
                { sym: 'TINS.JK', name: 'Timah', sector: 'Materials' },
                { sym: 'JSMR.JK', name: 'Jasa Marga', sector: 'Industrials' },
                { sym: 'AALI.JK', name: 'Astra Agro Lestari', sector: 'Consumer Staples' },
                { sym: 'AUTO.JK', name: 'Astra Otoparts', sector: 'Consumer Discretionary' },
                { sym: 'WIKA.JK', name: 'Wijaya Karya', sector: 'Industrials' },
                { sym: 'WTON.JK', name: 'Wijaya Karya Beton', sector: 'Industrials' },
                { sym: 'WEGE.JK', name: 'Wijaya Karya Gedung', sector: 'Industrials' },
                { sym: 'GIAA.JK', name: 'Garuda Indonesia', sector: 'Industrials' },
                { sym: 'BUMI.JK', name: 'Bumi Resources', sector: 'Energy' }
            ]
        },

        // GICS-style taxonomy used across finance surfaces.
        sectors: ['Technology', 'Financials', 'Healthcare', 'Communication', 'Consumer Discretionary',
            'Consumer Staples', 'Energy', 'Industrials', 'Materials', 'Utilities', 'Real Estate'],

        // Normalization bands: raw metric → 0-100. invert:true means "lower is better".
        // log:true normalizes on a log scale (mcap/volume span orders of magnitude).
        scoreBands: {
            pe: { lo: 5, hi: 40, invert: true },
            pb: { lo: 0.5, hi: 8, invert: true },
            evEbitda: { lo: 4, hi: 20, invert: true },
            roe: { lo: 0, hi: 0.30, invert: false },
            netMargin: { lo: 0, hi: 0.30, invert: false },
            debtEquity: { lo: 0, hi: 2, invert: true },
            chgPct: { lo: -5, hi: 5, invert: false },
            chg1m: { lo: -20, hi: 20, invert: false },
            divYield: { lo: 0, hi: 0.06, invert: false },
            mcap: { lo: 1e9, hi: 1e12, invert: false, log: true },
            vol: { lo: 1e5, hi: 2e7, invert: false, log: true },
            floatPct: { lo: 0.05, hi: 0.50, invert: false }
        },

        // Preset strategies = factor-weight configs. A preset is an ALGORITHM, not a threshold.
        // Weights over the 7 factors; the engine re-normalizes over factors that have data.
        factorWeights: {
            balanced: { value: 0.18, quality: 0.18, momentum: 0.16, dividend: 0.12, liquidity: 0.10, float: 0.10, technical: 0.16 },
            value: { value: 0.34, quality: 0.22, dividend: 0.14, technical: 0.10, momentum: 0.08, liquidity: 0.06, float: 0.06 },
            growth: { value: 0.10, quality: 0.22, momentum: 0.28, dividend: 0.05, liquidity: 0.08, float: 0.05, technical: 0.22 },
            momentum: { value: 0.04, quality: 0.10, momentum: 0.40, dividend: 0.00, liquidity: 0.12, float: 0.04, technical: 0.30 },
            dividend: { value: 0.18, quality: 0.20, momentum: 0.00, dividend: 0.38, liquidity: 0.10, float: 0.06, technical: 0.08 },
            quality: { value: 0.22, quality: 0.38, momentum: 0.10, dividend: 0.00, liquidity: 0.08, float: 0.08, technical: 0.14 },
            idxBluechip: { value: 0.06, quality: 0.18, momentum: 0.18, dividend: 0.00, liquidity: 0.24, float: 0.22, technical: 0.12 }
        },

        // Free-float health bands (reuses the StockMap taxonomy).
        floatBands: { trap: 0.05, tight: 0.15, institutional: 0.35 },

        // Composite-score verdict thresholds (descriptive, not prescriptive).
        verdictBands: [
            { min: 75, label: 'Strong' },
            { min: 60, label: 'Favorable' },
            { min: 45, label: 'Neutral' },
            { min: 30, label: 'Cautious' },
            { min: 0, label: 'Weak' }
        ],

        sources: {
            'markets.US.riskFree': { source: 'US Treasury 10Y constant-maturity yield', asOf: '2026-07', unit: 'fraction/yr' },
            'markets.ID.riskFree': { source: 'Indonesia 10Y govt bond (INDOGB) yield', asOf: '2026-07', unit: 'fraction/yr' },
            'markets.US.index': { source: 'S&P Dow Jones Indices (S&P 500)', asOf: '2026', method: 'benchmark ticker' },
            'markets.ID.index': { source: 'IDX Composite (IHSG / ^JKSE)', asOf: '2026', method: 'benchmark ticker' },
            'currency': { source: 'ECB / Bank Indonesia reference rates', asOf: '2026-07', method: 'spot, USD base' },
            'universes.US': { source: 'Large-cap constituents (S&P 500 top by weight)', asOf: '2026-07', method: 'curated liquid mega/large-cap set' },
            'universes.ID': { source: 'IDX blue chips (LQ45 subset + StockMap sourced names)', asOf: '2026-07', method: 'curated; Yahoo .JK tickers' },
            'sectors': { source: 'GICS sector taxonomy (MSCI/S&P)', asOf: '2026' },
            'scoreBands': { source: 'Engine methodology — normalization ranges from typical market distributions', asOf: '2026', method: 'min-max, log for size/liquidity' },
            'factorWeights': { source: 'Engine methodology — factor-investing style weights (Fama-French value/quality/momentum lineage)', asOf: '2026', method: 'weights per preset; re-normalized over available factors' },
            'floatBands': { source: 'StockMap free-float taxonomy (float-trap / tight / institutional)', asOf: '2026', unit: 'fraction of shares outstanding' },
            'verdictBands': { source: 'Engine methodology — composite score → descriptive verdict', asOf: '2026', method: 'descriptive, not prescriptive' }
        },

        provenance: [
            { org: 'S&P Dow Jones Indices', year: 2026, topic: 'S&P 500 constituents + benchmark', url: 'https://www.spglobal.com/spdji/' },
            { org: 'Indonesia Stock Exchange (IDX)', year: 2026, topic: 'LQ45 / IHSG constituents', url: 'https://www.idx.co.id' },
            { org: 'US Department of the Treasury', year: 2026, topic: '10Y yield (risk-free)', url: 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates' },
            { org: 'Bank Indonesia', year: 2026, topic: 'IDR reference rate + policy', url: 'https://www.bi.go.id' },
            { org: 'MSCI / S&P (GICS)', year: 2026, topic: 'sector taxonomy', url: 'https://www.msci.com/gics' },
            { org: 'Fama & French', year: 1993, topic: 'value/size factor lineage', url: 'https://www.jstor.org/stable/2329112' }
        ]
    };

    /* ====================================================================
     * II. Helpers
     * ==================================================================== */
    function isNum(v) { return typeof v === 'number' && isFinite(v); }
    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
    function r2(v) { return (v == null || !isFinite(v)) ? null : Math.round(v * 100) / 100; }

    /** Normalize a raw metric to 0-100 using a scoreBands entry. Returns null if input missing. */
    function normBand(value, band) {
        if (!isNum(value) || !band) return null;
        // Sentinel-zero guard: gateways return 0 for a MISSING ratio (no P/E, no mcap…). For bands
        // whose valid range starts above 0, treat 0 as "no data" (null) rather than a real value —
        // otherwise a stock with no P/E would score a perfect (inverted) Value. Bands with lo<=0
        // (roe, debtEquity, divYield, chgPct) keep 0 as a meaningful value.
        if (value === 0 && band.lo > 0) return null;
        if (band.hi === band.lo) return null;
        var lo = band.lo, hi = band.hi, v = value;
        if (band.log) {
            var eps = 1e-9;
            v = Math.log(Math.max(value, eps));
            lo = Math.log(Math.max(band.lo, eps));
            hi = Math.log(Math.max(band.hi, eps));
        }
        var t = (v - lo) / (hi - lo);
        t = clamp(t, 0, 1);
        if (band.invert) t = 1 - t;
        return Math.round(t * 100);
    }

    /* ====================================================================
     * III. MODELS
     * ==================================================================== */

    /* ── ratios: fundamental ratios from raw inputs ── */
    var ratios = {
        pe: function (price, eps) { return (isNum(price) && isNum(eps) && eps !== 0) ? price / eps : null; },
        pb: function (price, bvps) { return (isNum(price) && isNum(bvps) && bvps !== 0) ? price / bvps : null; },
        peg: function (pe, growthPct) { return (isNum(pe) && isNum(growthPct) && growthPct !== 0) ? pe / growthPct : null; },
        evEbitda: function (ev, ebitda) { return (isNum(ev) && isNum(ebitda) && ebitda !== 0) ? ev / ebitda : null; },
        roe: function (netIncome, equity) { return (isNum(netIncome) && isNum(equity) && equity !== 0) ? netIncome / equity : null; },
        netMargin: function (netIncome, revenue) { return (isNum(netIncome) && isNum(revenue) && revenue !== 0) ? netIncome / revenue : null; },
        currentRatio: function (ca, cl) { return (isNum(ca) && isNum(cl) && cl !== 0) ? ca / cl : null; },
        quickRatio: function (ca, inv, cl) { return (isNum(ca) && isNum(inv) && isNum(cl) && cl !== 0) ? (ca - inv) / cl : null; },
        debtEquity: function (debt, equity) { return (isNum(debt) && isNum(equity) && equity !== 0) ? debt / equity : null; }
    };

    /* ── valuation: intrinsic-value models ── */
    var valuation = {
        /** Two-stage DCF → intrinsic value per share. growth/terminalGrowth/discount are fractions. */
        dcf: function (fcf0, growth, years, terminalGrowth, discount, sharesOut) {
            if (!isNum(fcf0) || !isNum(growth) || !isNum(years) || !isNum(terminalGrowth) ||
                !isNum(discount) || discount <= terminalGrowth) return null;
            var pv = 0, fcf = fcf0;
            for (var y = 1; y <= years; y++) {
                fcf = fcf * (1 + growth);
                pv += fcf / Math.pow(1 + discount, y);
            }
            var terminal = (fcf * (1 + terminalGrowth)) / (discount - terminalGrowth);
            pv += terminal / Math.pow(1 + discount, years);
            if (isNum(sharesOut) && sharesOut > 0) return pv / sharesOut;
            return pv;
        },
        /** Benjamin Graham number: sqrt(22.5 * EPS * BVPS). */
        graham: function (eps, bvps) {
            if (!isNum(eps) || !isNum(bvps) || eps <= 0 || bvps <= 0) return null;
            return Math.sqrt(22.5 * eps * bvps);
        },
        /** Gordon dividend-discount fair value. */
        ddm: function (dividend, growth, requiredReturn) {
            if (!isNum(dividend) || !isNum(growth) || !isNum(requiredReturn) || requiredReturn <= growth) return null;
            return (dividend * (1 + growth)) / (requiredReturn - growth);
        },
        /** Multiples-based fair value: metric per share × a peer multiple. */
        multiplesFairValue: function (metricPerShare, peerMultiple) {
            return (isNum(metricPerShare) && isNum(peerMultiple)) ? metricPerShare * peerMultiple : null;
        }
    };

    /* ── technical: PORTED VERBATIM from cf-worker/src/ta.js so the client and the
     *    gateway produce identical indicators/gauge (parity-tested). ── */
    function sma(vals, p) {
        if (!vals || vals.length < p) return null;
        var s = 0;
        for (var i = vals.length - p; i < vals.length; i++) s += vals[i];
        return s / p;
    }
    function emaSeries(vals, p) {
        if (!vals || vals.length < p) return null;
        var k = 2 / (p + 1);
        var e = vals.slice(0, p).reduce(function (a, b) { return a + b; }, 0) / p;
        var out = new Array(p - 1).fill(null);
        out.push(e);
        for (var i = p; i < vals.length; i++) { e = vals[i] * k + e * (1 - k); out.push(e); }
        return out;
    }
    function ema(vals, p) { var s = emaSeries(vals, p); return s ? s[s.length - 1] : null; }
    function rsi(closes, p) {
        p = p || 14;
        if (!closes || closes.length < p + 1) return null;
        var gain = 0, loss = 0;
        for (var i = closes.length - p; i < closes.length; i++) {
            var d = closes[i] - closes[i - 1];
            if (d >= 0) gain += d; else loss -= d;
        }
        var avgG = gain / p, avgL = loss / p;
        if (avgL === 0) return 100;
        var rs = avgG / avgL;
        return 100 - 100 / (1 + rs);
    }
    function macd(closes) {
        if (!closes || closes.length < 26) return null;
        var e12 = emaSeries(closes, 12), e26 = emaSeries(closes, 26);
        if (!e12 || !e26) return null;
        var line = [];
        for (var i = 0; i < closes.length; i++) {
            if (e12[i] == null || e26[i] == null) { line.push(null); continue; }
            line.push(e12[i] - e26[i]);
        }
        var clean = line.filter(function (v) { return v != null; });
        var sig = emaSeries(clean, 9);
        var macdVal = line[line.length - 1];
        var sigVal = sig ? sig[sig.length - 1] : null;
        return { macd: macdVal, signal: sigVal, hist: sigVal != null ? macdVal - sigVal : null };
    }
    function bollinger(closes, p, mult) {
        p = p || 20; mult = mult || 2;
        if (!closes || closes.length < p) return null;
        var slice = closes.slice(-p);
        var mean = slice.reduce(function (a, b) { return a + b; }, 0) / p;
        var variance = slice.reduce(function (a, b) { return a + (b - mean) * (b - mean); }, 0) / p;
        var sd = Math.sqrt(variance);
        return { mid: mean, upper: mean + mult * sd, lower: mean - mult * sd };
    }
    function stochastic(highs, lows, closes, p) {
        p = p || 14;
        if (!closes || closes.length < p) return null;
        var hi = Math.max.apply(null, highs.slice(-p));
        var lo = Math.min.apply(null, lows.slice(-p));
        var c = closes[closes.length - 1];
        if (hi === lo) return { k: 50 };
        return { k: ((c - lo) / (hi - lo)) * 100 };
    }
    function atr(highs, lows, closes, p) {
        p = p || 14;
        if (!closes || closes.length < p + 1) return null;
        var trs = [];
        for (var i = 1; i < closes.length; i++) {
            trs.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
        }
        return sma(trs, p);
    }
    /** Full analytics payload from candles [{t,o,h,l,c,v}] — mirrors ta.js analyze(). */
    function analyze(candles) {
        var rows = (candles || []).filter(function (k) { return k && isFinite(k.c); });
        var closes = rows.map(function (k) { return k.c; });
        var highs = rows.map(function (k) { return isFinite(k.h) ? k.h : k.c; });
        var lows = rows.map(function (k) { return isFinite(k.l) ? k.l : k.c; });
        var price = closes[closes.length - 1];

        var rsi14 = rsi(closes);
        var sma20 = sma(closes, 20), sma50 = sma(closes, 50), sma200 = sma(closes, 200);
        var ema20 = ema(closes, 20);
        var mac = macd(closes);
        var boll = bollinger(closes);
        var stoch = stochastic(highs, lows, closes);
        var atr14 = atr(highs, lows, closes);

        var indicators = {
            rsi14: r2(rsi14), sma20: r2(sma20), sma50: r2(sma50), sma200: r2(sma200),
            ema20: r2(ema20), atr14: r2(atr14),
            macd: { macd: r2(mac && mac.macd), signal: r2(mac && mac.signal), hist: r2(mac && mac.hist) },
            bollinger: { upper: r2(boll && boll.upper), lower: r2(boll && boll.lower), mid: r2(boll && boll.mid) },
            stoch: { k: r2(stoch && stoch.k) }
        };

        var trend = (sma50 != null && sma200 != null)
            ? (price > sma50 && sma50 > sma200 ? 'Bullish' : (price < sma50 && sma50 < sma200 ? 'Bearish' : 'Neutral'))
            : (price != null && sma20 != null ? (price > sma20 ? 'Bullish' : 'Bearish') : 'Neutral');
        var momentum = rsi14 == null ? 'Neutral'
            : rsi14 >= 70 ? 'Overbought' : rsi14 <= 30 ? 'Oversold'
                : rsi14 >= 55 ? 'Rising' : rsi14 <= 45 ? 'Falling' : 'Neutral';
        var atrPct = (atr14 != null && price) ? (atr14 / price) * 100 : null;
        var volatility = atrPct == null ? 'Normal' : atrPct >= 3 ? 'High' : atrPct <= 1 ? 'Low' : 'Normal';
        var ma_cross = (sma20 != null && sma50 != null)
            ? (sma20 > sma50 ? 'Golden (bullish)' : (sma20 < sma50 ? 'Death (bearish)' : 'Flat')) : '—';
        var signals = { trend: trend, momentum: momentum, volatility: volatility, ma_cross: ma_cross };

        var score = 50;
        if (rsi14 != null) { score += (rsi14 - 50) * 0.6; }
        if (price != null && sma50 != null) { score += price > sma50 ? 10 : -10; }
        if (sma20 != null && sma50 != null) { score += sma20 > sma50 ? 8 : -8; }
        if (mac && mac.hist != null) { score += mac.hist > 0 ? 7 : -7; }
        if (stoch && stoch.k != null) { score += (stoch.k - 50) * 0.12; }
        score = Math.max(0, Math.min(100, Math.round(score)));
        var label = score >= 75 ? 'Strong Buy' : score >= 60 ? 'Buy' : score >= 40 ? 'Neutral' : score >= 25 ? 'Sell' : 'Strong Sell';
        var gauge = { score: score, label: label };

        var rationale = [];
        if (trend !== 'Neutral') rationale.push('Trend is ' + trend.toLowerCase() + ' — price ' + (price > (sma50 || price) ? 'above' : 'below') + ' the 50-period average.');
        if (rsi14 != null) rationale.push('RSI(14) at ' + r2(rsi14) + ' indicates ' + momentum.toLowerCase() + ' momentum.');
        if (ma_cross !== '—' && ma_cross !== 'Flat') rationale.push('20/50 moving-average cross is ' + ma_cross + '.');
        if (mac && mac.hist != null) rationale.push('MACD histogram is ' + (mac.hist > 0 ? 'positive' : 'negative') + ' (' + r2(mac.hist) + ').');
        if (atrPct != null) rationale.push('Volatility ' + volatility.toLowerCase() + ' — ATR ≈ ' + r2(atrPct) + '% of price.');
        rationale.push('Rule-based technical read for education only — not investment advice; combine with fundamentals and risk limits.');

        return { price: r2(price), indicators: indicators, signals: signals, gauge: gauge, prediction: { rationale: rationale } };
    }
    var technical = {
        sma: sma, ema: ema, emaSeries: emaSeries, rsi: rsi, macd: macd,
        bollinger: bollinger, stochastic: stochastic, atr: atr, gauge: function (candles) { return analyze(candles).gauge; }, analyze: analyze
    };

    /* ── risk ── */
    var risk = {
        returns: function (closes) {
            if (!closes || closes.length < 2) return [];
            var out = [];
            for (var i = 1; i < closes.length; i++) {
                if (closes[i - 1]) out.push(closes[i] / closes[i - 1] - 1);
            }
            return out;
        },
        volatility: function (returns, periodsPerYear) {
            periodsPerYear = periodsPerYear || 252;
            if (!returns || returns.length < 2) return null;
            var m = returns.reduce(function (a, b) { return a + b; }, 0) / returns.length;
            var v = returns.reduce(function (a, b) { return a + (b - m) * (b - m); }, 0) / (returns.length - 1);
            return Math.sqrt(v) * Math.sqrt(periodsPerYear);
        },
        beta: function (assetReturns, marketReturns) {
            if (!assetReturns || !marketReturns) return null;
            var n = Math.min(assetReturns.length, marketReturns.length);
            if (n < 2) return null;
            var a = assetReturns.slice(-n), b = marketReturns.slice(-n);
            var ma = a.reduce(function (x, y) { return x + y; }, 0) / n;
            var mb = b.reduce(function (x, y) { return x + y; }, 0) / n;
            var cov = 0, varb = 0;
            for (var i = 0; i < n; i++) { cov += (a[i] - ma) * (b[i] - mb); varb += (b[i] - mb) * (b[i] - mb); }
            return varb === 0 ? null : cov / varb;
        },
        sharpe: function (returns, riskFree, periodsPerYear) {
            periodsPerYear = periodsPerYear || 252;
            if (!returns || returns.length < 2) return null;
            var m = returns.reduce(function (a, b) { return a + b; }, 0) / returns.length;
            var annRet = m * periodsPerYear;
            var vol = this.volatility(returns, periodsPerYear);
            if (!vol) return null;
            return (annRet - (riskFree || 0)) / vol;
        },
        maxDrawdown: function (closes) {
            if (!closes || closes.length < 2) return null;
            var peak = closes[0], mdd = 0;
            for (var i = 1; i < closes.length; i++) {
                if (closes[i] > peak) peak = closes[i];
                var dd = (closes[i] - peak) / peak;
                if (dd < mdd) mdd = dd;
            }
            return mdd; // negative fraction
        },
        positionSize: function (capital, riskPct, entry, stop) {
            if (!isNum(capital) || !isNum(riskPct) || !isNum(entry) || !isNum(stop) || entry === stop) return null;
            var riskPerShare = Math.abs(entry - stop);
            var riskCapital = capital * riskPct;
            return Math.floor(riskCapital / riskPerShare);
        }
    };

    /* ── score: the shared multi-factor engine (screener rows AND scorecards) ── */
    // Per-factor 0-100 scorers. Each returns null when its inputs are missing (→ excluded, confidence drops).
    function factorValue(s, B) {
        var parts = [normBand(s.pe, B.pe), normBand(s.pb, B.pb), normBand(s.evEbitda, B.evEbitda)].filter(function (x) { return x != null; });
        return parts.length ? Math.round(parts.reduce(function (a, b) { return a + b; }, 0) / parts.length) : null;
    }
    function factorQuality(s, B) {
        var parts = [normBand(s.roe, B.roe), normBand(s.netMargin, B.netMargin), normBand(s.debtEquity, B.debtEquity)].filter(function (x) { return x != null; });
        return parts.length ? Math.round(parts.reduce(function (a, b) { return a + b; }, 0) / parts.length) : null;
    }
    function factorMomentum(s, B) {
        var parts = [normBand(s.chgPct, B.chgPct), normBand(s.chg1m, B.chg1m)].filter(function (x) { return x != null; });
        return parts.length ? Math.round(parts.reduce(function (a, b) { return a + b; }, 0) / parts.length) : null;
    }
    function factorDividend(s, B) { return normBand(s.divYield, B.divYield); }
    function factorLiquidity(s, B) {
        var parts = [normBand(s.mcap, B.mcap), normBand(s.vol, B.vol)].filter(function (x) { return x != null; });
        return parts.length ? Math.round(parts.reduce(function (a, b) { return a + b; }, 0) / parts.length) : null;
    }
    function factorFloat(s, B) { return normBand(s.floatPct, B.floatPct); }
    function factorTechnical(s) { return isNum(s.technical) ? clamp(Math.round(s.technical), 0, 100) : null; }

    function verdictFor(score) {
        var b = DATA.verdictBands;
        for (var i = 0; i < b.length; i++) { if (score >= b[i].min) return b[i].label; }
        return b[b.length - 1].label;
    }
    function floatLabel(fp) {
        if (!isNum(fp)) return null;
        var fb = DATA.floatBands;
        if (fp < fb.trap) return 'float-trap';
        if (fp < fb.tight) return 'tight';
        if (fp >= fb.institutional) return 'institutional';
        return 'moderate';
    }

    var score = {
        /**
         * Score one stock. `s` fields (any may be missing): pe, pb, evEbitda, roe, netMargin,
         * debtEquity, chgPct, chg1m, divYield, mcap, vol, floatPct, technical(0-100 gauge).
         * opts: { preset: 'balanced'|…, market: 'US'|'ID' }.
         * Returns { score, verdict, factors, rationale, confidence, disclaimer }.
         */
        stock: function (s, opts) {
            opts = opts || {};
            s = s || {};
            var B = DATA.scoreBands;
            var W = DATA.factorWeights[opts.preset] || DATA.factorWeights.balanced;
            var factors = {
                value: factorValue(s, B),
                quality: factorQuality(s, B),
                momentum: factorMomentum(s, B),
                dividend: factorDividend(s, B),
                liquidity: factorLiquidity(s, B),
                float: factorFloat(s, B),
                technical: factorTechnical(s)
            };
            // Weighted blend over factors that have data; re-normalize weights; confidence = weight covered.
            var num = 0, wsum = 0, wtotal = 0, k;
            for (k in W) { if (W.hasOwnProperty(k)) {
                wtotal += W[k];
                if (factors[k] != null) { num += factors[k] * W[k]; wsum += W[k]; }
            } }
            var composite = wsum > 0 ? Math.round(num / wsum) : null;
            var confidence = wtotal > 0 ? Math.round((wsum / wtotal) * 100) / 100 : 0;

            var rationale = [];
            if (composite != null) {
                var order = ['value', 'quality', 'momentum', 'dividend', 'float', 'technical', 'liquidity'];
                var labels = { value: 'Value', quality: 'Quality', momentum: 'Momentum', dividend: 'Dividend', float: 'Free-float', technical: 'Technical', liquidity: 'Liquidity' };
                for (var oi = 0; oi < order.length; oi++) {
                    var f = order[oi], val = factors[f];
                    if (val == null) continue;
                    var tone = val >= 67 ? 'strong' : val >= 45 ? 'moderate' : 'weak';
                    var extra = '';
                    if (f === 'float' && isNum(s.floatPct)) extra = ' (' + Math.round(s.floatPct * 100) + '% — ' + floatLabel(s.floatPct) + ')';
                    if (f === 'value' && isNum(s.pe)) extra = ' (P/E ' + r2(s.pe) + ')';
                    if (f === 'momentum' && isNum(s.chgPct)) extra = ' (' + (s.chgPct >= 0 ? '+' : '') + r2(s.chgPct) + '% today)';
                    if (f === 'dividend' && isNum(s.divYield)) extra = ' (' + r2(s.divYield * 100) + '% yield)';
                    rationale.push(labels[f] + ': ' + tone + ' (' + val + '/100)' + extra + '.');
                }
                var isIDmkt = opts.market && String(opts.market).toUpperCase() === 'ID';
                if (confidence < 0.6) rationale.push('Limited data — score based on ' + Math.round(confidence * 100) + '% of factor weight' + (isIDmkt ? ' (Indonesian fundamentals are limited on free data)' : '') + '.');
            }
            rationale.push(DISCLAIMER);

            return {
                score: composite,
                verdict: composite == null ? null : verdictFor(composite),
                factors: factors,
                rationale: rationale,
                confidence: confidence,
                disclaimer: DISCLAIMER
            };
        },
        /** Score + rank a list of stocks. Returns the list with {..., score, rank} sorted desc. Ties: mcap desc. */
        rank: function (list, opts) {
            if (!list) return [];
            var scored = list.map(function (s) {
                var res = score.stock(s, opts);
                var out = {}; for (var k in s) { if (s.hasOwnProperty(k)) out[k] = s[k]; }
                out.score = res.score; out.verdict = res.verdict; out.factors = res.factors;
                out.confidence = res.confidence; out.rationale = res.rationale;
                return out;
            });
            scored.sort(function (a, b) {
                var as = a.score == null ? -1 : a.score, bs = b.score == null ? -1 : b.score;
                if (bs !== as) return bs - as;
                return (b.mcap || 0) - (a.mcap || 0);
            });
            for (var i = 0; i < scored.length; i++) scored[i].rank = i + 1;
            return scored;
        },
        factorLabel: floatLabel
    };

    /* ── portfolio ── */
    var portfolio = {
        equalWeights: function (n) { if (!n || n <= 0) return []; var w = 1 / n, a = []; for (var i = 0; i < n; i++) a.push(w); return a; },
        scoreWeights: function (scores) {
            if (!scores || !scores.length) return [];
            var pos = scores.map(function (s) { return Math.max(0, s || 0); });
            var tot = pos.reduce(function (a, b) { return a + b; }, 0);
            if (tot === 0) return portfolio.equalWeights(scores.length);
            return pos.map(function (s) { return s / tot; });
        },
        /** Pearson correlation of two return series. */
        correlation: function (a, b) {
            if (!a || !b) return null;
            var n = Math.min(a.length, b.length);
            if (n < 2) return null;
            var x = a.slice(-n), y = b.slice(-n);
            var mx = x.reduce(function (p, q) { return p + q; }, 0) / n;
            var my = y.reduce(function (p, q) { return p + q; }, 0) / n;
            var sxy = 0, sxx = 0, syy = 0;
            for (var i = 0; i < n; i++) { var dx = x[i] - mx, dy = y[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
            return (sxx === 0 || syy === 0) ? null : sxy / Math.sqrt(sxx * syy);
        },
        /** 0-1 diversification: 1 - average pairwise correlation. */
        diversification: function (returnsMatrix) {
            if (!returnsMatrix || returnsMatrix.length < 2) return null;
            var sum = 0, cnt = 0;
            for (var i = 0; i < returnsMatrix.length; i++) {
                for (var j = i + 1; j < returnsMatrix.length; j++) {
                    var c = portfolio.correlation(returnsMatrix[i], returnsMatrix[j]);
                    if (c != null) { sum += c; cnt++; }
                }
            }
            return cnt === 0 ? null : Math.round((1 - sum / cnt) * 100) / 100;
        }
    };

    /* ====================================================================
     * IV. FORMAT
     * ==================================================================== */
    function abbrev(n) {
        if (!isNum(n)) return '—';
        var a = Math.abs(n), sign = n < 0 ? '-' : '';
        if (a >= 1e12) return sign + (a / 1e12).toFixed(2) + 'T';
        if (a >= 1e9) return sign + (a / 1e9).toFixed(2) + 'B';
        if (a >= 1e6) return sign + (a / 1e6).toFixed(2) + 'M';
        if (a >= 1e3) return sign + (a / 1e3).toFixed(1) + 'K';
        return sign + a.toFixed(0);
    }
    function formatCurrency(n, ccy) {
        if (!isNum(n)) return '—';
        var c = DATA.currency[ccy] || DATA.currency.USD;
        var abs = Math.abs(n);
        if (abs >= 1e6) return c.symbol + abbrev(n);
        return c.symbol + n.toLocaleString('en-US', { minimumFractionDigits: c.decimals, maximumFractionDigits: c.decimals });
    }
    var format = {
        currency: formatCurrency,
        abbrev: abbrev,
        percent: function (n, dec) { return isNum(n) ? (n >= 0 ? '+' : '') + n.toFixed(dec == null ? 2 : dec) + '%' : '—'; },
        ticker: function (sym) { return typeof sym === 'string' ? sym.replace(/\.JK$/, '') : sym; },
        marketOf: function (sym) { return (typeof sym === 'string' && /\.JK$/.test(sym)) ? 'ID' : 'US'; }
    };

    /* ====================================================================
     * V. EVENTS (lightweight bus, mirrors rz-engine)
     * ==================================================================== */
    var listeners = {};
    var events = {
        dispatch: function (action, detail) {
            try { root.dispatchEvent(new root.CustomEvent('fin-' + action, { detail: detail })); } catch (e) {}
            (listeners[action] || []).forEach(function (fn) { try { fn(detail); } catch (e) {} });
        },
        on: function (action, fn) {
            (listeners[action] = listeners[action] || []).push(fn);
            return function () { listeners[action] = (listeners[action] || []).filter(function (f) { return f !== fn; }); };
        },
        off: function (action, fn) { listeners[action] = (listeners[action] || []).filter(function (f) { return f !== fn; }); }
    };

    /* ====================================================================
     * Engine assembly
     * ==================================================================== */
    var FINEngine = {
        version: DATA.version,
        DISCLAIMER: DISCLAIMER,
        data: DATA,
        models: {
            ratios: ratios,
            valuation: valuation,
            technical: technical,
            risk: risk,
            score: score,
            portfolio: portfolio
        },
        format: format,
        events: events
    };

    root.FINEngine = FINEngine;
    try { root.dispatchEvent(new root.CustomEvent('fin-engine-ready', { detail: FINEngine })); } catch (e) {}

})(typeof window !== 'undefined' ? window : this);
