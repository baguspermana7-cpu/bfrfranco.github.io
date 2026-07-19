/* ─── DYNAMIC PREFILL RECOMMENDATIONS (owner mandate, Requirements §1.6) ─────
 * "Prefill BASED ON CURRENT PARAMETER yang sudah diinput — bukan statis."
 * Pure rule registry: each covered capex-input field gets a compute(ctx) that
 * derives a recommendation from the LIVE project parameters (IT load, tier,
 * cooling, country, use case, margin) + engine tables where they exist.
 * Rules are PURE (no store writes) — the UI derives them in render and applies
 * only on an explicit click; user values are never silently overwritten.
 * `contingency` is deliberately EXCLUDED (already bound to designMarginPct).
 * ──────────────────────────────────────────────────────────────────────── */

import { rzData } from './rz-engine';

export type RecValue = string | number;

/** Snapshot of the live stores relevant to the rules (built by the caller). */
export interface RecCtx {
    itLoadKw: number;
    tierLevel: number;              // 2 | 3 | 4
    coolingType: string;            // 'air' | 'inrow' | 'rdhx' | 'liquid'
    countryId: string;
    useCase: string;
    designMarginPct: number;
    deepSea: boolean;
    renewableOption: string;        // 'none' | 'solar' | 'solar_bess'
    deliveryMethod: string;         // 'design_build' | 'design_bid_build' | 'epc'
}

export interface RecRule {
    /** Recommended value under the current parameters, or null when the rule
     *  does not apply (e.g. deep-sea disabled, no renewables selected). */
    compute: (ctx: RecCtx) => RecValue | null;
    /** Honest provenance line shown as the chip tooltip. */
    basis: string;
}

const round1 = (v: number): number => Math.round(v * 10) / 10;
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/* Engine deep-sea poster spec (rzData().deepSeaCooling), with poster-value
 * fallbacks when the engine has not loaded yet. */
function deepSeaSpec(): { depthM: number; deltaTC: number } {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ds = (rzData() as any)?.deepSeaCooling;
    const depthBand: number[] | undefined = ds?.spec?.intakeDepthM;
    return {
        // shallowest depth inside the poster 800-1000 m band → shortest pipeline
        depthM: Array.isArray(depthBand) && typeof depthBand[0] === 'number' ? depthBand[0] : 800,
        deltaTC: typeof ds?.seawater?.designDeltaTC === 'number' ? ds.seawater.designDeltaTC : 5,
    };
}

