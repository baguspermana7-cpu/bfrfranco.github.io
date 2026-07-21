/* ─── BOQ DOSSIER — Bill of Quantities technical dossier surface ─────────────
 * Consumes the SHARED engine BOQ models (rzModels().boq.generate + .summary)
 * and renders a screening-grade Bill of Quantities as a complete, styled HTML5
 * document (dark/instrument theme, A4 print CSS). The document is opened in a
 * print window (same idiom as PrintReport.openStandardReport) so the owner can
 * view it in the browser and export to PDF via the print dialog.
 *
 * IMPORTANT — the margin is DISCLOSED, never "added on top": the T&T / C&W
 * benchmark $/kW already embed contractor margin, so summary() backs it out of
 * the subtotal (m/(1+m)). It is shown as a transparent disclosed line.
 *
 * Engine contract (see prompt / rz-engine.js models.boq):
 *   generate(costs, {racks,floorSpace,pue}, input, {locMult}) → BoqGenerated
 *   summary(costs, softCosts, contingency, fomTotal, capexTotal, {epcMarginPct?})
 *     → BoqSummary
 * All engine access is null-guarded — a missing engine yields a null model and
 * the caller (button) toasts / no-ops rather than throwing.
 * ──────────────────────────────────────────────────────────────────────── */

import { rzData, rzModels } from '@/lib/rz-engine';
import type { CapexInput, CapexResult } from '@/lib/CapexEngine';

/* ── engine output types (named, mirrors the documented shape) ── */

export type BoqConfidence = 'high' | 'med' | 'low';

export interface BoqLine {
    desc: string;
    spec: string;
    unit: string;
    qty: number;
    unitRate: number;
    matCost: number;
    laborCost: number;
    total: number;
    confidence: BoqConfidence;
    source: string;
}

export interface BoqDiscipline {
    key: string;
    label: string;
    categories: string[];
    categoryTotal: number;
    reconcileFactor: number;
    bottomUpRaw: number;
    lines: BoqLine[];
}

export interface BoqDrivers {
    mw: number;
    itKw: number;
    racks: number;
    floorSpaceM2: number;
    gfaM2: number;
    coolingKw: number;
    protectedM3: number;
}

export interface BoqGenerated {
    disciplines: BoqDiscipline[];
    drivers: BoqDrivers;
    hardTotal: number;
}

export interface BoqSafetyFactors {
    electricalContinuous: number;
    structuralLRFD: string;
    cableAmpacityDerate: number;
    coolingRedundancy: string;
    seismic?: string;
}

export interface BoqSummary {
    directCost: number;
    embeddedMargin: number;
    marginPctGross: number;
    marginMarkupOnCost: number;
    hardSubtotal: number;
    softCosts: number;
    contingency: number;
    fom: number;
    grandTotal: number;
    reconciles: boolean;
    unaccounted: number;
    safetyFactors: BoqSafetyFactors;
    aaceClass: number;
    aaceBand: string;
    disclaimer: string;
    marginNote: string;
}

export interface BoqEquipmentItem {
    discipline: string;
    equipment: string;
    spec: string;
    unit: string;
    capacityKw: number;
    qtyN: number;
    qtyInstalled: number;
    redundancy: string;
    leadTimeWk: number;
    category: string;
    confidence: BoqConfidence;
}

export interface BoqPackage {
    pkgNo: string;
    name: string;
    scope: string;
    disciplines: string[];
    tenderMethod: string;
    leadTimeWk: number;
    fatSat: string;
    warrantyYr: number;
    estValue: number;
    confidence: BoqConfidence;
    source: string;
}

export interface BoqProjectMeta {
    projectName: string;
    location: string;
    itMw: number;
    tierLevel: number;
    version: string;
}

export interface BoqModel {
    generated: BoqGenerated;
    summary: BoqSummary;
    projectMeta: BoqProjectMeta;
    /** INFORMATIONAL — indicative equipment counts + N+redundancy sizing;
     *  NOT reconciled to $. Empty when the engine does not expose it. */
    equipment: BoqEquipmentItem[];
    /** INDICATIVE procurement scope envelopes — values OVERLAP across packages
     *  and are NOT additive to the CAPEX total. Empty when unavailable. */
    procurement: BoqPackage[];
}

