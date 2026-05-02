/**
 * rz-engine.js — ResistanceZero Super Engine
 *
 * Single-source-of-truth library for static-HTML calculators.
 * See standarization/SUPER_ENGINE.md for full design.
 *
 * Load order: auth.js -> rz-engine.js -> article IIFE.
 * No build step. Vanilla ES5/ES6. No external dependencies.
 *
 * Phase: S0–S4 (skeleton + auth + workforce/roi/forecast + capex/opex/tco/pue)
 * Provides:
 *   - RZEngine.data           Single source of truth for site-wide constants.
 *   - RZEngine.auth.*         Login/session/event helpers (S1).
 *   - RZEngine.format.*       Currency / number / date formatters.
 *   - RZEngine.events.*       Custom-event bus.
 *   - RZEngine.models.*       Full calc math: workforce, roi, forecast, capex, opex, tco, pue (S2+S4).
 */
(function (root) {
    'use strict';

    if (root.RZEngine) {
        try { console.warn('[RZEngine] already loaded; skipping re-init'); } catch (e) {}
        return;
    }

    /* ====================================================================
     * I. DATA — single source of truth for site-wide constants
     *
     * Editing any value here updates EVERY calculator on the site that
     * consumes it. Bump `version` and add a CHANGELOG entry on any change.
     * ==================================================================== */
    var DATA = {
        version: '1.2.0',
        lastUpdated: '2026-04-28',

        // Target-Year selector — used by every forecasting calculator
        years: [2025, 2026, 2027, 2028, 2029, 2030],
        baselineYear: 2025,

        // Regional cost variance — single source for cross-calculator consistency
        regions: {
            US:    { salaryMult: 1.00, powerKwh: 0.12, label: 'United States',  currency: 'USD' },
            EU:    { salaryMult: 0.85, powerKwh: 0.30, label: 'Europe',         currency: 'EUR' },
            APAC:  { salaryMult: 0.45, powerKwh: 0.10, label: 'Asia-Pacific',   currency: 'USD' },
            LATAM: { salaryMult: 0.55, powerKwh: 0.15, label: 'Latin America',  currency: 'USD' }
        },

        // Static currency rates (USD = 1.0 baseline). Update annually.
        currency: { USD: 1.0, EUR: 0.92, IDR: 15700, SGD: 1.34, GBP: 0.79 },

        // Annual inflation rate per region (flat for v1.0; year-by-year curve planned for v1.1)
        inflationAnnual: { US: 0.025, EU: 0.022, APAC: 0.030, LATAM: 0.045 },

        // DC workforce salary benchmarks (verified 2026-04-28: Uptime 2024, AFCOM 2024, BLS 2024)
        salaryBenchmarks: {
            dcTechMid:             { US: 75100,  EU: 64000, APAC: 34000, LATAM: 41000 },
            electricianJourneyman: { US: 120000, EU: 92000, APAC: 38000, LATAM: 54000 },
            cdfomSenior:           { US: 155000, EU: 132000, APAC: 78000, LATAM: 95000 }
        },

        // Workforce attrition factors (Center for American Progress, DataX Connect 2024)
        attritionFactors: {
            replacementCostMult:   2.13,  // 213% of annual salary to replace specialised DC role
            voluntaryAttritionAvg: 0.25,  // 25% — DataX Connect 2024 industry baseline
            apprenticeRetention:   0.78   // 4-year DOL apprenticeship retention rate
        },

        // PUE defaults by cooling architecture (Tier III baseline)
        pueDefaults: {
            airCooledTier3:    1.58,
            liquidCooledTier3: 1.20,
            immersionTier3:    1.05
        },

        // Capex per-MW build cost ranges (USD, raw build excluding land/IT). Tier-2 baseline.
        // Sources: 451 Research 2024, JLL DC Operating Cost 2024, Cushman & Wakefield 2024.
        capexPerMw: {
            airCooledTier2:    7500000,   // $7.5M/MW
            airCooledTier3:    10500000,  // $10.5M/MW (mainstream hyperscale)
            airCooledTier4:    14000000,  // $14M/MW
            liquidCooledTier3: 12500000,  // $12.5M/MW
            immersionTier3:    15000000   // $15M/MW (premium for immersion infra)
        },

        // MEP percentage of total raw construction CAPEX (industry typical range 35-45%)
        mepPctOfCapex: { tier2: 0.36, tier3: 0.42, tier4: 0.48 },

        // Modular construction premium vs stick-built (negative = cheaper, positive = costlier)
        modularPremiumPct: { tier2: -0.05, tier3: 0.08, tier4: 0.15 },

        // Hours per year (constant, exposed for clarity in formulas)
        hoursPerYear: 8760
    };

    /* ====================================================================
     * II. AUTH — session management compatible with auth.js
     *
     * Session format (matches auth.js, see /home/baguspermana7/rz-work/auth.js:159):
     *   { email, tier, role, expires: ISOString }
     *
     * Listens for navbar login/logout via 'rz-auth-change' custom event.
     * ==================================================================== */
    var SESSION_KEY = 'rz_premium_session';
    var SESSION_DAYS = 30;

    var VALID_USERS = [
        { email: 'demo@resistancezero.com',    password: 'demo2026',          tier: 'pro', role: 'demo' },
        { email: 'bagus@resistancezero.com',   password: 'RZ@Premium2026!',   tier: 'pro', role: 'admin' },
        { email: 'admin@resistancezero.com',   password: 'RZ@Premium2026!',   tier: 'pro', role: 'admin' },
        { email: 'premium@resistancezero.com', password: 'RZ@Premium2026!',   tier: 'pro', role: 'premium' }
    ];

    /**
     * Validate credentials against the hardcoded user list.
     * @param {string} email Case-insensitive
     * @param {string} pass
     * @returns {object|null} matched user (without password) or null
     */
    function validateLogin(email, pass) {
        if (!email || !pass) return null;
        var normalised = ('' + email).trim().toLowerCase();
        for (var i = 0; i < VALID_USERS.length; i++) {
            var u = VALID_USERS[i];
            if (u.email === normalised && u.password === pass) {
                return { email: u.email, tier: u.tier, role: u.role };
            }
        }
        return null;
    }

    /**
     * Read the active session from localStorage. Accepts both auth.js
     * format ({expires:ISOString}) and the legacy IIFE format ({exp:number}).
     * @returns {object|null} session or null if missing/expired
     */
    function getSession() {
        try {
            var raw = root.localStorage && root.localStorage.getItem(SESSION_KEY);
            if (!raw) return null;
            var s = JSON.parse(raw);
            if (!s) return null;
            var nowMs = Date.now();
            var expValid = false;
            if (s.expires) {
                expValid = new Date(s.expires).getTime() > nowMs;
            } else if (s.exp) {
                expValid = s.exp > nowMs;
            }
            if (!expValid) {
                try { root.localStorage.removeItem(SESSION_KEY); } catch (e) {}
                return null;
            }
            return { email: s.email, tier: s.tier || 'pro', role: s.role || 'admin', expires: s.expires };
        } catch (e) { return null; }
    }

    /**
     * Write a session with 30-day expiry in auth.js-compatible format.
     * Does NOT dispatch rz-auth-change — caller decides via dispatchAuthChange.
     */
    function setSession(email, tier, role) {
        var expires = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
        var payload = { email: email, tier: tier || 'pro', role: role || 'admin', expires: expires };
        try { root.localStorage.setItem(SESSION_KEY, JSON.stringify(payload)); } catch (e) {}
        return payload;
    }

    /** Clear the session and emit a 'logout' rz-auth-change event. */
    function logout() {
        try { root.localStorage.removeItem(SESSION_KEY); } catch (e) {}
        dispatchAuthChange('logout', {});
    }

    /** Emit a 'rz-auth-change' CustomEvent. */
    function dispatchAuthChange(action, detail) {
        try {
            detail = detail || {};
            detail.action = action;
            root.dispatchEvent(new root.CustomEvent('rz-auth-change', { detail: detail }));
        } catch (e) {}
    }

    /** Subscribe to 'rz-auth-change' events. Returns an unsubscribe function. */
    function onAuthChange(fn) {
        var handler = function (e) {
            if (!e || !e.detail) return;
            try { fn(e.detail.action, e.detail); } catch (err) {}
        };
        root.addEventListener('rz-auth-change', handler);
        return function () { root.removeEventListener('rz-auth-change', handler); };
    }

    /* ====================================================================
     * III. FORMAT — display formatters
     * ==================================================================== */
    var CURRENCY_SYMBOL = { USD: '$', EUR: '€', IDR: 'Rp', SGD: 'S$', GBP: '£' };

    function formatCurrency(n, region) {
        if (n == null || isNaN(n)) return '—';
        var rdata = (region && DATA.regions[region.toUpperCase()]) || DATA.regions.US;
        var sym = CURRENCY_SYMBOL[rdata.currency] || '$';
        var abs = Math.abs(n);
        if (abs >= 1e9) return sym + (n / 1e9).toFixed(2) + 'B';
        if (abs >= 1e6) return sym + (n / 1e6).toFixed(2) + 'M';
        if (abs >= 1e3) return sym + Math.round(n / 1e3) + 'K';
        return sym + Math.round(n);
    }

    function formatPercent(n, decimals) {
        if (n == null || isNaN(n)) return '—';
        return (n * 100).toFixed(decimals == null ? 1 : decimals) + '%';
    }

    function formatNumber(n) {
        if (n == null || isNaN(n)) return '—';
        return Math.round(n).toLocaleString('en-US');
    }

    function formatWeeks(n) {
        if (n == null || isNaN(n) || n <= 0) return '—';
        if (n < 1) return Math.round(n * 7) + ' d';
        if (n < 52) return Math.round(n) + ' wk';
        return (n / 52).toFixed(1) + ' yr';
    }

    function formatMonths(n) {
        if (n == null || isNaN(n) || n <= 0) return '—';
        if (n < 12) return Math.round(n) + ' mo';
        return (n / 12).toFixed(1) + ' yr';
    }

    function formatYmd(d) {
        if (!d) return '';
        var date = (d instanceof Date) ? d : new Date(d);
        if (isNaN(date.getTime())) return '';
        var pad = function (x) { return x < 10 ? '0' + x : '' + x; };
        return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
    }

    /* ====================================================================
     * IV. EVENTS — generic custom-event bus (auth events use 'rz-auth-change')
     * ==================================================================== */
    function dispatchEvent(action, detail) {
        try {
            root.dispatchEvent(new root.CustomEvent('rz-' + action, { detail: detail || {} }));
        } catch (e) {}
    }

    function onEvent(action, fn) {
        var handler = function (e) { try { fn(e && e.detail); } catch (err) {} };
        root.addEventListener('rz-' + action, handler);
        return function () { root.removeEventListener('rz-' + action, handler); };
    }

    function offEvent(action, fn) {
        // For symmetry; callers should prefer the unsubscribe function returned by onEvent().
        // This is a no-op for anonymous handlers; documented limitation.
    }

    /* ====================================================================
     * Engine assembly
     * ==================================================================== */
    var RZEngine = {
        data: DATA,

        auth: {
            VALID_USERS: VALID_USERS.map(function (u) { return { email: u.email, tier: u.tier, role: u.role }; }),
            validateLogin: validateLogin,
            getSession: getSession,
            setSession: setSession,
            logout: logout,
            dispatchAuthChange: dispatchAuthChange,
            onAuthChange: onAuthChange
        },

        format: {
            currency: formatCurrency,
            percent: formatPercent,
            number: formatNumber,
            weeks: formatWeeks,
            months: formatMonths,
            ymd: formatYmd
        },

        events: {
            dispatch: dispatchEvent,
            on: onEvent,
            off: offEvent
        },

        // Math models — domain-specific calculations sharing engine constants.
        // S2 ships workforce + roi + forecast. capex/opex/tco/pue follow in S4/S6.
        models: {
            workforce: {
                /**
                 * Annual hires required to close the staffing gap by target year,
                 * including replacement of attrition losses.
                 */
                annualHiresRequired: function (currentStaff, targetStaff, attritionRate, yearsToTarget) {
                    var gap = Math.max(0, (targetStaff || 0) - (currentStaff || 0));
                    var years = Math.max(1, yearsToTarget || 1);
                    var attrition = (attritionRate || 0) / 100;
                    var attritionLossPerYear = (currentStaff || 0) * attrition;
                    return Math.ceil((gap + attritionLossPerYear * years) / years);
                },

                /**
                 * Annual cost of attrition (replacing voluntary leavers).
                 * Uses RZEngine.data.attritionFactors.replacementCostMult by default (213%).
                 */
                attritionCost: function (staff, attritionRate, avgSalary, replacementMult) {
                    var mult = replacementMult || DATA.attritionFactors.replacementCostMult;
                    return Math.round((staff || 0) * ((attritionRate || 0) / 100) * (avgSalary || 0) * mult);
                },

                /**
                 * 0.0–1.0 fit score for a strategy given workforce mix.
                 * `mix.phys` and `mix.noc` should sum to 1.0.
                 */
                strategyFitScore: function (strategy, mix) {
                    if (!strategy || !mix) return 0;
                    var physScore = strategy.ph ? 1.0 : 0.2;
                    var nocScore = strategy.nc ? 1.0 : 0.2;
                    return Math.min(1.0, physScore * (mix.phys || 0.5) + nocScore * (mix.noc || 0.5));
                },

                /**
                 * Cumulative hires over a horizon, applying a retention factor.
                 * `retentionFactor` defaults to RZEngine.data.attritionFactors.apprenticeRetention.
                 */
                cumulativeHires: function (annualHires, years, retentionFactor) {
                    var retain = retentionFactor == null ? DATA.attritionFactors.apprenticeRetention : retentionFactor;
                    return Math.round((annualHires || 0) * (years || 0) * retain);
                },

                /** Years required to close gap at the projected effective hire rate. */
                yearsToCloseGap: function (staffGap, annualHires, strategyCoverage) {
                    var effective = (annualHires || 0) * Math.max(0.3, strategyCoverage || 0.3);
                    if (!effective || !staffGap || staffGap <= 0) return 0;
                    return Math.ceil(staffGap / effective);
                }
            },

            roi: {
                /** Payback period in years. Returns Infinity if never recovered. */
                paybackPeriod: function (initialCost, annualBenefit, annualCost) {
                    var net = (annualBenefit || 0) - (annualCost || 0);
                    if (net <= 0) return Infinity;
                    return (initialCost || 0) / net;
                },

                /** Net present value of cashflows array (year 0 = first element). */
                npv: function (cashflows, discountRate) {
                    if (!Array.isArray(cashflows)) return 0;
                    var r = discountRate || 0;
                    return cashflows.reduce(function (acc, cf, t) {
                        return acc + cf / Math.pow(1 + r, t);
                    }, 0);
                },

                /** IRR via bisection. Returns null if no root in [-0.99, 10]. */
                irr: function (cashflows, guess) {
                    if (!Array.isArray(cashflows) || cashflows.length < 2) return null;
                    var lo = -0.99, hi = 10, npv = function (r) {
                        return cashflows.reduce(function (a, cf, t) { return a + cf / Math.pow(1 + r, t); }, 0);
                    };
                    var fLo = npv(lo), fHi = npv(hi);
                    if (fLo * fHi > 0) return null;
                    for (var i = 0; i < 60; i++) {
                        var mid = (lo + hi) / 2, fMid = npv(mid);
                        if (Math.abs(fMid) < 1e-6) return mid;
                        if (fLo * fMid < 0) { hi = mid; fHi = fMid; } else { lo = mid; fLo = fMid; }
                    }
                    return (lo + hi) / 2;
                }
            },

            forecast: {
                /** Future value after `years` of compounding at `ratePct` (0.025 = 2.5%/yr). */
                compoundGrowth: function (base, ratePct, years) {
                    return (base || 0) * Math.pow(1 + (ratePct || 0), years || 0);
                },

                /**
                 * Simple linear regression on [{x, y}, ...] points.
                 * Returns {slope, intercept, predict(x)}.
                 */
                linearTrend: function (points) {
                    if (!Array.isArray(points) || points.length < 2) return { slope: 0, intercept: 0, predict: function () { return 0; } };
                    var n = points.length, sx = 0, sy = 0, sxy = 0, sxx = 0;
                    for (var i = 0; i < n; i++) {
                        sx += points[i].x; sy += points[i].y;
                        sxy += points[i].x * points[i].y;
                        sxx += points[i].x * points[i].x;
                    }
                    var slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
                    var intercept = (sy - slope * sx) / n;
                    return {
                        slope: slope,
                        intercept: intercept,
                        predict: function (x) { return slope * x + intercept; }
                    };
                },

                /**
                 * Project a value year-by-year. Returns array of {year, value} from startYear to endYear.
                 */
                projectByYear: function (startVal, ratePct, startYear, endYear) {
                    var out = [];
                    var v = startVal || 0;
                    for (var y = startYear; y <= endYear; y++) {
                        out.push({ year: y, value: Math.round(v) });
                        v = v * (1 + (ratePct || 0));
                    }
                    return out;
                }
            },

            capex: {
                /**
                 * Total raw build cost for `mw` of capacity at the given tier and region.
                 * Pulls per-MW baselines from RZEngine.data.capexPerMw and applies regional multiplier.
                 * Tier accepted: 2|3|4 or 'tier2'|'tier3'|'tier4'.
                 */
                datacenterBuildCost: function (mw, tier, region) {
                    var key = 'airCooledTier' + (tier || 3);
                    var perMw = (DATA.capexPerMw && DATA.capexPerMw[key]) || DATA.capexPerMw.airCooledTier3;
                    var rdata = (region && DATA.regions[region.toUpperCase()]) || DATA.regions.US;
                    return Math.round((mw || 0) * perMw * rdata.salaryMult);
                },

                /** Apply modular construction premium. `modularPct` 0.0–1.0 fraction modular. */
                modularPremium: function (baseCost, modularPct, tier) {
                    var key = 'tier' + (tier || 3);
                    var premium = (DATA.modularPremiumPct && DATA.modularPremiumPct[key]) || 0;
                    return Math.round((baseCost || 0) * (1 + premium * (modularPct || 0)));
                },

                /** MEP portion of total CAPEX (typically 35-45%). Returns dollars. */
                mepDistribution: function (totalCapex, tier) {
                    var key = 'tier' + (tier || 3);
                    var pct = (DATA.mepPctOfCapex && DATA.mepPctOfCapex[key]) || 0.42;
                    return Math.round((totalCapex || 0) * pct);
                },

                /**
                 * Single-call total CAPEX with full breakdown.
                 * Returns { total, it, mep, civil, contingency, perMwCost } in USD.
                 *
                 * opts: { modularPct: 0–1, contingencyPct: 0.10, itPctOfCapex: 0.40 }
                 */
                totalCost: function (mw, tier, region, opts) {
                    opts = opts || {};
                    var t = tier || 3;
                    var base = RZEngine.models.capex.datacenterBuildCost(mw, t, region);
                    var withMod = RZEngine.models.capex.modularPremium(base, opts.modularPct || 0, t);
                    var contingencyPct = opts.contingencyPct != null ? opts.contingencyPct : 0.10;
                    var total = Math.round(withMod * (1 + contingencyPct));
                    var mep = RZEngine.models.capex.mepDistribution(total, t);
                    var itPct = opts.itPctOfCapex != null ? opts.itPctOfCapex : 0.40;
                    var it = Math.round(total * itPct);
                    var civil = total - mep - it;
                    var contingency = Math.round(withMod * contingencyPct);
                    return {
                        total: total,
                        it: it,
                        mep: mep,
                        civil: civil,
                        contingency: contingency,
                        perMwCost: (mw > 0) ? Math.round(total / mw) : 0
                    };
                }
            },

            opex: {
                /**
                 * Annual power cost. mw = total IT load, pue applied to get total facility load.
                 * regionPower defaults to RZEngine.data.regions[code].powerKwh.
                 */
                powerCostAnnual: function (mw, pue, regionPower, hoursPerYear) {
                    var hrs = hoursPerYear || DATA.hoursPerYear;
                    var price = regionPower != null ? regionPower : DATA.regions.US.powerKwh;
                    var pueVal = pue || DATA.pueDefaults.airCooledTier3;
                    return Math.round((mw || 0) * 1000 * pueVal * hrs * price);
                },

                /**
                 * Cooling efficiency factor 0–1 based on climate zone and design delta-T.
                 * Higher = better. climate: 'cold'|'temperate'|'hot'|'tropical'.
                 */
                coolingEfficiency: function (climate, designDeltaT) {
                    var base = { cold: 0.85, temperate: 0.78, hot: 0.68, tropical: 0.62 };
                    var b = base[climate] || 0.75;
                    // Higher design delta-T (e.g. 12C vs 8C) improves efficiency by ~3% per degree
                    var delta = designDeltaT || 10;
                    return Math.min(0.95, b + (delta - 10) * 0.03);
                },

                /**
                 * Annual staffing cost. role: 'dcTechMid'|'electricianJourneyman'|'cdfomSenior'.
                 * Pulls regional salary from RZEngine.data.salaryBenchmarks and applies fully-loaded mult of 1.30.
                 */
                staffingCostAnnual: function (headcount, region, role) {
                    var r = (region || 'US').toUpperCase();
                    var roleKey = role || 'dcTechMid';
                    var bench = DATA.salaryBenchmarks[roleKey];
                    var salary = (bench && bench[r]) || (bench && bench.US) || 75100;
                    return Math.round((headcount || 0) * salary * 1.30); // 30% fully-loaded multiplier
                },

                /** Outsourced contract cost annual. scope: 'small'|'medium'|'large' (per facility). */
                contractCostAnnual: function (scope, region) {
                    var base = { small: 30000, medium: 120000, large: 350000 };
                    var b = base[scope] || base.medium;
                    var rdata = (region && DATA.regions[region.toUpperCase()]) || DATA.regions.US;
                    return Math.round(b * rdata.salaryMult);
                },

                /**
                 * Single-call total annual OPEX with breakdown.
                 * Returns { total, power, staffing, maintenance, contract, overhead } in USD/yr.
                 *
                 * opts: { maintenancePct: 0.02 (of capex), overheadPct: 0.08, contractScope, capex }
                 */
                totalAnnual: function (mw, pue, region, headcount, opts) {
                    opts = opts || {};
                    var rdata = (region && DATA.regions[(region || '').toUpperCase()]) || DATA.regions.US;
                    var power    = RZEngine.models.opex.powerCostAnnual(mw, pue, rdata.powerKwh);
                    var staffing = RZEngine.models.opex.staffingCostAnnual(headcount || 0, region);
                    var contract = RZEngine.models.opex.contractCostAnnual(opts.contractScope || 'medium', region);
                    var capexBase = opts.capex || 0;
                    var maintenance = Math.round(capexBase * (opts.maintenancePct != null ? opts.maintenancePct : 0.02));
                    var overheadPct = opts.overheadPct != null ? opts.overheadPct : 0.08;
                    var subtotal    = power + staffing + contract + maintenance;
                    var overhead    = Math.round(subtotal * overheadPct);
                    return {
                        total:       subtotal + overhead,
                        power:       power,
                        staffing:    staffing,
                        maintenance: maintenance,
                        contract:    contract,
                        overhead:    overhead
                    };
                }
            },

            tco: {
                /**
                 * Total cost of ownership. capex + opex×years + (refreshPct of capex per refresh cycle).
                 * Default 5-year refresh cycle.
                 */
                lifecycle: function (capex, opexAnnual, years, refreshPct) {
                    var rp = refreshPct == null ? 0.40 : refreshPct;
                    var refreshCycles = Math.floor((years || 0) / 5);
                    return Math.round((capex || 0) + (opexAnnual || 0) * (years || 0) + (capex || 0) * rp * refreshCycles);
                },

                /** Number of replacement cycles within `totalYears` given asset life. */
                replacementCycles: function (assetLifeYears, totalYears) {
                    if (!assetLifeYears || assetLifeYears <= 0) return 0;
                    return Math.max(0, Math.floor((totalYears || 0) / assetLifeYears));
                },

                /**
                 * Generate year-by-year cashflow array suitable for NPV/IRR input.
                 * Year 0 = -capex (initial outlay). Years 1..n = -opexAnnual + annualRevenue.
                 * refreshPct of capex is charged at each 5-year refresh cycle.
                 */
                cashflows: function (capex, opexAnnual, years, annualRevenue, refreshPct) {
                    var rp = refreshPct == null ? 0.40 : refreshPct;
                    var flows = [-(capex || 0)];
                    for (var y = 1; y <= (years || 0); y++) {
                        var refresh = (y % 5 === 0) ? (capex || 0) * rp : 0;
                        flows.push((annualRevenue || 0) - (opexAnnual || 0) - refresh);
                    }
                    return flows;
                },

                /** Cost per MW per year — useful KPI for benchmarking. */
                costPerMwYear: function (totalTco, mw, years) {
                    if (!mw || mw <= 0 || !years || years <= 0) return 0;
                    return Math.round((totalTco || 0) / mw / years);
                }
            },

            pue: {
                /** Compute PUE from total facility load and IT load. */
                pueFromInputs: function (itLoad, totalLoad) {
                    if (!itLoad || itLoad <= 0) return 0;
                    return (totalLoad || 0) / itLoad;
                },

                /** Data Center Infrastructure Efficiency = 1/PUE expressed as fraction. */
                dcie: function (pue) {
                    if (!pue || pue <= 0) return 0;
                    return 1 / pue;
                },

                /** Annual energy cost given IT load (kW), PUE, and $/kWh rate. */
                annualEnergyCost: function (itKw, pue, kwhRate, hoursPerYear) {
                    var hrs = hoursPerYear || DATA.hoursPerYear;
                    return Math.round((itKw || 0) * (pue || 1) * hrs * (kwhRate != null ? kwhRate : DATA.regions.US.powerKwh));
                }
            }
        },
        /**
         * Modal helper. Creates a singleton DOM element keyed by `id`, returns
         * { show, hide, destroy }. Reuses existing element on repeat calls.
         *
         * Usage:
         *   var m = RZEngine.modal.create({
         *       id: 'myLogin', title: 'Pro Analysis', accentColor: '#dc2626',
         *       bodyHTML: '<input id="email" placeholder="email">',
         *       onSubmit: function(box){ ... },
         *       submitLabel: 'Unlock', closeLabel: '×'
         *   });
         *   m.show();
         */
        modal: {
            create: function (opts) {
                opts = opts || {};
                var id = opts.id || 'rz-modal-' + Math.random().toString(36).slice(2, 8);
                var existing = root.document && root.document.getElementById(id);
                if (existing) {
                    return {
                        show: function () { existing.classList.add('open'); },
                        hide: function () { existing.classList.remove('open'); },
                        destroy: function () { if (existing.parentNode) existing.parentNode.removeChild(existing); }
                    };
                }
                if (!root.document) return { show: function () {}, hide: function () {}, destroy: function () {} };

                var accent = opts.accentColor || '#dc2626';
                var overlay = root.document.createElement('div');
                overlay.id = id;
                overlay.className = 'rz-modal-overlay';
                overlay.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.85);' +
                    'backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);' +
                    'z-index:9999;align-items:center;justify-content:center;';
                overlay.innerHTML =
                    '<div class="rz-modal-box" style="background:linear-gradient(145deg,#0f172a,#1e293b);' +
                        'border-radius:12px;padding:2rem;width:min(380px,92vw);position:relative;' +
                        'border:1px solid #334155;color:#f1f5f9;">' +
                        '<button class="rz-modal-close" aria-label="Close" style="position:absolute;top:0.75rem;' +
                            'right:0.75rem;background:none;border:none;color:#94a3b8;font-size:1.4rem;cursor:pointer;">' +
                            (opts.closeLabel || '&times;') + '</button>' +
                        '<h3 style="color:#f1f5f9;font-size:1.1rem;margin:0 0 0.4rem;">' +
                            '<i class="fas fa-lock" style="color:' + accent + ';margin-right:0.4rem;"></i>' +
                            (opts.title || 'Sign in') + '</h3>' +
                        (opts.subtitle ? '<p style="color:#94a3b8;font-size:0.82rem;margin:0 0 1.25rem;">' + opts.subtitle + '</p>' : '') +
                        '<div class="rz-modal-body">' + (opts.bodyHTML || '') + '</div>' +
                        (opts.submitLabel ? '<button class="rz-modal-submit" style="width:100%;padding:0.7rem;' +
                            'background:' + accent + ';color:#fff;border:none;border-radius:7px;font-size:0.9rem;' +
                            'font-weight:700;cursor:pointer;margin-top:0.25rem;">' + opts.submitLabel + '</button>' : '') +
                    '</div>';
                (root.document.body || root.document.documentElement).appendChild(overlay);

                // Inject opacity-class style once
                if (!root.document.getElementById('rz-modal-css')) {
                    var s = root.document.createElement('style');
                    s.id = 'rz-modal-css';
                    s.textContent = '.rz-modal-overlay.open{display:flex !important;}';
                    root.document.head.appendChild(s);
                }

                overlay.querySelector('.rz-modal-close').addEventListener('click', function () {
                    overlay.classList.remove('open');
                });
                var submitBtn = overlay.querySelector('.rz-modal-submit');
                if (submitBtn && typeof opts.onSubmit === 'function') {
                    submitBtn.addEventListener('click', function () {
                        try { opts.onSubmit(overlay); } catch (e) {}
                    });
                }

                return {
                    show: function () { overlay.classList.add('open'); },
                    hide: function () { overlay.classList.remove('open'); },
                    destroy: function () { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }
                };
            },
            show: function (id) {
                var el = root.document && root.document.getElementById(id);
                if (el) el.classList.add('open');
            },
            hide: function (id) {
                var el = root.document && root.document.getElementById(id);
                if (el) el.classList.remove('open');
            }
        },
        pdf:    { exportPDF: null, generateTable: null },     // S3
        charts: {                                              // S5
            histogram: null, tornado: null, sensitivity: null,
            roiLine: null, hiringTrajectory: null, costStackedBar: null, radar: null
        },
        /**
         * UI primitives — pure DOM helpers that emit HTML strings or attach to existing elements.
         * Keep these lightweight; they are called from many calculator IIFEs.
         */
        ui: {
            /**
             * Render a gate overlay HTML string. Caller injects as innerHTML or appendChild.
             * Used to lock Pro panels behind login.
             */
            gateOverlay: function (message, ctaLabel, ctaHandlerName) {
                message = message || 'Pro analysis required';
                ctaLabel = ctaLabel || 'Unlock Pro';
                var onclickAttr = ctaHandlerName ? (' onclick="' + ctaHandlerName + '()"') : '';
                return '<div class="rz-gate" style="position:absolute;inset:0;display:flex;flex-direction:column;' +
                    'align-items:center;justify-content:center;gap:0.75rem;background:rgba(15,23,42,0.85);' +
                    'backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);border-radius:inherit;z-index:5;">' +
                    '<i class="fas fa-lock" style="font-size:1.5rem;color:#dc2626;"></i>' +
                    '<p style="color:#cbd5e1;font-size:0.85rem;margin:0;text-align:center;">' + message + '</p>' +
                    '<button' + onclickAttr + ' style="padding:0.5rem 1.25rem;background:#dc2626;color:#fff;' +
                        'border:none;border-radius:6px;font-size:0.82rem;font-weight:700;cursor:pointer;">' +
                        ctaLabel + '</button>' +
                    '</div>';
            },

            /**
             * KPI card HTML string. Caller appends to a grid container.
             * Use accentColor to match article theme.
             */
            kpiCard: function (label, value, subLabel, accentColor) {
                accentColor = accentColor || '#dc2626';
                return '<div class="rz-kpi-card" style="background:#fff;border:1px solid #e5e7eb;' +
                    'border-top:3px solid ' + accentColor + ';border-radius:10px;padding:0.875rem;">' +
                    '<div class="rz-kpi-label" style="font-size:0.72rem;font-weight:600;text-transform:uppercase;' +
                        'letter-spacing:0.05em;color:#6b7280;margin-bottom:0.4rem;">' + (label || '') + '</div>' +
                    '<div class="rz-kpi-value" style="font-size:1.4rem;font-weight:800;color:' + accentColor +
                        ';line-height:1.1;margin-bottom:0.3rem;">' + (value == null ? '—' : value) + '</div>' +
                    '<div class="rz-kpi-sub" style="font-size:0.72rem;color:#6b7280;line-height:1.4;">' +
                        (subLabel || '') + '</div>' +
                    '</div>';
            },

            /**
             * Inline badge HTML string. Variants map to standard CALCULATOR_PROMPT_STANDARD palette.
             * variant: 'create'|'sub'|'extend'|'fast'|'medium'|'slow'|'imm'|'cost1'|'cost2'|'cost3'|'cost4'
             */
            badge: function (text, variant) {
                var map = {
                    create:    { bg: '#dcfce7', fg: '#166534' },
                    sub:       { bg: '#dbeafe', fg: '#1d4ed8' },
                    extend:    { bg: '#fef3c7', fg: '#92400e' },
                    imm:       { bg: '#f0fdf4', fg: '#15803d' },
                    fast:      { bg: '#ecfdf5', fg: '#047857' },
                    medium:    { bg: '#fffbeb', fg: '#b45309' },
                    slow:      { bg: '#fff7ed', fg: '#c2410c' },
                    vslow:     { bg: '#fef2f2', fg: '#991b1b' },
                    cost1:     { bg: '#f0fdf4', fg: '#166534' },
                    cost2:     { bg: '#fffbeb', fg: '#713f12' },
                    cost3:     { bg: '#fff7ed', fg: '#9a3412' },
                    cost4:     { bg: '#fef2f2', fg: '#991b1b' }
                };
                var c = map[variant] || map.create;
                return '<span class="rz-badge" style="display:inline-block;font-size:0.7rem;font-weight:700;' +
                    'padding:0.2rem 0.55rem;border-radius:6px;letter-spacing:0.04em;background:' + c.bg +
                    ';color:' + c.fg + ';">' + (text || '') + '</span>';
            },

            /**
             * Build an <a> tag pointing to a glossary term anchor.
             * Returns HTML string. Use as `<p>... ' + RZEngine.ui.glossaryAnchor('AIOps','aiops') + ' ...</p>`
             */
            glossaryAnchor: function (term, slug) {
                if (!term || !slug) return term || '';
                return '<a href="glossary.html#term-' + slug + '" class="rz-glossary-link">' + term + '</a>';
            },

            /**
             * Attach a hover tooltip to an existing element.
             * `el` can be a DOM node or a selector string.
             * Falls back to native `title` attribute if document is unavailable.
             */
            tooltip: function (el, content) {
                if (!root.document) return;
                var node = (typeof el === 'string') ? root.document.querySelector(el) : el;
                if (!node) return;
                node.setAttribute('title', content || '');
                node.classList.add('rz-tooltip-target');
            }
        }
    };

    root.RZEngine = RZEngine;
})(typeof window !== 'undefined' ? window : this);