export const REC: Record<string, RecRule> = {

    /* Sized straight from IT load — mirrors the MW bands the substation option
     * labels themselves carry. */
    substationType: {
        compute: (ctx) => {
            const mw = ctx.itLoadKw / 1000;
            if (mw < 5) return 'pad_mounted_11kv';
            if (mw <= 20) return 'dedicated_33kv';
            if (mw <= 80) return 'dedicated_66kv';
            return 'dedicated_132kv';
        },
        basis: 'Sized from live IT load — mirrors the option MW bands: pad-mount 11kV <5MW · dedicated 20–33kV 5-20MW · 66kV 20-80MW · 132kV >80MW (screening)',
    },

    /* Deep-sea trio — engine DATA.deepSeaCooling poster spec (150 MW reference
     * architecture: intake 800-1000 m @ 4-6 °C, design ΔT 5 °C). */
    dsDepthM: {
        compute: (ctx) => (ctx.deepSea ? clamp(deepSeaSpec().depthM, 20, 1000) : null),
        basis: 'Engine DATA.deepSeaCooling poster spec — intake 800-1000 m reaches the 4-6 °C band (NOAA WOA depth-temperature profile); 800 m = shallowest in-band depth (shortest pipeline)',
    },
    dsPipelineKm: {
        compute: (ctx) => {
            if (!ctx.deepSea) return null;
            /* Engine table carries no pipeline-length field → screening slope:
             * ~200 m depth gain per km offshore on steep volcanic margins. */
            return clamp(Math.round(deepSeaSpec().depthM / 200), 0.5, 50);
        },
        basis: 'Deep-sea poster spec depth ÷ screening seabed slope (~200 m depth per km on steep margins) — engine table has no pipeline-length field; site bathymetry governs',
    },
    dsDeltaTC: {
        compute: (ctx) => (ctx.deepSea ? clamp(deepSeaSpec().deltaTC, 4, 15) : null),
        basis: 'Engine DATA.deepSeaCooling.seawater.designDeltaTC — poster design loop ΔT 5 °C (environmental ΔT ≤ 5 °C limit)',
    },

    /* Generator fuel autonomy — Tier III/IV concurrent-maintainability screening. */
    fuelHours: {
        compute: (ctx) => (ctx.tierLevel >= 3 ? 48 : 24),
        basis: 'Screening standard: Tier III+ concurrent maintainability → 48 h on-site fuel; Tier II → 24 h (extend for remote / weak-grid sites)',
    },

    /* UPS architecture by plant size. */
    upsType: {
        compute: (ctx) => (ctx.itLoadKw / 1000 >= 5 ? 'modular' : 'standalone'),
        basis: 'Screening: ≥5 MW IT → modular UPS (scalable blocks, hot-swap service, phased growth); <5 MW → standalone (lower $/kW at small block counts)',
    },

    /* Refrigerant — engine refrigerant tables. */
    refrigerantType: {
        compute: (ctx) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const data = rzData() as any;
            const auto: Record<string, string | null> | undefined = data?.refrigerantAutoByCooling;
            const db: Record<string, { gwp: number }> | undefined = data?.refrigerants;
            if (ctx.deepSea) return auto?.deepsea ?? 'R1234ze';
            if (ctx.coolingType === 'liquid') {
                /* D2C trim/backup chillers → lowest-GWP suitable low-GWP option. */
                const candidates = ['R1234ze', 'R513A'].filter((k) => !db || db[k]);
                if (candidates.length === 0) return 'R1234ze';
                return candidates.sort((a, b) => (db?.[a]?.gwp ?? 99) - (db?.[b]?.gwp ?? 99))[0];
            }
            return auto?.[ctx.coolingType] ?? 'R410A';
        },
        basis: 'Engine DATA.refrigerantAutoByCooling + DATA.refrigerants (GWP100 IPCC AR4): air/in-row → R-410A, RDHx → R-134a; liquid/D2C trim chillers → lowest-GWP suitable HFO (R-1234ze, GWP 7); deep-sea → R-1234ze',
    },

    /* Clean agent for IT rooms. */
    fireType: {
        compute: () => 'novec',
        basis: 'Screening: clean-agent (Novec 1230) for occupied IT rooms — zero-ODP, low-GWP, no residue on live electronics; sprinkler/inert reserved for support spaces',
    },

    /* Soft-cost fee bands — larger project → lower %, adjusted by delivery method. */
    designFee: {
        compute: (ctx) => {
            const mw = ctx.itLoadKw / 1000;
            let fee = mw < 5 ? 9 : mw <= 20 ? 8 : mw <= 80 ? 7 : 6;
            if (ctx.deliveryMethod === 'design_bid_build') fee += 1; // full separate design scope
            if (ctx.deliveryMethod === 'epc') fee -= 1;             // integrated turnkey
            return clamp(fee, 6, 10);
        },
        basis: 'AACE screening band 6-10% — economy of scale (larger project → lower %); design-bid-build +1 pt (full separate design scope), EPC −1 pt (integrated)',
    },
    pmFee: {
        compute: (ctx) => {
            const mw = ctx.itLoadKw / 1000;
            let fee = mw < 5 ? 6 : mw <= 80 ? 5 : 4;
            if (ctx.deliveryMethod === 'epc') fee -= 1; // turnkey shifts PM scope to contractor
            return clamp(fee, 4, 6);
        },
        basis: 'AACE screening band 4-6% — economy of scale; EPC/turnkey −1 pt (contractor carries delivery management)',
    },

    /* Front-of-meter grid-connection share of CAPEX. */
    utilityRate: {
        compute: (ctx) => {
            const mw = ctx.itLoadKw / 1000;
            let pct = mw < 5 ? 12 : mw <= 20 ? 9 : mw <= 80 ? 7 : 6;
            if (ctx.tierLevel >= 4) pct += 2; // dual independent utility feeds
            return clamp(pct, 0, 30);
        },
        basis: 'Screening band — grid-connection share of CAPEX falls with scale (<5MW ≈12% → >80MW ≈6%); Tier IV +2 pts for dual independent utility feeds',
    },

    /* On-site renewables sizing — only when the option is selected. */
    renewSolarMwp: {
        compute: (ctx) => {
            if (ctx.renewableOption !== 'solar' && ctx.renewableOption !== 'solar_bess') return null;
            return round1(clamp(ctx.itLoadKw / 1000 * 0.10, 0.5, 500));
        },
        basis: 'Screening band: rooftop + carport PV ≈ 10% of IT MW (site-area-limited on-site share; larger shares need off-site PPA land)',
    },
    renewBessMwh: {
        compute: (ctx) => {
            if (ctx.renewableOption !== 'solar_bess') return null;
            const solar = clamp(ctx.itLoadKw / 1000 * 0.10, 0.5, 500);
            return round1(clamp(solar * 2, 1, 2000));
        },
        basis: 'Screening: BESS = 2 h × solar MWp (2-hour storage smooths the PV mid-day peak into the evening shoulder)',
    },
};

/** Compare a current input value against a recommendation (numeric tolerance). */
export function recMatches(current: unknown, rec: RecValue | null): boolean {
    if (rec == null || current == null) return false;
    if (typeof rec === 'number') {
        const cur = typeof current === 'number' ? current : Number(current);
        return Number.isFinite(cur) && Math.abs(cur - rec) < 1e-6;
    }
    return String(current) === String(rec);
}