export interface BuildBoqOpts {
    /** Override the disclosed EPC margin % (gross). Defaults to the engine basis. */
    epcMarginPct?: number;
}

/* ── build ─────────────────────────────────────────────────────────────── */

/** Location multiplier for the bottom-up take-off: country constructionIndex
 *  (the same primary driver CapexEngine uses) or 1.0 when unavailable. */
function locMultOf(input: CapexInput): number {
    return input.country?.constructionIndex ?? 1.0;
}

/**
 * Build the combined BOQ model from the CAPEX input + result via the shared
 * engine. Returns null when the engine (or its boq models) is unavailable.
 */
export function buildBoqModel(
    input: CapexInput,
    result: CapexResult,
    opts?: BuildBoqOpts,
): BoqModel | null {
    const models = rzModels() as {
        boq?: {
            generate?: (
                costs: Record<string, number>,
                metrics: { racks: number; floorSpace: number; pue: number },
                input: CapexInput,
                o: { locMult: number },
            ) => BoqGenerated;
            summary?: (
                costs: Record<string, number>,
                softCosts: { design?: number; pm?: number },
                contingency: number,
                fomTotal: number,
                capexTotal: number,
                o: { epcMarginPct?: number },
            ) => BoqSummary;
            equipmentSchedule?: (
                costs: Record<string, number>,
                metrics: { racks: number; floorSpace: number; pue: number },
                input: CapexInput,
            ) => BoqEquipmentItem[];
            procurementPackages?: (costs: Record<string, number>) => BoqPackage[];
        };
    };
    const boq = models.boq;
    if (!boq?.generate || !boq?.summary) return null;

    const metrics = {
        racks: result.metrics.racks,
        floorSpace: result.metrics.floorSpace,
        pue: result.pue,
    };

    const generated = boq.generate(result.costs, metrics, input, { locMult: locMultOf(input) });
    const summary = boq.summary(
        result.costs,
        result.softCosts,
        result.contingency,
        result.fomTotal,
        result.total,
        { epcMarginPct: opts?.epcMarginPct },
    );

    // Ship-2 informational surfaces — null-guarded (older engines omit them).
    const equipment: BoqEquipmentItem[] = boq.equipmentSchedule
        ? boq.equipmentSchedule(result.costs, metrics, input)
        : [];
    const procurement: BoqPackage[] = boq.procurementPackages
        ? boq.procurementPackages(result.costs)
        : [];

    const data = rzData() as { version?: string };
    const projectMeta: BoqProjectMeta = {
        projectName: '',       // filled by the caller (requirements store)
        location: input.country?.name ?? input.location,
        itMw: +(input.itLoad / 1000).toFixed(2),
        tierLevel: 0,          // filled by the caller (simulation store)
        version: data.version ?? '—',
    };

    return { generated, summary, projectMeta, equipment, procurement };
}

/** Return a copy of the model with projectName / tierLevel filled from the
 *  UI stores (the engine build can't reach them). Immutable. */
export function withProjectMeta(
    model: BoqModel,
    fields: { projectName?: string; tierLevel?: number },
): BoqModel {
    return {
        ...model,
        projectMeta: {
            ...model.projectMeta,
            projectName: fields.projectName ?? model.projectMeta.projectName,
            tierLevel: fields.tierLevel ?? model.projectMeta.tierLevel,
        },
    };
}

/* ── formatting (self-contained so the HTML document is standalone) ─────── */

const esc = (v: unknown): string =>
    String(v ?? '—').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** $ money — compact $M/$B above a million, thousands-grouped below. */
