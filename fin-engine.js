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
                { sym: 'BUMI.JK', name: 'Bumi Resources', sector: 'Energy' },
                { sym: 'ADRO.JK', name: 'Alamtri Resources (Adaro)', sector: 'Energy' },
                { sym: 'AKRA.JK', name: 'AKR Corporindo', sector: 'Energy' },
                { sym: 'AMRT.JK', name: 'Sumber Alfaria Trijaya', sector: 'Consumer Staples' },
                { sym: 'ARTO.JK', name: 'Bank Jago', sector: 'Financials' },
                { sym: 'BRPT.JK', name: 'Barito Pacific', sector: 'Materials' },
                { sym: 'CPIN.JK', name: 'Charoen Pokphand Indonesia', sector: 'Consumer Staples' },
                { sym: 'EMTK.JK', name: 'Elang Mahkota Teknologi', sector: 'Communication' },
                { sym: 'EXCL.JK', name: 'XL Axiata', sector: 'Communication' },
                { sym: 'GOTO.JK', name: 'GoTo Gojek Tokopedia', sector: 'Technology' },
                { sym: 'HRUM.JK', name: 'Harum Energy', sector: 'Energy' },
                { sym: 'INKP.JK', name: 'Indah Kiat Pulp & Paper', sector: 'Materials' },
                { sym: 'INTP.JK', name: 'Indocement Tunggal Prakarsa', sector: 'Materials' },
                { sym: 'ISAT.JK', name: 'Indosat Ooredoo Hutchison', sector: 'Communication' },
                { sym: 'MAPI.JK', name: 'Mitra Adiperkasa', sector: 'Consumer Discretionary' },
                { sym: 'MDKA.JK', name: 'Merdeka Copper Gold', sector: 'Materials' },
                { sym: 'MEDC.JK', name: 'Medco Energi Internasional', sector: 'Energy' },
                { sym: 'PGEO.JK', name: 'Pertamina Geothermal Energy', sector: 'Energy' },
                { sym: 'SIDO.JK', name: 'Sido Muncul', sector: 'Healthcare' },
                { sym: 'SRTG.JK', name: 'Saratoga Investama Sedaya', sector: 'Financials' },
                { sym: 'TOWR.JK', name: 'Sarana Menara Nusantara', sector: 'Communication' },
                { sym: 'TPIA.JK', name: 'Chandra Asri Pacific', sector: 'Materials' },
                { sym: 'UNVR.JK', name: 'Unilever Indonesia', sector: 'Consumer Staples' }
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

        // Berkshire-style value-gate config (adapted from xbtlin/ai-berkshire, deterministic).
        valueGate: {
            roeMin: 0.15,        // sustained ROE quality threshold
            deMax: 0.5,          // Debt/Equity — quality businesses stay below this
            marginMin: 0.10,     // healthy net margin
            weights: { valuation: 0.30, moat: 0.25, growth: 0.20, risk: 0.15, certainty: 0.10 },
            pass: 65, gray: 45   // composite score → pass ≥65, gray 45-64, fail <45
        },
        // Market P/E medians for the "PE below median" value check.
        peMedian: { US: 20, ID: 15 },
        // Baseline economic-moat score by sector (1-5) — heuristic proxy (durable-franchise sectors higher).
        moatBySector: {
            'Technology': 4, 'Consumer Staples': 4, 'Healthcare': 4, 'Communication': 3,
            'Consumer Discretionary': 3, 'Financials': 3, 'Industrials': 3, 'Utilities': 3,
            'Real Estate': 3, 'Energy': 2, 'Materials': 2, 'default': 3
        },

        // Sourced IDX fundamentals (free-float from issuer ownership disclosures; pe/pb/roe are
        // issuer-disclosure SNAPSHOTS, per-ticker as-of — NOT live). Lets the Indonesian screener +
        // scorecard score the Free-float (and some Value/Quality) factors, since Finnhub free has no
        // IDX coverage. Values compiled from the StockMap sourced ledger. Missing fields → factor n/a.
        idxFundamentals: {
            'BBCA.JK': { freeFloat: 0.4506, pe: 22.1, pb: 4.8, roe: 0.214, asOf: '31 Dec 2024' },
            'BBRI.JK': { freeFloat: 0.415, pe: 11.9, pb: 2.2, roe: 0.191, asOf: '31 Dec 2023' },
            'TLKM.JK': { freeFloat: 0.439, pe: 10.8, pb: 1.8, roe: 0.165, asOf: '31 Dec 2024' },
            'BMRI.JK': { freeFloat: 0.444, pe: 10.7, pb: 2.1, roe: 0.202, asOf: '30 Sep 2025' },
            'BBNI.JK': { freeFloat: 0.406, pe: 9.8, pb: 1.4, roe: 0.151, asOf: '31 Jan 2026' },
            'ASII.JK': { freeFloat: 0.4989, pe: 8.9, pb: 1.5, roe: 0.172, asOf: '28 Feb 2026' },
            'TINS.JK': { freeFloat: 0.35, pe: 7.8, pb: 0.9, roe: 0.113, asOf: '2025' },
            'ITMG.JK': { freeFloat: 0.3486, pe: 6.4, pb: 1.6, roe: 0.226, asOf: '31 Aug 2025' },
            'GIAA.JK': { freeFloat: 0.0617, pb: 1.1, asOf: '2025' },
            'INDF.JK': { freeFloat: 0.4991, asOf: 'Dec 2025' },
            'ICBP.JK': { freeFloat: 0.1947, asOf: 'Mar 2025' },
            'WTON.JK': { freeFloat: 0.3422, asOf: '2025' },
            'WEGE.JK': { freeFloat: 0.30, asOf: '2025' },
            'AUTO.JK': { freeFloat: 0.20, asOf: '2025' },
            'AALI.JK': { freeFloat: 0.2032, asOf: 'Mar 2025' },
            'WIKA.JK': { freeFloat: 0.0898, asOf: '2025' },
            'SMGR.JK': { freeFloat: 0.486, asOf: '2025' },
            'BUMI.JK': { freeFloat: 0.0206, pe: 7.2, pb: 1.1, roe: 0.084, asOf: '2025' }
        },

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
            'idxFundamentals': { source: 'StockMap sourced ledger — issuer disclosures (annual reports / IDX ownership pages)', asOf: '2024–2026 (per-ticker, see asOf)', unit: 'freeFloat fraction; pe/pb ratio; roe fraction', method: 'free-float from issuer ownership composition; pe/pb/roe are issuer-disclosure snapshots, not live' },
            'alphas.momentum_12_1': { source: 'Jegadeesh & Titman (1993), Returns to Buying Winners', asOf: '1993', method: 'return t-252→t-21 (12-1 momentum)' },
            'alphas.reversal_1m': { source: 'Jegadeesh (1990), Evidence of Predictable Behavior of Security Returns', asOf: '1990', method: 'contrarian: −(1-month return)' },
            'alphas.high_52w': { source: 'George & Hwang (2004), The 52-Week High and Momentum Investing', asOf: '2004', method: 'price ÷ trailing-252 high' },
            'alphas.low_vol': { source: 'Ang, Hodrick, Xing & Zhang (2006), low-volatility anomaly', asOf: '2006', method: 'inverse realized volatility' },
            'alphas.amihud_illiq': { source: 'Amihud (2002), Illiquidity and Stock Returns', asOf: '2002', method: 'mean(|ret|/dollar-volume)' },
            'alphas.gap_strength': { source: 'Kakushadze (2016), 101 Formulaic Alphas (arXiv:1601.00991)', asOf: '2016', method: '(close−open)/(high−low)' },
            'alphas.trend_200': { source: 'Standard trend-following (price vs 200-day MA + slope)', asOf: '2026', method: 'engine methodology' },
            'alphas.vol_trend': { source: 'Volume-interest heuristic (5-day vs 60-day avg volume)', asOf: '2026', method: 'engine methodology' },
            'committee': { source: 'Engine methodology — deterministic multi-panel consensus (adapts Vibe-Trading swarm pattern WITHOUT an LLM)', asOf: '2026', method: 'fundamental/technical/quant/risk panels vote → consensus + bull/bear case' },
            'valueGate': { source: 'xbtlin/ai-berkshire methodology + Buffett/Munger value criteria + Damodaran', asOf: '2026', method: 'ROE≥15% / D-E≤0.5 / margin / PE<median / moat → weighted composite → Pass/Gray/Fail (deterministic, no LLM; no price targets or position sizing)' },
            'peMedian': { source: 'Long-run market P/E medians (S&P 500 ~US / IDX ~ID)', asOf: '2026', unit: 'ratio' },
            'moatBySector': { source: 'Engine heuristic — durable-franchise proxy by GICS sector', asOf: '2026', method: '1-5 baseline; not a rating of a specific issuer' },
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

    /* ── alphas: a deterministic Factor Zoo (the no-LLM adaptation of Vibe-Trading's factor library).
     *    Each alpha is a PURE function of a daily candle series → { value, score(0-100), vote, label }.
     *    Formulas are the well-known academic/quant factors; cites are in DATA.sources. No prediction is
     *    promised — these are descriptive factor reads (see FINEngine.DISCLAIMER). ── */
    function closesOf(candles) { return (candles || []).filter(function (k) { return k && isFinite(k.c); }).map(function (k) { return k.c; }); }
    function retsFrom(closes) { var o = []; for (var i = 1; i < closes.length; i++) { if (closes[i - 1]) o.push(closes[i] / closes[i - 1] - 1); } return o; }
    function voteFrom(score) { return score >= 60 ? 'bull' : score <= 40 ? 'bear' : 'neutral'; }
    // Each factor: needs enough bars → else null. Bands chosen from typical equity distributions.
    var alphas = {
        // Jegadeesh-Titman 12-1 momentum: return from ~12m ago to ~1m ago (skip last month).
        momentum_12_1: function (candles) {
            var c = closesOf(candles); if (c.length < 252) return null;
            var v = c[c.length - 21] / c[c.length - 252] - 1;
            return { value: v, score: normBand(v, { lo: -0.30, hi: 0.50 }), vote: v > 0.05 ? 'bull' : v < -0.05 ? 'bear' : 'neutral', label: '12-1 momentum' };
        },
        // Short-term (1-month) reversal — contrarian: a sharp recent drop scores higher (bounce candidate).
        reversal_1m: function (candles) {
            var c = closesOf(candles); if (c.length < 22) return null;
            var r = c[c.length - 1] / c[c.length - 22] - 1;
            var s = normBand(-r, { lo: -0.15, hi: 0.15 });
            return { value: r, score: s, vote: 'neutral', label: '1-month reversal' };
        },
        // George-Hwang 52-week-high: proximity of price to its trailing 1-year high.
        high_52w: function (candles) {
            var c = closesOf(candles); if (c.length < 60) return null;
            var win = c.slice(-252), hi = Math.max.apply(null, win), px = c[c.length - 1];
            var prox = hi > 0 ? px / hi : null; if (prox == null) return null;
            return { value: prox, score: Math.round(clamp(prox, 0, 1) * 100), vote: prox > 0.95 ? 'bull' : prox < 0.70 ? 'bear' : 'neutral', label: '52-week-high proximity' };
        },
        // Low-volatility anomaly: lower realized vol scores higher.
        low_vol: function (candles) {
            var c = closesOf(candles); var r = retsFrom(c); if (r.length < 20) return null;
            var vol = risk.volatility(r); if (vol == null) return null;
            return { value: vol, score: normBand(vol, { lo: 0.10, hi: 0.60, invert: true }), vote: 'neutral', label: 'low volatility' };
        },
        // Trend vs 200-day average (+ direction). Above a rising SMA200 = healthy uptrend.
        trend_200: function (candles) {
            var c = closesOf(candles); if (c.length < 200) return null;
            var s200 = sma(c, 200), px = c[c.length - 1]; if (!s200) return null;
            var s200prev = sma(c.slice(0, c.length - 21), 200);
            var above = px / s200 - 1, rising = s200prev ? (s200 > s200prev) : true;
            var sc = normBand(above, { lo: -0.20, hi: 0.30 }); if (rising) sc = Math.min(100, sc + 8); else sc = Math.max(0, sc - 8);
            return { value: above, score: sc, vote: voteFrom(sc), label: 'trend vs 200-day' };
        },
        // Volume trend: recent 5-day vs 60-day average volume (rising interest).
        vol_trend: function (candles) {
            var rows = (candles || []).filter(function (k) { return k && isFinite(k.v); });
            if (rows.length < 60) return null;
            var vs = rows.map(function (k) { return k.v; });
            var recent = sma(vs, 5), base = sma(vs, 60); if (!base) return null;
            var ratio = recent / base;
            return { value: ratio, score: normBand(ratio, { lo: 0.5, hi: 2.5 }), vote: 'neutral', label: 'volume trend' };
        },
        // Amihud (2002) illiquidity: mean(|ret| / dollar-volume). Higher = more illiquid = risk → lower score.
        amihud_illiq: function (candles) {
            var rows = (candles || []).filter(function (k) { return k && isFinite(k.c) && isFinite(k.v) && k.v > 0; });
            if (rows.length < 22) return null;
            var acc = 0, n = 0;
            for (var i = 1; i < rows.length; i++) { var r = Math.abs(rows[i].c / rows[i - 1].c - 1); acc += r / (rows[i].v * rows[i].c); n++; }
            var illiq = n ? (acc / n) * 1e12 : null; if (illiq == null) return null;
            return { value: illiq, score: normBand(illiq, { lo: 0, hi: 5, invert: true }), vote: illiq > 5 ? 'bear' : 'neutral', label: 'Amihud illiquidity' };
        },
        // alpha101-style intraday strength: (close-open)/(high-low) of the last bar.
        gap_strength: function (candles) {
            var rows = (candles || []).filter(function (k) { return k && isFinite(k.c) && isFinite(k.o); });
            if (!rows.length) return null;
            var k = rows[rows.length - 1], rng = (k.h - k.l);
            var v = rng > 0 ? (k.c - k.o) / rng : 0;
            return { value: v, score: Math.round(clamp((v + 1) / 2, 0, 1) * 100), vote: 'neutral', label: 'intraday strength' };
        },
        /** Run all applicable alphas → { items:{name:res}, composite(0-100), votes:{bull,bear,neutral} }. */
        compute: function (candles) {
            var self = this, items = {}, scores = [], votes = { bull: 0, bear: 0, neutral: 0 };
            ['momentum_12_1', 'reversal_1m', 'high_52w', 'low_vol', 'trend_200', 'vol_trend', 'amihud_illiq', 'gap_strength'].forEach(function (k) {
                var r = self[k](candles);
                if (r && r.score != null) { items[k] = r; scores.push(r.score); votes[r.vote] = (votes[r.vote] || 0) + 1; }
            });
            var composite = scores.length ? Math.round(scores.reduce(function (a, b) { return a + b; }, 0) / scores.length) : null;
            return { items: items, composite: composite, votes: votes };
        }
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

    /* ── valueGate: deterministic Buffett/Munger value screen (adapted from ai-berkshire, NO LLM).
     *    Hard checks + a weighted composite → Pass/Gray/Fail, a "Mirror Test" (≤5 plain reasons), a moat
     *    heuristic, and a data-grade. Descriptive only — NO price targets / position sizing. ── */
    var valueGate = {
        run: function (stock, opts) {
            stock = stock || {}; opts = opts || {};
            var vg = DATA.valueGate, market = (opts.market && String(opts.market).toUpperCase() === 'ID') ? 'ID' : 'US';
            var peMed = DATA.peMedian[market] || DATA.peMedian.US;
            var checks = [], mirror = [], have = 0, tot = 0;

            function check(name, ok, detail) { tot++; if (ok != null) have++; checks.push({ name: name, pass: ok, detail: detail }); mirror.push((ok == null ? '— ' : (ok ? '✓ ' : '✗ ')) + detail); }
            // Hard value checks (each null when its input is missing).
            var roeOk = isNum(stock.roe) ? stock.roe >= vg.roeMin : null;
            check('ROE ≥ 15%', roeOk, isNum(stock.roe) ? ('ROE ' + Math.round(stock.roe * 100) + '% ' + (roeOk ? '≥' : '<') + ' 15%') : 'ROE n/a');
            var deOk = isNum(stock.debtEquity) ? stock.debtEquity <= vg.deMax : null;
            check('Debt/Equity ≤ 0.5', deOk, isNum(stock.debtEquity) ? ('D/E ' + r2(stock.debtEquity) + ' ' + (deOk ? '≤' : '>') + ' 0.5') : 'D/E n/a');
            var mgOk = isNum(stock.netMargin) ? stock.netMargin >= vg.marginMin : null;
            check('Net margin ≥ 10%', mgOk, isNum(stock.netMargin) ? ('Margin ' + Math.round(stock.netMargin * 100) + '%') : 'margin n/a');
            var peOk = isNum(stock.pe) && stock.pe > 0 ? stock.pe <= peMed : null;
            check('P/E ≤ market median', peOk, (isNum(stock.pe) && stock.pe > 0) ? ('P/E ' + r2(stock.pe) + ' vs ' + peMed + ' median') : 'P/E n/a');
            // Earnings yield vs a nominal risk-free proxy (from market riskFree).
            var rf = (DATA.markets[market] || DATA.markets.US).riskFree;
            var ey = (isNum(stock.pe) && stock.pe > 0) ? 1 / stock.pe : null;
            var eyOk = ey == null ? null : ey >= rf;
            check('Earnings yield ≥ risk-free', eyOk, ey == null ? 'yield n/a' : ('Earnings yield ' + Math.round(ey * 100) + '% vs rf ' + Math.round(rf * 100) + '%'));

            // Moat (heuristic): sector baseline (1-5) + durability bumps from ROE/margin.
            var moat = DATA.moatBySector[stock.sector] || DATA.moatBySector['default'];
            if (isNum(stock.roe) && stock.roe >= 0.20) moat += 0.5;
            if (isNum(stock.netMargin) && stock.netMargin >= 0.20) moat += 0.5;
            moat = clamp(Math.round(moat * 2) / 2, 1, 5);

            // Component scores (0-100), re-normalized over those with data.
            var B = DATA.scoreBands;
            var comp = {
                valuation: factorValue(stock, B),
                moat: Math.round((moat / 5) * 100),
                growth: isNum(stock.roe) ? normBand(stock.roe, B.roe) : (isNum(stock.chgPct) ? normBand(stock.chgPct, B.chgPct) : null),
                risk: isNum(stock.debtEquity) ? normBand(stock.debtEquity, B.debtEquity) : null,
                certainty: null // set from data-grade below
            };
            // Data breadth = distinct fundamental INPUTS present (pe feeds two checks, so count inputs not checks).
            var inputs = [isNum(stock.roe), isNum(stock.debtEquity), isNum(stock.netMargin), (isNum(stock.pe) && stock.pe > 0)].filter(function (x) { return x; }).length;
            var dataGrade = inputs >= 4 ? 'A' : inputs >= 2 ? 'B' : 'C';
            comp.certainty = dataGrade === 'A' ? 85 : dataGrade === 'B' ? 60 : 35;
            // Thin data: moat (sector heuristic) + certainty must NOT act as a scoring floor with <2 real inputs.
            if (inputs < 2) { comp.moat = null; comp.certainty = null; }

            var W = vg.weights, num = 0, ws = 0;
            for (var k in W) { if (W.hasOwnProperty(k) && comp[k] != null) { num += comp[k] * W[k]; ws += W[k]; } }
            // Need at least one real fundamental input — moat+certainty alone can't judge value.
            var scoreV = (inputs > 0 && ws > 0) ? Math.round(num / ws) : null;
            // Hard-rule overrides: a broken balance sheet (D/E>2) OR too-thin data (<2 inputs) can't earn a Pass.
            var capped = (isNum(stock.debtEquity) && stock.debtEquity > 2) || inputs < 2;
            var rating = scoreV == null ? null
                : (scoreV >= vg.pass ? (capped ? 'gray' : 'pass') : scoreV >= vg.gray ? 'gray' : 'fail');

            return {
                rating: rating, score: scoreV, checks: checks, moat: moat,
                mirrorTest: mirror.slice(0, 5), dataGrade: dataGrade, components: comp, disclaimer: DISCLAIMER
            };
        }
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

    /* ── committee: the deterministic "Investment Committee". Adapts Vibe-Trading's multi-agent swarm
     *    (analysts debate → consensus with a bull case + bear case) into fixed rule-based PANELS — NO LLM.
     *    Every output is a descriptive, disclaimed read (never a prediction). ── */
    var COMMITTEE_WEIGHTS = { Fundamental: 0.25, Value: 0.25, Technical: 0.20, Quant: 0.20, Risk: 0.10 };
    function verdictFromScore(s) { return s == null ? null : verdictFor(s); }
    var committee = {
        /**
         * @param stock  the fundamentals object (as for models.score.stock): pe,pb,roe,divYield,floatPct,…
         * @param candles daily candle series (≈1Y) for the technical/quant/risk panels.
         * @param opts   { preset, market }.
         * Returns { verdict, score, confidence, panels:[…], bullCase:[…], bearCase:[…], disclaimer }.
         */
        run: function (stock, candles, opts) {
            opts = opts || {}; stock = stock || {}; candles = candles || [];
            var panels = [], bull = [], bear = [];

            // ── Panel 1: Fundamental (reuses models.score) ──
            var f = score.stock(stock, opts);
            if (f.score != null) {
                var fsig = [];
                var flabels = { value: 'Value', quality: 'Quality', dividend: 'Dividend', float: 'Free-float' };
                ['value', 'quality', 'dividend', 'float'].forEach(function (k) {
                    var v = f.factors[k]; if (v == null) return;
                    fsig.push(flabels[k] + ' ' + v);
                    if (v >= 67) bull.push({ w: v, t: flabels[k] + ' is strong (' + v + '/100)' });
                    else if (v <= 40) bear.push({ w: 100 - v, t: flabels[k] + ' is weak (' + v + '/100)' });
                });
                panels.push({ name: 'Fundamental', score: f.score, verdict: f.verdict, signals: fsig });
            }

            // ── Panel 2: Value (Berkshire gate) — deterministic Buffett/Munger screen ──
            var vg = valueGate.run(stock, opts);
            if (vg.score != null) {
                var vsig = vg.checks.filter(function (c) { return c.pass != null; }).map(function (c) { return c.detail; });
                vsig.push('Moat ' + vg.moat + '/5');
                panels.push({ name: 'Value', score: vg.score, verdict: verdictFromScore(vg.score), signals: vsig });
                if (vg.rating === 'pass') bull.push({ w: 75, t: 'Passes the Berkshire value gate (quality + valuation)' });
                else if (vg.rating === 'fail') bear.push({ w: 65, t: 'Fails the Berkshire value gate' });
                if (vg.moat >= 4) bull.push({ w: 60, t: 'Wide moat (' + vg.moat + '/5)' });
                else if (vg.moat <= 2) bear.push({ w: 50, t: 'Narrow moat (' + vg.moat + '/5)' });
            }

            // ── Panel 3: Technical (reuses models.technical) ──
            if (candles.length) {
                var an = analyze(candles), g = an.gauge.score;
                var tsig = [an.signals.trend, an.signals.momentum, 'MA ' + an.signals.ma_cross, an.signals.volatility + ' vol'];
                panels.push({ name: 'Technical', score: g, verdict: verdictFromScore(g), signals: tsig });
                if (an.signals.trend === 'Bullish') bull.push({ w: 70, t: 'Technical trend is bullish (price above the 50-day)' });
                if (an.signals.trend === 'Bearish') bear.push({ w: 70, t: 'Technical trend is bearish (price below the 50-day)' });
                if (/Golden/.test(an.signals.ma_cross)) bull.push({ w: 60, t: '20/50 golden cross' });
                if (/Death/.test(an.signals.ma_cross)) bear.push({ w: 60, t: '20/50 death cross' });
                if (an.signals.momentum === 'Overbought') bear.push({ w: 55, t: 'RSI overbought (pullback risk)' });
                if (an.signals.momentum === 'Oversold') bull.push({ w: 55, t: 'RSI oversold (bounce candidate)' });
            }

            // ── Panel 4: Quant / Factor Zoo (models.alphas) ──
            var az = alphas.compute(candles);
            if (az.composite != null) {
                var qsig = Object.keys(az.items).map(function (k) { return az.items[k].label + ' ' + az.items[k].score; });
                panels.push({ name: 'Quant', score: az.composite, verdict: verdictFromScore(az.composite), signals: qsig });
                Object.keys(az.items).forEach(function (k) {
                    var it = az.items[k];
                    if (it.vote === 'bull') bull.push({ w: it.score, t: it.label + ' is favorable (' + it.score + '/100)' });
                    else if (it.vote === 'bear') bear.push({ w: 100 - it.score, t: it.label + ' is unfavorable (' + it.score + '/100)' });
                });
            }

            // ── Panel 5: Risk (volatility + drawdown + illiquidity) ──
            if (candles.length > 20) {
                var closes = closesOf(candles), rets = retsFrom(closes);
                var vol = risk.volatility(rets), mdd = risk.maxDrawdown(closes), illi = alphas.amihud_illiq(candles);
                var volS = vol == null ? null : normBand(vol, { lo: 0.10, hi: 0.60, invert: true });
                var mddS = mdd == null ? null : normBand(Math.abs(mdd), { lo: 0.10, hi: 0.60, invert: true });
                var parts = [volS, mddS, illi && illi.score].filter(function (x) { return x != null; });
                if (parts.length) {
                    var rscore = Math.round(parts.reduce(function (a, b) { return a + b; }, 0) / parts.length);
                    var rsig = [];
                    if (vol != null) rsig.push('Volatility ' + Math.round(vol * 100) + '%/yr');
                    if (mdd != null) rsig.push('Max drawdown ' + Math.round(mdd * 100) + '%');
                    if (illi) rsig.push('Liquidity ' + (illi.score >= 60 ? 'deep' : illi.score >= 40 ? 'ok' : 'thin'));
                    panels.push({ name: 'Risk', score: rscore, verdict: verdictFromScore(rscore), signals: rsig });
                    if (vol != null && vol > 0.5) bear.push({ w: 60, t: 'High volatility (' + Math.round(vol * 100) + '%/yr)' });
                    if (mdd != null && mdd < -0.4) bear.push({ w: 55, t: 'Deep max drawdown (' + Math.round(mdd * 100) + '%)' });
                    if (illi && illi.score < 40) bear.push({ w: 50, t: 'Thin liquidity (Amihud)' });
                }
            }

            // ── Consensus: weight the panels present; re-normalize over available weight ──
            var num = 0, wsum = 0, wtot = 0;
            for (var wk in COMMITTEE_WEIGHTS) { if (COMMITTEE_WEIGHTS.hasOwnProperty(wk)) wtot += COMMITTEE_WEIGHTS[wk]; }
            panels.forEach(function (pn) { var w = COMMITTEE_WEIGHTS[pn.name] || 0; num += pn.score * w; wsum += w; });
            var consensus = wsum > 0 ? Math.round(num / wsum) : null;
            var confidence = wtot > 0 ? Math.round((wsum / wtot) * 100) / 100 : 0;

            // top supporting / opposing signals (dedup by text, strongest first)
            function top(list) {
                var seen = {}, out = [];
                list.sort(function (a, b) { return b.w - a.w; });
                for (var i = 0; i < list.length && out.length < 4; i++) { if (!seen[list[i].t]) { seen[list[i].t] = 1; out.push(list[i].t); } }
                return out;
            }

            // ── Conviction (descriptive, NOT a position size): consensus × confidence × panel agreement ──
            var side = consensus == null ? 0 : (consensus >= 55 ? 1 : consensus <= 45 ? -1 : 0);
            var agree = 0;
            panels.forEach(function (pn) { var s = pn.score >= 55 ? 1 : pn.score <= 45 ? -1 : 0; if (s === side && side !== 0) agree++; });
            var agreement = panels.length ? agree / panels.length : 0;
            // High conviction needs real fundamentals at a decent grade — no-data or grade-C caps at Medium.
            var gradeOk = vg.score != null && vg.dataGrade !== 'C';
            var conviction = (side !== 0 && confidence >= 0.6 && agreement >= 0.66 && gradeOk) ? 'High'
                : (side !== 0 && confidence >= 0.4 && agreement >= 0.5) ? 'Medium' : 'Low';

            return {
                verdict: verdictFromScore(consensus),
                score: consensus,
                confidence: confidence,
                conviction: conviction,
                panels: panels,
                bullCase: top(bull),
                bearCase: top(bear),
                valueGate: (vg.score != null ? vg : null),
                dataGrade: (vg.score != null ? vg.dataGrade : null),
                disclaimer: DISCLAIMER
            };
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
    // Merge sourced IDX fundamentals (free-float + snapshot pe/pb/roe) into a stock object, filling
    // ONLY fields the caller left null/undefined. Returns the enriched object. No-op for non-.JK.
    function idxEnrich(sym, stock) {
        stock = stock || {};
        var f = DATA.idxFundamentals[sym];
        if (!f) return stock;
        ['freeFloat', 'pe', 'pb', 'roe'].forEach(function (k) {
            var target = k === 'freeFloat' ? 'floatPct' : k;
            if ((stock[target] == null) && isNum(f[k])) stock[target] = f[k];
        });
        return stock;
    }

    var FINEngine = {
        version: DATA.version,
        DISCLAIMER: DISCLAIMER,
        data: DATA,
        idxEnrich: idxEnrich,
        models: {
            ratios: ratios,
            valuation: valuation,
            technical: technical,
            risk: risk,
            score: score,
            alphas: alphas,
            valueGate: valueGate,
            committee: committee,
            portfolio: portfolio
        },
        format: format,
        events: events
    };

    root.FINEngine = FINEngine;
    try { root.dispatchEvent(new root.CustomEvent('fin-engine-ready', { detail: FINEngine })); } catch (e) {}

})(typeof window !== 'undefined' ? window : this);