const money = (n: number): string => {
    if (!Number.isFinite(n)) return '—';
    const a = Math.abs(n);
    const sign = n < 0 ? '−' : '';
    if (a >= 1e9) return `${sign}$${(a / 1e9).toLocaleString(undefined, { maximumFractionDigits: 2 })}B`;
    if (a >= 1e6) return `${sign}$${(a / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 })}M`;
    return `${sign}$${Math.round(a).toLocaleString()}`;
};

/** Full grouped dollars (no scaling) — used in line-item cells for auditability. */
const dollarsFull = (n: number): string =>
    Number.isFinite(n) ? `$${Math.round(n).toLocaleString()}` : '—';

/** Quantity with thousands grouping; small fractional quantities keep 1 dp. */
const qtyFmt = (n: number): string => {
    if (!Number.isFinite(n)) return '—';
    if (n !== 0 && Math.abs(n) < 100) return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
    return Math.round(n).toLocaleString();
};

const rateFmt = (n: number): string =>
    Number.isFinite(n) ? `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—';

/* ── instrument theme tokens ── */
const T = {
    bg: '#0b0f14',
    surface: '#111820',
    surfaceAlt: '#0f1620',
    line: '#1e2a36',
    text: '#e6edf3',
    muted: '#8b9bab',
    cyan: '#22d3ee',
    amber: '#fbbf24',
    emerald: '#34d399',
    slate: '#94a3b8',
    fault: '#f87171',
} as const;

/* Confidence chip palette (high=emerald, med=amber, low=slate/"rule-of-thumb"). */
const CONF: Record<BoqConfidence, { bg: string; fg: string; label: string }> = {
    high: { bg: 'rgba(52,211,153,0.16)', fg: T.emerald, label: 'high' },
    med: { bg: 'rgba(251,191,36,0.16)', fg: T.amber, label: 'med' },
    low: { bg: 'rgba(148,163,184,0.16)', fg: T.slate, label: 'rule-of-thumb' },
};

function confChip(c: BoqConfidence): string {
    const s = CONF[c] ?? CONF.low;
    return `<span style="display:inline-block;padding:1px 7px;border-radius:999px;background:${s.bg};color:${s.fg};font-size:9px;font-weight:700;letter-spacing:.3px;">${esc(s.label)}</span>`;
}

/* ── document sections ─────────────────────────────────────────────────── */

function coverSection(model: BoqModel): string {
    const { projectMeta: p, summary } = model;
    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const cell = (label: string, value: string) =>
        `<div style="flex:1;min-width:120px;">
            <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:${T.muted};">${esc(label)}</div>
            <div style="font-size:13px;font-weight:700;color:${T.text};margin-top:2px;font-family:'JetBrains Mono',monospace;">${esc(value)}</div>
        </div>`;
    return `<section class="cover">
        <div style="font-size:10px;letter-spacing:3px;text-transform:uppercase;color:${T.cyan};">DC-OS · Technical Dossier</div>
        <h1 style="font-size:30px;font-weight:800;color:${T.text};margin:8px 0 4px;line-height:1.15;">Bill of Quantities<br><span style="font-size:16px;font-weight:600;color:${T.muted};">Technical Dossier</span></h1>
        <div style="display:flex;flex-wrap:wrap;gap:16px;margin:20px 0 14px;padding:14px 16px;border:1px solid ${T.line};border-radius:12px;background:${T.surface};">
            ${cell('Project', p.projectName || 'Untitled Project')}
            ${cell('Location', p.location)}
            ${cell('IT Capacity', `${p.itMw.toLocaleString()} MW`)}
            ${cell('Tier', p.tierLevel ? `Tier ${p.tierLevel}` : '—')}
            ${cell('Generated', dateStr)}
        </div>
        <div style="display:flex;align-items:center;gap:14px;padding:16px 18px;border-radius:12px;background:linear-gradient(135deg,rgba(34,211,238,0.10),rgba(251,191,36,0.06));border:1px solid ${T.line};">
            <div style="flex:1;">
                <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:${T.muted};">Grand Total (= Parametric CAPEX)</div>
                <div style="font-size:34px;font-weight:800;color:${T.amber};font-family:'JetBrains Mono',monospace;line-height:1.1;">${money(summary.grandTotal)}</div>
            </div>
            <div style="text-align:right;font-size:10px;color:${T.muted};line-height:1.6;">
                AACE Class ${esc(summary.aaceClass)}<br>${esc(summary.aaceBand)}<br>
                <span style="color:${T.slate};">screening-grade</span>
            </div>
        </div>
    </section>`;
}

function disclaimerSection(model: BoqModel): string {
    const { summary } = model;
    const sf = summary.safetyFactors;
    const sfRow = (name: string, value: string, note: string) =>
        `<tr>
            <td style="padding:5px 8px;border-bottom:1px solid ${T.line};color:${T.text};font-size:10.5px;">${esc(name)}</td>
            <td style="padding:5px 8px;border-bottom:1px solid ${T.line};color:${T.cyan};font-family:'JetBrains Mono',monospace;font-size:10.5px;">${esc(value)}</td>
            <td style="padding:5px 8px;border-bottom:1px solid ${T.line};color:${T.muted};font-size:10px;">${esc(note)}</td>
        </tr>`;
    return `<section class="block">
        <div style="border-left:3px solid ${T.fault};background:rgba(248,113,113,0.07);border-radius:0 10px 10px 0;padding:12px 14px;margin-bottom:14px;">
            <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:${T.fault};margin-bottom:5px;">⚠ Screening-Grade — Read First</div>
            <p style="font-size:10.5px;line-height:1.65;color:${T.text};margin:0 0 6px;">${esc(summary.disclaimer)}</p>
            <div style="font-size:10px;color:${T.muted};">Estimate class: <b style="color:${T.text};">AACE Class ${esc(summary.aaceClass)}</b> — band <b style="color:${T.text};">${esc(summary.aaceBand)}</b>.</div>
        </div>

        <h2 class="sec-title">Design Safety Factors (basis of the take-off)</h2>
        <table class="tbl">
            <thead><tr>
                <th style="text-align:left;">Factor</th><th style="text-align:left;">Applied</th><th style="text-align:left;">Basis</th>
            </tr></thead>
            <tbody>
                ${sfRow('Electrical continuous load', `×${sf.electricalContinuous}`, 'NEC 210.19 / 215.2 — 125% continuous')}
                ${sfRow('Structural (LRFD)', sf.structuralLRFD, 'ASCE 7 load combination')}
                ${sfRow('Cable ampacity derate', `×${sf.cableAmpacityDerate}`, 'grouping / thermal derate')}
                ${sfRow('Cooling redundancy', sf.coolingRedundancy, 'mechanical availability path')}
                ${sf.seismic ? sfRow('Seismic', sf.seismic, 'zone factor') : ''}
            </tbody>
        </table>

        <h2 class="sec-title" style="margin-top:16px;">Disclosed Margin (backed out — NOT added on top)</h2>
        <div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:6px;">
            <div class="mini-stat"><div class="mini-k">Margin (% gross)</div><div class="mini-v">${summary.marginPctGross.toLocaleString(undefined, { maximumFractionDigits: 1 })}%</div></div>
            <div class="mini-stat"><div class="mini-k">Markup on cost</div><div class="mini-v">${summary.marginMarkupOnCost.toLocaleString(undefined, { maximumFractionDigits: 1 })}%</div></div>
            <div class="mini-stat"><div class="mini-k">Embedded margin $</div><div class="mini-v">${money(summary.embeddedMargin)}</div></div>
        </div>
        <p style="font-size:10px;line-height:1.6;color:${T.muted};margin:4px 0 0;">${esc(summary.marginNote)}</p>
    </section>`;
}

function commercialSummarySection(model: BoqModel): string {
    const { summary } = model;
    const row = (label: string, value: number, opts?: { emphasis?: boolean; disclosed?: boolean }) =>
        `<tr${opts?.emphasis ? ` style="background:rgba(251,191,36,0.08);"` : ''}>
            <td style="padding:7px 10px;border-bottom:1px solid ${T.line};font-size:11px;${opts?.emphasis ? `font-weight:800;color:${T.amber};` : `color:${T.text};`}">
                ${esc(label)}${opts?.disclosed ? `<span style="margin-left:6px;font-size:8.5px;font-weight:700;color:${T.cyan};letter-spacing:.5px;">DISCLOSED</span>` : ''}
            </td>
            <td style="padding:7px 10px;border-bottom:1px solid ${T.line};text-align:right;font-family:'JetBrains Mono',monospace;font-size:11.5px;${opts?.emphasis ? `font-weight:800;color:${T.amber};` : `color:${T.text};`}">${money(value)}</td>
        </tr>`;
    return `<section class="block">
        <h2 class="sec-title">Commercial Summary</h2>
        <table class="tbl">
            <tbody>
                ${row('Direct cost (bottom-up, ex-margin)', summary.directCost)}
                ${row('+ Embedded contractor margin', summary.embeddedMargin, { disclosed: true })}
                ${row('= Hard subtotal (equipment + install)', summary.hardSubtotal)}
                ${row('+ Soft costs (design + PM)', summary.softCosts)}
                ${row('+ Contingency', summary.contingency)}
                ${row('+ First-of-a-kind / owner (FOM)', summary.fom)}
                ${row('+ Unaccounted (green-cert / renewables residual)', summary.unaccounted)}
                ${row('GRAND TOTAL (= CAPEX total)', summary.grandTotal, { emphasis: true })}
            </tbody>
        </table>
        <p style="font-size:9.5px;color:${T.muted};margin:6px 0 0;">
            ${summary.reconciles
            ? `<span style="color:${T.emerald};">✓ Reconciles</span> — the decomposition ties to the parametric CAPEX total.`
            : `<span style="color:${T.amber};">Note</span> — a residual of ${money(summary.unaccounted)} is carried as "unaccounted" to tie to the CAPEX total.`}
        </p>
    </section>`;
}

function disciplineSection(d: BoqDiscipline): string {
    const rows = d.lines.map((l, i) =>
        `<tr${i % 2 ? ` style="background:${T.surfaceAlt};"` : ''}>
            <td style="padding:5px 8px;font-size:10px;color:${T.text};">${esc(l.desc)}</td>
            <td style="padding:5px 8px;font-size:9.5px;color:${T.muted};">${esc(l.spec)}</td>
            <td style="padding:5px 8px;font-size:9.5px;color:${T.muted};text-align:center;">${esc(l.unit)}</td>
            <td style="padding:5px 8px;font-size:10px;text-align:right;font-family:'JetBrains Mono',monospace;color:${T.text};">${qtyFmt(l.qty)}</td>
            <td style="padding:5px 8px;font-size:10px;text-align:right;font-family:'JetBrains Mono',monospace;color:${T.muted};">${rateFmt(l.unitRate)}</td>
            <td style="padding:5px 8px;font-size:10px;text-align:right;font-family:'JetBrains Mono',monospace;color:${T.muted};">${dollarsFull(l.matCost)}</td>
            <td style="padding:5px 8px;font-size:10px;text-align:right;font-family:'JetBrains Mono',monospace;color:${T.muted};">${dollarsFull(l.laborCost)}</td>
            <td style="padding:5px 8px;font-size:10px;text-align:right;font-family:'JetBrains Mono',monospace;color:${T.text};font-weight:700;">${dollarsFull(l.total)}</td>
            <td style="padding:5px 8px;text-align:center;">${confChip(l.confidence)}</td>
            <td style="padding:5px 8px;font-size:9px;color:${T.muted};">${esc(l.source)}</td>
        </tr>`,
    ).join('');
    const rf = Number.isFinite(d.reconcileFactor) ? d.reconcileFactor.toFixed(2) : '—';
    return `<section class="discipline">
        <div style="display:flex;align-items:baseline;gap:10px;border-bottom:2px solid ${T.cyan};padding-bottom:5px;margin:0 0 8px;">
            <h2 style="font-size:14px;font-weight:800;color:${T.text};margin:0;">${esc(d.label)}</h2>
            <span style="font-size:9px;color:${T.muted};text-transform:uppercase;letter-spacing:1px;">${esc(d.categories.join(' · '))}</span>
            <span style="margin-left:auto;font-family:'JetBrains Mono',monospace;font-size:15px;font-weight:800;color:${T.amber};">${money(d.categoryTotal)}</span>
        </div>
        <table class="tbl">
            <thead><tr>
                <th style="text-align:left;">Description</th>
                <th style="text-align:left;">Spec</th>
                <th style="text-align:center;">Unit</th>
                <th style="text-align:right;">Qty</th>
                <th style="text-align:right;">Unit Rate</th>
                <th style="text-align:right;">Material</th>
                <th style="text-align:right;">Labor</th>
                <th style="text-align:right;">Total</th>
                <th style="text-align:center;">Confidence</th>
                <th style="text-align:left;">Source</th>
            </tr></thead>
            <tbody>${rows}</tbody>
        </table>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:5px;padding:4px 8px;background:${T.surface};border-radius:8px;">
            <span style="font-size:9.5px;color:${T.muted};">Bottom-up raw ${money(d.bottomUpRaw)} · reconciled ×${rf} to the parametric CAPEX category</span>
            <span style="font-size:11px;font-weight:800;color:${T.text};font-family:'JetBrains Mono',monospace;">Subtotal ${money(d.categoryTotal)}</span>
        </div>
    </section>`;
}

/** Lead-time threshold (weeks) above which an item is flagged as long-lead
 *  (schedule-driving) and highlighted in amber. */
const LONG_LEAD_WK = 52;

function equipmentScheduleSection(items: BoqEquipmentItem[]): string {
    if (!items.length) return '';
    const rows = items.map((e, i) => {
        const longLead = Number.isFinite(e.leadTimeWk) && e.leadTimeWk >= LONG_LEAD_WK;
        const rowBg = longLead
            ? 'rgba(251,191,36,0.10)'
            : (i % 2 ? T.surfaceAlt : 'transparent');
        const ltCell = longLead
            ? `<td style="padding:5px 8px;font-size:10px;text-align:right;font-family:'JetBrains Mono',monospace;color:${T.amber};font-weight:800;">${qtyFmt(e.leadTimeWk)}<span style="margin-left:5px;font-size:8px;font-weight:700;letter-spacing:.4px;">LONG-LEAD</span></td>`
            : `<td style="padding:5px 8px;font-size:10px;text-align:right;font-family:'JetBrains Mono',monospace;color:${T.muted};">${qtyFmt(e.leadTimeWk)}</td>`;
        return `<tr style="background:${rowBg};">
            <td style="padding:5px 8px;font-size:10px;color:${T.text};">${esc(e.equipment)}</td>
            <td style="padding:5px 8px;font-size:9.5px;color:${T.muted};">${esc(e.spec)}</td>
            <td style="padding:5px 8px;font-size:10px;text-align:right;font-family:'JetBrains Mono',monospace;color:${T.text};">${qtyFmt(e.capacityKw)}</td>
            <td style="padding:5px 8px;font-size:10px;text-align:right;font-family:'JetBrains Mono',monospace;color:${T.text};">${qtyFmt(e.qtyN)}</td>
            <td style="padding:5px 8px;font-size:10px;text-align:right;font-family:'JetBrains Mono',monospace;color:${T.text};font-weight:700;">${qtyFmt(e.qtyInstalled)}</td>
            <td style="padding:5px 8px;font-size:9.5px;text-align:center;color:${T.muted};text-transform:uppercase;letter-spacing:.5px;">${esc(e.redundancy)}</td>
            ${ltCell}
            <td style="padding:5px 8px;text-align:center;">${confChip(e.confidence)}</td>
        </tr>`;
    }).join('');
    return `<section class="block">
        <h2 class="sec-title" style="margin-top:28px;">Equipment Schedule <span style="font-size:8.5px;color:${T.slate};letter-spacing:.5px;">— informational, not reconciled to $</span></h2>
        <table class="tbl">
            <thead><tr>
                <th style="text-align:left;">Equipment</th>
                <th style="text-align:left;">Spec</th>
                <th style="text-align:right;">Capacity (kW)</th>
                <th style="text-align:right;">Qty (N)</th>
                <th style="text-align:right;">Qty Installed</th>
                <th style="text-align:center;">Redundancy</th>
                <th style="text-align:right;">Lead Time (wk)</th>
                <th style="text-align:center;">Confidence</th>
            </tr></thead>
            <tbody>${rows}</tbody>
        </table>
        <p style="font-size:9.5px;line-height:1.6;color:${T.muted};margin:6px 0 0;">
            <span style="color:${T.amber};">Amber rows</span> are long-lead (≥ ${LONG_LEAD_WK} wk) — they drive the delivery programme, order early.
            Indicative equipment counts — screening, N+redundancy sizing; real selection per detailed design.
        </p>
    </section>`;
}

function procurementPackagesSection(pkgs: BoqPackage[]): string {
    if (!pkgs.length) return '';
    const rows = pkgs.map((p, i) =>
        `<tr${i % 2 ? ` style="background:${T.surfaceAlt};"` : ''}>
            <td style="padding:5px 8px;font-size:10px;font-family:'JetBrains Mono',monospace;color:${T.cyan};font-weight:700;">${esc(p.pkgNo)}</td>
            <td style="padding:5px 8px;font-size:10px;color:${T.text};font-weight:700;">${esc(p.name)}</td>
            <td style="padding:5px 8px;font-size:9.5px;color:${T.muted};">${esc(p.scope)}</td>
            <td style="padding:5px 8px;font-size:9.5px;text-align:center;color:${T.muted};text-transform:uppercase;letter-spacing:.4px;">${esc(p.tenderMethod)}</td>
            <td style="padding:5px 8px;font-size:10px;text-align:right;font-family:'JetBrains Mono',monospace;color:${T.muted};">${qtyFmt(p.leadTimeWk)}</td>
            <td style="padding:5px 8px;font-size:9.5px;text-align:center;color:${T.muted};">${esc(p.fatSat)}</td>
            <td style="padding:5px 8px;font-size:10px;text-align:right;font-family:'JetBrains Mono',monospace;color:${T.text};">${qtyFmt(p.warrantyYr)}</td>
            <td style="padding:5px 8px;font-size:10px;text-align:right;font-family:'JetBrains Mono',monospace;color:${T.amber};font-weight:700;">${money(p.estValue)}</td>
            <td style="padding:5px 8px;text-align:center;">${confChip(p.confidence)}</td>
        </tr>`,
    ).join('');
    return `<section class="block">
        <h2 class="sec-title" style="margin-top:28px;">Procurement Packages</h2>
        <div style="border-left:3px solid ${T.amber};background:rgba(251,191,36,0.08);border-radius:0 10px 10px 0;padding:10px 13px;margin-bottom:10px;">
            <p style="font-size:10px;line-height:1.6;color:${T.text};margin:0;">
                <b style="color:${T.amber};">Indicative scope envelopes</b> — package values <b>OVERLAP</b> (the electrical / mechanical
                categories span several packages) and are <b>NOT additive</b> to the CAPEX total; shown for procurement
                planning, not cost rollup.
            </p>
        </div>
        <table class="tbl">
            <thead><tr>
                <th style="text-align:left;">Pkg #</th>
                <th style="text-align:left;">Name</th>
                <th style="text-align:left;">Scope</th>
                <th style="text-align:center;">Tender Method</th>
                <th style="text-align:right;">Lead Time (wk)</th>
                <th style="text-align:center;">FAT/SAT</th>
                <th style="text-align:right;">Warranty (yr)</th>
                <th style="text-align:right;">Indicative Value</th>
                <th style="text-align:center;">Confidence</th>
            </tr></thead>
            <tbody>${rows}</tbody>
        </table>
    </section>`;
}

/* ── document assembly ─────────────────────────────────────────────────── */

/** Render the full BOQ dossier as a complete, standalone HTML5 document. */
export function renderBoqDossierHTML(model: BoqModel, projectMeta?: BoqProjectMeta): string {
    const merged: BoqModel = projectMeta ? { ...model, projectMeta } : model;
    const disciplinesHtml = merged.generated.disciplines.map(disciplineSection).join('');
    const equipmentHtml = equipmentScheduleSection(merged.equipment ?? []);
    const procurementHtml = procurementPackagesSection(merged.procurement ?? []);
    const v = esc(merged.projectMeta.version);

    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bill of Quantities — ${esc(merged.projectMeta.projectName || 'DC-OS')}</title>
    <style>
        @media print {
            body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
            @page { size:A4; margin:12mm 12mm; }
            .no-print { display:none !important; }
            .cover, .discipline { page-break-inside:avoid; }
            .discipline { page-break-before:auto; }
            table { page-break-inside:auto; } tr { page-break-inside:avoid; }
        }
        * { box-sizing:border-box; }
        body {
            font-family:'IBM Plex Sans','Segoe UI',system-ui,-apple-system,sans-serif;
            background:${T.bg}; color:${T.text}; margin:0; padding:24px 30px 60px; font-size:12px;
        }
        h2.sec-title {
            font-size:12px; text-transform:uppercase; letter-spacing:1.5px; color:${T.cyan};
            margin:0 0 8px; padding-bottom:4px; border-bottom:1px solid ${T.line};
        }
        section.block, section.discipline { margin:22px 0; }
        table.tbl { width:100%; border-collapse:collapse; }
        table.tbl thead th {
            font-size:9px; text-transform:uppercase; letter-spacing:.5px; color:${T.muted};
            padding:5px 8px; border-bottom:1px solid ${T.line}; font-weight:700;
        }
        .mini-stat { flex:1; min-width:120px; padding:9px 12px; border:1px solid ${T.line}; border-radius:10px; background:${T.surface}; }
        .mini-k { font-size:8.5px; text-transform:uppercase; letter-spacing:1px; color:${T.muted}; }
        .mini-v { font-size:16px; font-weight:800; color:${T.cyan}; font-family:'JetBrains Mono',monospace; margin-top:2px; }
        .print-bar { position:fixed; top:14px; right:18px; z-index:10; }
        .print-btn {
            background:${T.amber}; color:#111; border:none; border-radius:8px;
            padding:8px 16px; font-size:12px; font-weight:800; cursor:pointer; letter-spacing:.3px;
        }
        footer {
            margin-top:26px; padding-top:10px; border-top:1px solid ${T.line};
            font-size:9px; color:${T.muted}; display:flex; justify-content:space-between; flex-wrap:wrap; gap:6px;
        }
    </style></head><body>
    <div class="print-bar no-print"><button class="print-btn" onclick="window.print()">⬇ Save as PDF / Print</button></div>
    ${coverSection(merged)}
    ${disclaimerSection(merged)}
    ${commercialSummarySection(merged)}
    <h2 class="sec-title" style="margin-top:28px;">Bill of Quantities — by Discipline</h2>
    ${disciplinesHtml}
    ${equipmentHtml}
    ${procurementHtml}
    <footer>
        <span>SCREENING-GRADE · not a quotation · resistancezero.com · v${v}</span>
        <span>DC-OS · Bill of Quantities · Technical Dossier</span>
    </footer>
    </body></html>`;
}

/**
 * Open the BOQ dossier in a print window (browser-viewable HTML, exportable to
 * PDF via the print dialog). Returns false when the popup is blocked so the
 * caller can toast the user.
 */
export function openBoqDossier(model: BoqModel, projectMeta?: BoqProjectMeta): boolean {
    if (typeof window === 'undefined') return false;
    const w = window.open('', '_blank');
    if (!w) return false;
    w.document.write(renderBoqDossierHTML(model, projectMeta));
    w.document.close();
    return true;
}
