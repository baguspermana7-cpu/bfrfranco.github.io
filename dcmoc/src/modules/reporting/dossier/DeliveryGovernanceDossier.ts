/* ─── DELIVERY GOVERNANCE DOSSIER — Workstream I ─────────────────────────────
 * Advanced-PMP delivery-governance dossier for the Construction Engine, wired
 * to the LIVE project. Mirrors the BoqDossier print-window pattern: a complete
 * standalone HTML5 document (dark instrument theme, A4 print CSS) opened via
 * window.open + document.write, exportable to PDF from the print dialog.
 *
 * Engine surfaces consumed (all null-guarded):
 *   rzModels().dossier.deliveryGovernance({itLoadKw,totalMonths,capexUsd})
 *     → { volumes, decisionBands, windows, deliverables, pmFramework, method }
 *   rzModels().dossier.countryRisks(country)
 *   rzData().dossier.{permittingMatrix,designBasis,riskRegister,
 *     documentSchedule,opsReadiness}
 * Plus the LIVE construction-tracking store (risks/issues — "live project log")
 * and the engine CPM schedule rows.
 *
 * Every section carries a source chip: LIVE-WIRED (computed from this project)
 * vs STANDARD PRACTICE (reference playbooks) — never blurred together.
 *
 * CRITICAL: never emit a literal closing script tag inside a JS string — all
 * interpolated text goes through esc(). This document contains no <script>.
 * ──────────────────────────────────────────────────────────────────────── */

import { rzData, rzModels } from '@/lib/rz-engine';
import type { CapexInput, CapexResult } from '@/lib/CapexEngine';
import type {
    PermitRow,
    DesignBasisRow,
    RiskRow,
    DocScheduleRow,
    OpsReadyRow,
    CountryRiskRow,
    DossierRisk,
    DossierData,
} from '@/modules/reporting/boq/BoqDossier';

/* ── engine output types (mirror models.dossier.deliveryGovernance) ── */

/** Screening document-volume bands, scaled by MW + program months. */
export interface DgVolumes {
    rfi: number;
    submittal: number;
    itp: number;
    ncr: number;
    variation: number;
    punchlist: number;
}

/** One delegation-of-authority band; usdBand is $-scaled to project CAPEX. */
export interface DgDecisionBand {
    decision: string;
    authority: string;
    targetDays: number;
    usdBand: string | null;
}

/** One deliverable window mapped onto the live program timeline. */
export interface DgWindow {
    key: string;
    window: string;
    note: string;
}

/** One deliverable playbook (IFC / RFI / submittal / ITP / NCR / …). */
export interface DgDeliverable {
    key: string;
    name: string;
    purpose: string;
    trigger: string;
    owner: string;
    approver: string;
    cycleDays: number;
    holdImpact: string;
    standard: string;
}

export interface DgReportingRow {
    cadence: string;
    artifact: string;
    audience: string;
}

export interface DgPressureRow {
    scenario: string;
    response: string;
    risk: string;
}

export interface DgSecurityRow {
    area: string;
    exposure: string;
    control: string;
}

export interface DgPmFramework {
    controlAccounts: string[];
    decisionVelocity: { bands: { decision: string; authority: string; targetDays: number }[]; note: string };
    reportingRhythm: DgReportingRow[];
    stakeholderPressure: DgPressureRow[];
    securityExposure: DgSecurityRow[];
    roles: { senior: string; intermediate: string };
}

/** Full engine deliveryGovernance result. */
export interface DgResult {
    volumes: DgVolumes;
    decisionBands: DgDecisionBand[];
    windows: DgWindow[];
    deliverables: DgDeliverable[];
    pmFramework: DgPmFramework;
    method: string;
}

/* ── live-project types (structural — the zustand stores fit these) ── */

export interface DgLiveRisk {
    risk: string;
    impact: 'low' | 'medium' | 'high';
    probability: 'low' | 'medium' | 'high';
    status: string;
    isExample?: boolean;
}

export interface DgLiveIssue {
    title: string;
    status: string;
    owner: string;
    isExample?: boolean;
}

export interface DgTrackingLike {
    statusMonth: number | null;
    risks: DgLiveRisk[];
    issues: DgLiveIssue[];
}

export interface DgSimLike {
    inputs: { itLoad: number; tierLevel: number };
    selectedCountry?: { name?: string } | null;
}

export interface DgScheduleRowLike {
    key: string;
    label: string;
    startMonth: number;
    endMonth: number;
    months: number;
}

export interface DgScheduleLike {
    rows: DgScheduleRowLike[];
    totalMonths: number;
    milestones?: Record<string, number>;
}

export interface DgProjectMeta {
    projectName: string;
    location: string;
    itMw: number;
    tierLevel: number;
    capexUsd: number;
    totalMonths: number;
    version: string;
}

export interface DeliveryGovernanceModel {
    projectMeta: DgProjectMeta;
    governance: DgResult;
    permitting: PermitRow[];
    designBasis: DesignBasisRow[];
    riskRegister: RiskRow[];
    documentSchedule: DocScheduleRow[];
    opsReadiness: OpsReadyRow[];
    countryRisks: CountryRiskRow[];
    schedule: DgScheduleLike | null;
    statusMonth: number | null;
    liveRisks: DgLiveRisk[];
    liveIssues: DgLiveIssue[];
}

export interface BuildDgOpts {
    projectName?: string;
    /** The engine CPM schedule already computed by the page (plannedSchedule). */
    schedule?: DgScheduleLike | null;
}

/* ── build ─────────────────────────────────────────────────────────────── */

/**
 * Assemble the delivery-governance model from the shared engine + the live
 * project stores. Returns null when the engine model is unavailable.
 */
export function buildDeliveryGovernanceModel(
    capexInputs: CapexInput,
    results: CapexResult,
    tracking: DgTrackingLike,
    sim: DgSimLike,
    opts?: BuildDgOpts,
): DeliveryGovernanceModel | null {
    const models = rzModels() as {
        dossier?: {
            deliveryGovernance?: (i: { itLoadKw: number; totalMonths: number; capexUsd: number }) => DgResult;
            countryRisks?: (country: unknown) => CountryRiskRow[];
        };
    };
    if (!models.dossier?.deliveryGovernance) return null;

    const itLoadKw = sim.inputs.itLoad;
    const totalMonths = opts?.schedule?.totalMonths ?? results.timeline?.totalMonths ?? 0;
    const capexUsd = results.total;

    const governance = models.dossier.deliveryGovernance({ itLoadKw, totalMonths, capexUsd });
    if (!governance) return null;

    const countryRisks: CountryRiskRow[] = (models.dossier.countryRisks && capexInputs.country)
        ? (models.dossier.countryRisks(capexInputs.country) ?? [])
        : [];

    const data = rzData() as { version?: string; dossier?: DossierData };
    const d = data.dossier;

    const projectMeta: DgProjectMeta = {
        projectName: opts?.projectName ?? '',
        location: sim.selectedCountry?.name ?? capexInputs.country?.name ?? capexInputs.location,
        itMw: +(itLoadKw / 1000).toFixed(2),
        tierLevel: sim.inputs.tierLevel,
        capexUsd,
        totalMonths,
        version: data.version ?? '—',
    };

    return {
        projectMeta,
        governance,
        permitting: d?.permittingMatrix ?? [],
        designBasis: d?.designBasis ?? [],
        riskRegister: d?.riskRegister ?? [],
        documentSchedule: d?.documentSchedule ?? [],
        opsReadiness: d?.opsReadiness ?? [],
        countryRisks,
        schedule: opts?.schedule ?? null,
        statusMonth: tracking.statusMonth,
        liveRisks: tracking.risks ?? [],
        liveIssues: tracking.issues ?? [],
    };
}

/* ── formatting (self-contained so the HTML document is standalone) ─────── */

const esc = (v: unknown): string =>
    String(v ?? '—').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const money = (n: number): string => {
    if (!Number.isFinite(n)) return '—';
    const a = Math.abs(n);
    const sign = n < 0 ? '−' : '';
    if (a >= 1e9) return `${sign}$${(a / 1e9).toLocaleString(undefined, { maximumFractionDigits: 2 })}B`;
    if (a >= 1e6) return `${sign}$${(a / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 })}M`;
    return `${sign}$${Math.round(a).toLocaleString()}`;
};

const qtyFmt = (n: number): string => {
    if (!Number.isFinite(n)) return '—';
    if (n !== 0 && Math.abs(n) < 100) return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
    return Math.round(n).toLocaleString();
};

/* ── instrument theme tokens — resistancezero.com brand (--rz-*) ── */
const T = {
    bg: '#0a0e1a',
    surface: '#111827',
    surfaceAlt: '#0f1620',
    line: '#1e2a36',
    text: '#e6edf3',
    muted: '#8b9bab',
    cyan: '#00DDFF',
    amber: '#FFAA00',
    emerald: '#00FF88',
    slate: '#94a3b8',
    fault: '#f87171',
} as const;

/* Risk band chip (high=fault-red, med=signal-amber, low=slate). */
const RISK_CHIP: Record<DossierRisk, { bg: string; fg: string }> = {
    high: { bg: 'rgba(248,113,113,0.16)', fg: T.fault },
    med: { bg: 'rgba(255,170,0,0.16)', fg: T.amber },
    low: { bg: 'rgba(148,163,184,0.16)', fg: T.slate },
};

function riskChip(r: DossierRisk): string {
    const s = RISK_CHIP[r] ?? RISK_CHIP.low;
    return `<span style="display:inline-block;padding:1px 7px;border-radius:999px;background:${s.bg};color:${s.fg};font-size:9px;font-weight:700;letter-spacing:.3px;text-transform:uppercase;">${esc(r)}</span>`;
}

/** Map the tracking store's 3-level 'low|medium|high' onto the dossier band. */
function liveBand(v: 'low' | 'medium' | 'high'): DossierRisk {
    return v === 'medium' ? 'med' : v;
}

/** Section source chip — LIVE-WIRED (computed from this project) vs STANDARD
 *  PRACTICE (reference playbook) vs MIXED. Owner mandate: never blur them. */
type DgSource = 'live' | 'standard' | 'mixed';

const SRC_CHIP: Record<DgSource, { bg: string; fg: string; label: string }> = {
    live: { bg: 'rgba(0,255,136,0.14)', fg: T.emerald, label: 'LIVE-WIRED' },
    standard: { bg: 'rgba(148,163,184,0.16)', fg: T.slate, label: 'STANDARD PRACTICE' },
    mixed: { bg: 'rgba(0,221,255,0.13)', fg: T.cyan, label: 'LIVE + STANDARD PRACTICE' },
};

function srcChip(s: DgSource): string {
    const c = SRC_CHIP[s];
    return `<span style="display:inline-block;padding:1px 8px;border-radius:999px;background:${c.bg};color:${c.fg};font-size:8.5px;font-weight:800;letter-spacing:.6px;vertical-align:middle;">${esc(c.label)}</span>`;
}

const SECTION_TITLES: readonly { title: string; src: DgSource }[] = [
    { title: 'Project & Program', src: 'live' },
    { title: 'Executive Summary — Delivery Governance for This Build', src: 'live' },
    { title: 'Delivery-Governance Context', src: 'mixed' },
    { title: 'Authority & Permit Interface', src: 'standard' },
    { title: 'Design Coordination & IFC Flow', src: 'mixed' },
    { title: 'Quality & Inspection Governance', src: 'mixed' },
    { title: 'Schedule Governance & Decision Velocity', src: 'mixed' },
    { title: 'Commercial Governance', src: 'mixed' },
    { title: 'Security & Authority Exposure', src: 'standard' },
    { title: 'Risk & Early Warnings', src: 'mixed' },
    { title: 'Turnover & Handover', src: 'mixed' },
    { title: 'PM Working Framework', src: 'standard' },
    { title: 'Country Risks', src: 'live' },
] as const;

/* Section header — numbered, matches the ToC, carries the source chip. */
function secHead(no: number, note?: string): string {
    const s = SECTION_TITLES[no - 1];
    return `<h2 class="sec-title" style="margin-top:28px;">${no}. ${esc(s.title)} ${srcChip(s.src)}${note ? ` <span style="font-size:8.5px;color:${T.slate};letter-spacing:.5px;text-transform:none;">— ${esc(note)}</span>` : ''}</h2>`;
}

function tocSection(): string {
    const items = SECTION_TITLES.map((s, i) =>
        `<li style="display:flex;align-items:baseline;gap:8px;padding:3px 0;border-bottom:1px solid ${T.line};">
            <span style="font-family:'JetBrains Mono',monospace;font-size:11px;color:${T.cyan};font-weight:700;min-width:22px;">${i + 1}.</span>
            <span style="font-size:11px;color:${T.text};flex:1;">${esc(s.title)}</span>
            ${srcChip(s.src)}
        </li>`,
    ).join('');
    return `<section class="block">
        <h2 class="sec-title">Contents</h2>
        <ol style="list-style:none;margin:0;padding:0;">${items}</ol>
        <p style="font-size:9px;color:${T.slate};margin:6px 0 0;">
            <b style="color:${T.emerald};">LIVE-WIRED</b> = computed from this project's inputs (IT load, CAPEX, program months, tracking log).
            <b style="color:${T.slate};">STANDARD PRACTICE</b> = reference playbooks &amp; frameworks (screening, not project-specific).
        </p>
    </section>`;
}

/* ── shared building blocks ────────────────────────────────────────────── */

/** One deliverable playbook as a process card: purpose → trigger → owner /
 *  approver / cycle-time → hold-impact, plus the LIVE program window and the
 *  LIVE expected volume when the engine scales one for this deliverable. */
function playbookCard(dlv: DgDeliverable, win?: DgWindow, volumeLine?: string): string {
    const kv = (label: string, val: string, color: string = T.text) =>
        `<div style="flex:1;min-width:130px;">
            <div style="font-size:8px;text-transform:uppercase;letter-spacing:.8px;color:${T.muted};">${esc(label)}</div>
            <div style="font-size:9.5px;color:${color};margin-top:1px;">${esc(val)}</div>
        </div>`;
    return `<div style="page-break-inside:avoid;border:1px solid ${T.line};border-radius:8px;background:${T.surface};padding:11px 13px;margin:0 0 10px;">
        <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;border-bottom:1px solid ${T.line};padding-bottom:5px;margin-bottom:7px;">
            <h3 style="font-size:11.5px;font-weight:800;color:${T.text};margin:0;">${esc(dlv.name)}</h3>
            <span style="font-size:9px;color:${T.cyan};font-family:'JetBrains Mono',monospace;">${esc(dlv.standard)}</span>
            <span style="margin-left:auto;font-size:10px;font-weight:800;color:${T.amber};font-family:'JetBrains Mono',monospace;">cycle ${qtyFmt(dlv.cycleDays)} d</span>
        </div>
        <p style="font-size:10px;line-height:1.55;color:${T.text};margin:0 0 6px;">${esc(dlv.purpose)}</p>
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:6px;">
            ${kv('Trigger', dlv.trigger)}
            ${kv('Owner', dlv.owner)}
            ${kv('Approver', dlv.approver)}
            ${win ? kv('Program window', `${win.window} — ${win.note}`, T.cyan) : ''}
        </div>
        ${volumeLine ? `<div style="font-size:9.5px;color:${T.emerald};margin:0 0 6px;font-family:'JetBrains Mono',monospace;">${esc(volumeLine)} <span style="font-size:8px;color:${T.slate};font-family:'IBM Plex Sans',sans-serif;">LIVE · screening band</span></div>` : ''}
        <div style="border-left:2px solid ${T.fault};padding:4px 9px;background:rgba(248,113,113,0.06);border-radius:0 6px 6px 0;">
            <span style="font-size:8px;text-transform:uppercase;letter-spacing:.8px;color:${T.fault};font-weight:800;">If it stalls</span>
            <div style="font-size:9.5px;color:${T.muted};line-height:1.5;margin-top:1px;">${esc(dlv.holdImpact)}</div>
        </div>
    </div>`;
}

function deliverableOf(g: DgResult, key: string): DgDeliverable | undefined {
    return g.deliverables.find((d) => d.key === key);
}

function windowOf(g: DgResult, key: string): DgWindow | undefined {
    return g.windows.find((w) => w.key === key);
}

/** Simple key/value stat tile (BoqDossier mini-stat idiom). */
function stat(label: string, value: string): string {
    return `<div class="mini-stat"><div class="mini-k">${esc(label)}</div><div class="mini-v">${esc(value)}</div></div>`;
}

/* ── sections ──────────────────────────────────────────────────────────── */

function coverSection(m: DeliveryGovernanceModel): string {
    const p = m.projectMeta;
    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const cell = (label: string, value: string) =>
        `<div style="flex:1;min-width:120px;">
            <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:${T.muted};">${esc(label)}</div>
            <div style="font-size:13px;font-weight:700;color:${T.text};margin-top:2px;font-family:'JetBrains Mono',monospace;">${esc(value)}</div>
        </div>`;
    return `<section class="cover">
        <div style="font-size:10px;letter-spacing:3px;text-transform:uppercase;color:${T.cyan};">DC-OS · Delivery Governance Dossier</div>
        <h1 style="font-size:28px;font-weight:800;color:${T.text};margin:8px 0 4px;line-height:1.15;">Delivery Governance<br><span style="font-size:15px;font-weight:600;color:${T.muted};">Construction Delivery — Documents, Decisions &amp; Controls</span></h1>
        ${secHead(1)}
        <div style="display:flex;flex-wrap:wrap;gap:16px;margin:14px 0 14px;padding:14px 16px;border:1px solid ${T.line};border-radius:12px;background:${T.surface};">
            ${cell('Project', p.projectName || 'Untitled Project')}
            ${cell('Location', p.location)}
            ${cell('IT Capacity', `${p.itMw.toLocaleString()} MW`)}
            ${cell('Tier', p.tierLevel ? `Tier ${p.tierLevel}` : '—')}
            ${cell('Generated', dateStr)}
        </div>
        <div style="display:flex;align-items:center;gap:14px;padding:16px 18px;border-radius:4px;background:${T.surface};border:1px solid ${T.line};border-left:3px solid ${T.amber};">
            <div style="flex:1;">
                <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:${T.muted};">Program Under Governance</div>
                <div style="font-size:30px;font-weight:800;color:${T.amber};font-family:'JetBrains Mono',monospace;line-height:1.1;">${money(p.capexUsd)} <span style="font-size:16px;color:${T.text};">· ${qtyFmt(p.totalMonths)} months</span></div>
            </div>
            <div style="text-align:right;font-size:10px;color:${T.muted};line-height:1.6;">
                CAPEX = decision-band basis<br>Program = window basis<br>
                <span style="color:${T.slate};">screening-grade</span>
            </div>
        </div>
    </section>`;
}

function execSummarySection(m: DeliveryGovernanceModel): string {
    const p = m.projectMeta;
    const g = m.governance;
    const v = g.volumes;
    const phases = m.schedule?.rows.length ?? 0;
    const bandsWith$ = g.decisionBands.filter((b) => b.usdBand);
    const loBand = bandsWith$[0]?.usdBand ?? '—';
    const hiBand = bandsWith$[bandsWith$.length - 1]?.usdBand ?? '—';
    const mwStr = `${p.itMw.toLocaleString()} MW`;
    return `<section class="block">
        ${secHead(2)}
        <div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:12px;">
            ${stat('Expected RFIs', `≈${qtyFmt(v.rfi)}`)}
            ${stat('Submittals', `≈${qtyFmt(v.submittal)}`)}
            ${stat('ITPs', `≈${qtyFmt(v.itp)}`)}
            ${stat('NCRs', `≈${qtyFmt(v.ncr)}`)}
            ${stat('Variations', `≈${qtyFmt(v.variation)}`)}
            ${stat('Punch items', `≈${qtyFmt(v.punchlist)}`)}
        </div>
        <p style="font-size:10.5px;line-height:1.7;color:${T.text};margin:0 0 8px;">
            Delivery governance for this build is the control system over a
            <b style="color:${T.amber};">${money(p.capexUsd)}</b>, <b>${esc(mwStr)}</b> IT program delivered across
            <b>${qtyFmt(p.totalMonths)} months</b>${phases ? ` in <b>${phases}</b> engine-scheduled phases` : ''}${p.tierLevel ? ` to a Tier ${p.tierLevel} availability basis` : ''}.
            It is not paperwork for its own sake: every document family below (IFC, RFI, submittal, ITP, NCR, look-ahead,
            variation, punch list, turnover) exists to move a <i>decision</i> — freeze the design, resolve an ambiguity,
            release a fabrication, witness a quality point, price a change — before the work-front reaches the gap.
        </p>
        <p style="font-size:10.5px;line-height:1.7;color:${T.text};margin:0 0 8px;">
            At this scale the engine screens <b style="color:${T.emerald};">≈${qtyFmt(v.rfi)} RFIs</b>,
            <b style="color:${T.emerald};">≈${qtyFmt(v.submittal)} submittals</b> and
            <b style="color:${T.emerald};">≈${qtyFmt(v.variation)} variations</b> over the program — volumes that make
            cycle-time discipline (7-day RFI turnaround, 14-day submittal review, 21-day variation pricing) a schedule input,
            not an administrative preference. Commercial authority is tiered by delegation bands scaled to this project's
            CAPEX: field clarifications settle in 2 days at the resident engineer; variations route from
            <b style="color:${T.amber};">${esc(loBand)}</b> (Owner PM, 10 days) up to
            <b style="color:${T.amber};">${esc(hiBand)}</b> (steering committee, 30 days).
        </p>
        <p style="font-size:10.5px;line-height:1.7;color:${T.muted};margin:0;">
            Sections tagged <b style="color:${T.emerald};">LIVE-WIRED</b> are computed from the current project inputs and
            re-scale when the CAPEX, IT load or program changes; sections tagged
            <b style="color:${T.slate};">STANDARD PRACTICE</b> are the reference governance playbooks (ISO 19650, FIDIC,
            ISO 9001, Last-Planner) that the live numbers plug into. Volumes are screening rules-of-thumb — calibrate against
            the appointed EPC's document plan at contract award.
        </p>
    </section>`;
}

function contextSection(m: DeliveryGovernanceModel): string {
    const g = m.governance;
    const sched = m.schedule;
    const phaseRows = (sched?.rows ?? []).map((r, i) =>
        `<tr${i % 2 ? ` style="background:${T.surfaceAlt};"` : ''}>
            <td style="padding:5px 8px;font-size:10px;color:${T.text};">${esc(r.label)}</td>
            <td style="padding:5px 8px;font-size:10px;text-align:right;font-family:'JetBrains Mono',monospace;color:${T.cyan};">M${qtyFmt(r.startMonth)} → M${qtyFmt(r.endMonth)}</td>
            <td style="padding:5px 8px;font-size:10px;text-align:right;font-family:'JetBrains Mono',monospace;color:${T.muted};">${qtyFmt(r.months)} mo</td>
        </tr>`,
    ).join('');
    const accounts = g.pmFramework.controlAccounts.map((a) =>
        `<div style="display:flex;align-items:baseline;gap:8px;padding:4px 0;border-bottom:1px solid ${T.line};">
            <span style="color:${T.cyan};font-size:11px;line-height:1;">▪</span>
            <span style="font-size:10.5px;color:${T.text};">${esc(a)}</span>
        </div>`,
    ).join('');
    const statusNote = m.statusMonth == null
        ? `<b style="color:${T.slate};">Plan Mode</b> — no site actuals entered yet; the governance volumes and windows below are the baseline plan.`
        : `Tracking is live at <b style="color:${T.cyan};">M${qtyFmt(m.statusMonth)}</b> — the risk/issue log in §10 reflects the current site position.`;
    return `<section class="block">
        ${secHead(3, 'who governs what, over which program')}
        <div style="display:flex;gap:18px;flex-wrap:wrap;">
            <div style="flex:1.4;min-width:280px;">
                <h3 style="font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.7px;color:${T.cyan};margin:0 0 5px;">Program Phases ${srcChip('live')}</h3>
                ${sched?.rows.length ? `<table class="tbl">
                    <thead><tr><th style="text-align:left;">Phase</th><th style="text-align:right;">Window</th><th style="text-align:right;">Duration</th></tr></thead>
                    <tbody>${phaseRows}</tbody>
                </table>` : `<p style="font-size:10px;color:${T.muted};">Engine CPM schedule unavailable — total program ${qtyFmt(m.projectMeta.totalMonths)} months.</p>`}
            </div>
            <div style="flex:1;min-width:220px;">
                <h3 style="font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.7px;color:${T.cyan};margin:0 0 5px;">Control Accounts ${srcChip('standard')}</h3>
                ${accounts}
                <p style="font-size:9px;color:${T.slate};margin:6px 0 0;line-height:1.5;">
                    Each control account has ONE accountable owner, its own EVM baseline slice, and its own document streams —
                    a variation or NCR is always booked against an account, never "the project".
                </p>
            </div>
        </div>
        <p style="font-size:10px;line-height:1.6;color:${T.muted};margin:10px 0 0;">${statusNote}</p>
    </section>`;
}

function permitSection(m: DeliveryGovernanceModel): string {
    if (!m.permitting.length) return '';
    const PHASES: { key: string; label: string }[] = [
        { key: 'pre-construction', label: 'Pre-Construction' },
        { key: 'construction', label: 'Construction' },
        { key: 'energization', label: 'Energization & Connection' },
        { key: 'occupation-operation', label: 'Occupancy & Operation' },
    ];
    const row = (r: PermitRow, i: number) =>
        `<tr${i % 2 ? ` style="background:${T.surfaceAlt};"` : ''}>
            <td style="padding:5px 8px;font-size:10px;color:${T.text};font-weight:700;">${esc(r.permit)}</td>
            <td style="padding:5px 8px;font-size:9.5px;color:${T.muted};">${esc(r.authority)}</td>
            <td style="padding:5px 8px;font-size:9.5px;color:${T.muted};">${esc(r.purpose ?? r.standard)}</td>
            <td style="padding:5px 8px;font-size:10px;text-align:right;font-family:'JetBrains Mono',monospace;color:${T.cyan};">${qtyFmt(r.durationWk)} wk</td>
            <td style="padding:5px 8px;font-size:9.5px;color:${T.muted};">${esc(r.dependency)}</td>
            <td style="padding:5px 8px;text-align:center;">${riskChip(r.risk)}</td>
        </tr>`;
    const groups = PHASES.map((ph) => {
        const rows = m.permitting.filter((r) => (r.phase ?? 'pre-construction') === ph.key);
        if (!rows.length) return '';
        return `<div style="margin-top:12px;page-break-inside:avoid;">
            <h3 style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:${T.cyan};border-bottom:1px solid ${T.line};padding-bottom:3px;margin:0 0 4px;">${esc(ph.label)}</h3>
            <table class="tbl">
                <thead><tr>
                    <th style="text-align:left;">Permit</th><th style="text-align:left;">Authority</th>
                    <th style="text-align:left;">Purpose</th><th style="text-align:right;">Duration</th>
                    <th style="text-align:left;">Dependency</th><th style="text-align:center;">Risk</th>
                </tr></thead>
                <tbody>${rows.map(row).join('')}</tbody>
            </table>
        </div>`;
    }).join('');
    // The authority-pressure scenario from the PM framework — the hold case.
    const authorityScenario = m.governance.pmFramework.stakeholderPressure.find((s) => /authority/i.test(s.scenario));
    return `<section class="block">
        ${secHead(4, 'indicative reference — validate against the AHJ; statutory durations are jurisdiction-dependent')}
        ${groups}
        <div style="border-left:3px solid ${T.amber};background:rgba(255,170,0,0.07);border-radius:0 8px 8px 0;padding:9px 12px;margin-top:12px;">
            <p style="font-size:10px;line-height:1.6;color:${T.text};margin:0;">
                <b style="color:${T.amber};">Approval velocity is a schedule input.</b>
                ${esc(m.governance.pmFramework.decisionVelocity.note)}
            </p>
        </div>
        ${authorityScenario ? `<div style="border-left:3px solid ${T.fault};background:rgba(248,113,113,0.06);border-radius:0 8px 8px 0;padding:9px 12px;margin-top:8px;">
            <p style="font-size:10px;line-height:1.6;color:${T.text};margin:0;">
                <b style="color:${T.fault};">Hold scenario — ${esc(authorityScenario.scenario)}.</b>
                Response: ${esc(authorityScenario.response)}
                <span style="color:${T.muted};">Risk if mishandled: ${esc(authorityScenario.risk)}</span>
            </p>
        </div>` : ''}
    </section>`;
}

function designSection(m: DeliveryGovernanceModel): string {
    const g = m.governance;
    const p = m.projectMeta;
    const basisRows = m.designBasis.map((r, i) =>
        `<tr${i % 2 ? ` style="background:${T.surfaceAlt};"` : ''}>
            <td style="padding:5px 8px;font-size:10px;color:${T.text};font-weight:700;">${esc(r.discipline)}</td>
            <td style="padding:5px 8px;font-size:9.5px;color:${T.muted};">${esc(r.basis)}</td>
            <td style="padding:5px 8px;font-size:9.5px;font-family:'JetBrains Mono',monospace;color:${T.cyan};">${esc(r.standard)}</td>
        </tr>`,
    ).join('');
    const mkVol = (n: number, unit: string) =>
        `≈${qtyFmt(n)} ${unit} expected for this ${p.itMw.toLocaleString()} MW / ${qtyFmt(p.totalMonths)}-month program`;
    const cards = [
        { d: deliverableOf(g, 'ifc'), w: windowOf(g, 'ifc'), vol: undefined },
        { d: deliverableOf(g, 'rfi'), w: windowOf(g, 'rfi'), vol: mkVol(g.volumes.rfi, 'RFIs') },
        { d: deliverableOf(g, 'submittal'), w: windowOf(g, 'submittal'), vol: mkVol(g.volumes.submittal, 'submittals') },
    ].filter((c) => c.d).map((c) => playbookCard(c.d!, c.w, c.vol)).join('');
    return `<section class="block">
        ${secHead(5, 'design basis + the three document flows that freeze and defend it')}
        ${m.designBasis.length ? `<h3 style="font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.7px;color:${T.cyan};margin:0 0 5px;">Design Basis ${srcChip('standard')}</h3>
        <table class="tbl">
            <thead><tr><th style="text-align:left;">Discipline</th><th style="text-align:left;">Basis</th><th style="text-align:left;">Standard</th></tr></thead>
            <tbody>${basisRows}</tbody>
        </table>` : ''}
        <h3 style="font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.7px;color:${T.cyan};margin:14px 0 6px;">Document Flows ${srcChip('mixed')}</h3>
        ${cards}
        <p style="font-size:9.5px;line-height:1.6;color:${T.muted};margin:4px 0 0;">
            Coordination watch-items: RFI aging &gt;10 open aging RFIs on one discipline is a design-coordination red flag;
            a rejected (code D) long-lead submittal restarts that item's lead-time clock — schedule the review resource
            BEFORE the vendor drawing lands, not after.
        </p>
    </section>`;
}

function qualitySection(m: DeliveryGovernanceModel): string {
    const g = m.governance;
    const p = m.projectMeta;
    const mkVol = (n: number, unit: string) =>
        `≈${qtyFmt(n)} ${unit} expected for this ${p.itMw.toLocaleString()} MW / ${qtyFmt(p.totalMonths)}-month program`;
    const cards = [
        { d: deliverableOf(g, 'itp'), w: windowOf(g, 'itp'), vol: mkVol(g.volumes.itp, 'ITPs') },
        { d: deliverableOf(g, 'ncr'), w: windowOf(g, 'ncr'), vol: mkVol(g.volumes.ncr, 'NCRs') },
    ].filter((c) => c.d).map((c) => playbookCard(c.d!, c.w, c.vol)).join('');
    return `<section class="block">
        ${secHead(6, 'H/W/S witness points + non-conformance disposition')}
        ${cards}
        <p style="font-size:9.5px;line-height:1.6;color:${T.muted};margin:4px 0 0;">
            ITP notation: <b style="color:${T.text};">H</b> = hold (work stops until witnessed) ·
            <b style="color:${T.text};">W</b> = witness (notified, may proceed) ·
            <b style="color:${T.text};">S</b> = surveillance. NCR dispositions (rework / repair / use-as-is) require
            engineering justification on file — use-as-is without the EOR's sign-off is a latent-defect liability.
            NCR count is tracked to ZERO before each system turnover package (§11).
        </p>
    </section>`;
}

function scheduleGovSection(m: DeliveryGovernanceModel): string {
    const g = m.governance;
    const lookahead = deliverableOf(g, 'lookahead');
    const rhythmRows = g.pmFramework.reportingRhythm.map((r, i) =>
        `<tr${i % 2 ? ` style="background:${T.surfaceAlt};"` : ''}>
            <td style="padding:5px 8px;font-size:10px;color:${T.text};font-weight:700;">${esc(r.cadence)}</td>
            <td style="padding:5px 8px;font-size:9.5px;color:${T.muted};">${esc(r.artifact)}</td>
            <td style="padding:5px 8px;font-size:9.5px;color:${T.muted};">${esc(r.audience)}</td>
        </tr>`,
    ).join('');
    const bandRows = g.decisionBands.map((b, i) =>
        `<tr${i % 2 ? ` style="background:${T.surfaceAlt};"` : ''}>
            <td style="padding:5px 8px;font-size:10px;color:${T.text};">${esc(b.decision)}</td>
            <td style="padding:5px 8px;font-size:9.5px;color:${T.muted};">${esc(b.authority)}</td>
            <td style="padding:5px 8px;font-size:10px;text-align:right;font-family:'JetBrains Mono',monospace;color:${b.usdBand ? T.amber : T.muted};font-weight:${b.usdBand ? 700 : 400};">${esc(b.usdBand ?? '—')}</td>
            <td style="padding:5px 8px;font-size:10px;text-align:right;font-family:'JetBrains Mono',monospace;color:${T.cyan};">${qtyFmt(b.targetDays)} d</td>
        </tr>`,
    ).join('');
    return `<section class="block">
        ${secHead(7, 'Last-Planner rhythm + EVM reporting + delegation-of-authority bands')}
        ${lookahead ? playbookCard(lookahead, windowOf(g, 'lookahead')) : ''}
        <div style="display:flex;gap:18px;flex-wrap:wrap;margin-top:8px;">
            <div style="flex:1;min-width:280px;">
                <h3 style="font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.7px;color:${T.cyan};margin:0 0 5px;">Reporting Rhythm (EVM) ${srcChip('standard')}</h3>
                <table class="tbl">
                    <thead><tr><th style="text-align:left;">Cadence</th><th style="text-align:left;">Artifact</th><th style="text-align:left;">Audience</th></tr></thead>
                    <tbody>${rhythmRows}</tbody>
                </table>
            </div>
            <div style="flex:1.2;min-width:300px;">
                <h3 style="font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.7px;color:${T.cyan};margin:0 0 5px;">Decision-Velocity Bands ${srcChip('live')} <span style="font-size:8px;color:${T.slate};letter-spacing:.3px;text-transform:none;font-weight:600;">— $-bands scaled to this project's CAPEX</span></h3>
                <table class="tbl">
                    <thead><tr><th style="text-align:left;">Decision</th><th style="text-align:left;">Authority</th><th style="text-align:right;">$ Band</th><th style="text-align:right;">Target</th></tr></thead>
                    <tbody>${bandRows}</tbody>
                </table>
            </div>
        </div>
        <p style="font-size:9.5px;line-height:1.6;color:${T.muted};margin:8px 0 0;">
            Percent-plan-complete (PPC) below ~60% on the weekly look-ahead predicts slip before SPI shows it.
            ${esc(g.pmFramework.decisionVelocity.note)}
        </p>
    </section>`;
}

function commercialSection(m: DeliveryGovernanceModel): string {
    const g = m.governance;
    const p = m.projectMeta;
    const variation = deliverableOf(g, 'variation');
    const vol = `≈${qtyFmt(g.volumes.variation)} variations expected for this ${p.itMw.toLocaleString()} MW / ${qtyFmt(p.totalMonths)}-month program`;
    const pressureRows = g.pmFramework.stakeholderPressure.map((s, i) =>
        `<tr${i % 2 ? ` style="background:${T.surfaceAlt};"` : ''}>
            <td style="padding:5px 8px;font-size:10px;color:${T.text};font-weight:700;">${esc(s.scenario)}</td>
            <td style="padding:5px 8px;font-size:9.5px;color:${T.muted};">${esc(s.response)}</td>
            <td style="padding:5px 8px;font-size:9.5px;color:${T.fault};">${esc(s.risk)}</td>
        </tr>`,
    ).join('');
    return `<section class="block">
        ${secHead(8, 'variation control + pressure scenarios — how budgets actually die')}
        ${variation ? playbookCard(variation, windowOf(g, 'variation'), vol) : ''}
        <h3 style="font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.7px;color:${T.cyan};margin:10px 0 5px;">Stakeholder-Pressure Scenarios ${srcChip('standard')}</h3>
        <table class="tbl">
            <thead><tr><th style="text-align:left;">Scenario</th><th style="text-align:left;">Governed Response</th><th style="text-align:left;">Risk if Mishandled</th></tr></thead>
            <tbody>${pressureRows}</tbody>
        </table>
        <p style="font-size:9.5px;line-height:1.6;color:${T.muted};margin:8px 0 0;">
            Authority routing for each variation follows the $-bands in §7 (scaled to the ${money(p.capexUsd)} CAPEX).
            The commercial failure mode is rarely one big change — it is the aggregation of un-processed "small" field
            instructions surfacing as a disputed account at closeout.
        </p>
    </section>`;
}

function securitySection(m: DeliveryGovernanceModel): string {
    const rows = m.governance.pmFramework.securityExposure.map((s, i) =>
        `<tr${i % 2 ? ` style="background:${T.surfaceAlt};"` : ''}>
            <td style="padding:5px 8px;font-size:10px;color:${T.text};font-weight:700;">${esc(s.area)}</td>
            <td style="padding:5px 8px;font-size:9.5px;color:${T.muted};">${esc(s.exposure)}</td>
            <td style="padding:5px 8px;font-size:9.5px;color:${T.emerald};">${esc(s.control)}</td>
        </tr>`,
    ).join('');
    return `<section class="block">
        ${secHead(9, 'security-minded delivery — ISO 19650-5 posture during construction')}
        <table class="tbl">
            <thead><tr><th style="text-align:left;">Area</th><th style="text-align:left;">Exposure</th><th style="text-align:left;">Control</th></tr></thead>
            <tbody>${rows}</tbody>
        </table>
    </section>`;
}

function riskDollarBand(band: [number, number] | undefined, capex: number): string {
    if (!band || !Number.isFinite(capex) || capex <= 0) return '—';
    return `${money(band[0] * capex)}–${money(band[1] * capex)}`;
}

function riskSection(m: DeliveryGovernanceModel): string {
    const capex = m.projectMeta.capexUsd;
    const regRows = m.riskRegister.map((r, i) =>
        `<tr${i % 2 ? ` style="background:${T.surfaceAlt};"` : ''}>
            <td style="padding:5px 8px;font-size:10px;font-family:'JetBrains Mono',monospace;color:${T.cyan};font-weight:700;">${esc(r.id)}</td>
            <td style="padding:5px 8px;font-size:10px;color:${T.text};">${esc(r.risk)}</td>
            <td style="padding:5px 8px;text-align:center;">${riskChip(r.probability)}</td>
            <td style="padding:5px 8px;text-align:center;">${riskChip(r.impact)}</td>
            <td style="padding:5px 8px;font-size:9.5px;text-align:right;font-family:'JetBrains Mono',monospace;color:${r.costImpactPctBand ? T.amber : T.muted};">${esc(riskDollarBand(r.costImpactPctBand, capex))}</td>
            <td style="padding:5px 8px;font-size:10px;text-align:right;font-family:'JetBrains Mono',monospace;color:${(r.scheduleSlipWk ?? 0) > 0 ? T.fault : T.muted};">${Number.isFinite(r.scheduleSlipWk) ? qtyFmt(r.scheduleSlipWk!) : '—'}</td>
            <td style="padding:5px 8px;font-size:9.5px;color:${T.muted};">${esc(r.mitigation)}</td>
            <td style="padding:5px 8px;font-size:9px;color:${T.slate};font-style:italic;">${esc(r.earlyWarning ?? '—')}</td>
        </tr>`,
    ).join('');
    const liveRiskRows = m.liveRisks.map((r, i) =>
        `<tr${i % 2 ? ` style="background:${T.surfaceAlt};"` : ''}>
            <td style="padding:5px 8px;font-size:10px;color:${T.text};">${esc(r.risk)}${r.isExample ? ` <span style="font-size:7.5px;font-weight:800;color:${T.amber};letter-spacing:.4px;">EXAMPLE</span>` : ''}</td>
            <td style="padding:5px 8px;text-align:center;">${riskChip(liveBand(r.impact))}</td>
            <td style="padding:5px 8px;text-align:center;">${riskChip(liveBand(r.probability))}</td>
            <td style="padding:5px 8px;font-size:9.5px;color:${T.muted};text-transform:uppercase;letter-spacing:.4px;text-align:center;">${esc(r.status)}</td>
        </tr>`,
    ).join('');
    const liveIssueRows = m.liveIssues.map((i2, i) =>
        `<tr${i % 2 ? ` style="background:${T.surfaceAlt};"` : ''}>
            <td style="padding:5px 8px;font-size:10px;color:${T.text};">${esc(i2.title)}${i2.isExample ? ` <span style="font-size:7.5px;font-weight:800;color:${T.amber};letter-spacing:.4px;">EXAMPLE</span>` : ''}</td>
            <td style="padding:5px 8px;font-size:9.5px;color:${T.muted};text-transform:uppercase;letter-spacing:.4px;text-align:center;">${esc(i2.status.replace(/_/g, ' '))}</td>
            <td style="padding:5px 8px;font-size:9.5px;color:${T.muted};text-align:center;">${esc(i2.owner)}</td>
        </tr>`,
    ).join('');
    return `<section class="block">
        ${secHead(10, 'quantified register + the live project log')}
        ${m.riskRegister.length ? `<h3 style="font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.7px;color:${T.cyan};margin:0 0 5px;">Reference Risk Register ${srcChip('standard')} <span style="font-size:8px;color:${T.slate};letter-spacing:.3px;text-transform:none;font-weight:600;">— $-impact = screening %-of-CAPEX band × this project's ${money(capex)} total</span></h3>
        <table class="tbl">
            <thead><tr>
                <th style="text-align:left;">ID</th><th style="text-align:left;">Risk</th>
                <th style="text-align:center;">Prob.</th><th style="text-align:center;">Impact</th>
                <th style="text-align:right;">$-Impact</th><th style="text-align:right;">Slip (wk)</th>
                <th style="text-align:left;">Mitigation</th><th style="text-align:left;">Early Warning</th>
            </tr></thead>
            <tbody>${regRows}</tbody>
        </table>` : ''}
        <div style="display:flex;gap:18px;flex-wrap:wrap;margin-top:14px;">
            <div style="flex:1.2;min-width:280px;">
                <h3 style="font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.7px;color:${T.emerald};margin:0 0 5px;">Tracked Risks — live project log ${srcChip('live')}</h3>
                ${m.liveRisks.length ? `<table class="tbl">
                    <thead><tr><th style="text-align:left;">Risk</th><th style="text-align:center;">Impact</th><th style="text-align:center;">Prob.</th><th style="text-align:center;">Status</th></tr></thead>
                    <tbody>${liveRiskRows}</tbody>
                </table>` : `<p style="font-size:10px;color:${T.muted};">No risks logged in the construction tracking store.</p>`}
            </div>
            <div style="flex:1;min-width:240px;">
                <h3 style="font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.7px;color:${T.emerald};margin:0 0 5px;">Tracked Issues — live project log ${srcChip('live')}</h3>
                ${m.liveIssues.length ? `<table class="tbl">
                    <thead><tr><th style="text-align:left;">Issue</th><th style="text-align:center;">Status</th><th style="text-align:center;">Owner</th></tr></thead>
                    <tbody>${liveIssueRows}</tbody>
                </table>` : `<p style="font-size:10px;color:${T.muted};">No issues logged in the construction tracking store.</p>`}
            </div>
        </div>
        <p style="font-size:9px;color:${T.slate};margin:8px 0 0;line-height:1.55;">
            The live log is user-entered in the Construction Engine tracking panel (rows marked EXAMPLE are seeds).
            Governance rule: every open live risk maps to an early-warning indicator and an owner; risk-register movement
            (new / retired / escalated) is a monthly steering-committee metric — a static register is a dead register.
        </p>
    </section>`;
}

function turnoverSection(m: DeliveryGovernanceModel): string {
    const g = m.governance;
    const p = m.projectMeta;
    const cards = [
        { d: deliverableOf(g, 'punchlist'), w: windowOf(g, 'punchlist'), vol: `≈${qtyFmt(g.volumes.punchlist)} punch items expected for this ${p.itMw.toLocaleString()} MW / ${qtyFmt(p.totalMonths)}-month program` },
        { d: deliverableOf(g, 'turnover'), w: windowOf(g, 'turnover'), vol: undefined },
    ].filter((c) => c.d).map((c) => playbookCard(c.d!, c.w, c.vol)).join('');
    const opsRows = m.opsReadiness.map((r, i) =>
        `<tr${i % 2 ? ` style="background:${T.surfaceAlt};"` : ''}>
            <td style="padding:5px 8px;font-size:10px;color:${T.text};">${esc(r.item)}</td>
            <td style="padding:5px 8px;font-size:9.5px;color:${T.muted};text-align:center;">${esc(r.owner)}</td>
            <td style="padding:5px 8px;font-size:9.5px;color:${T.muted};text-align:center;text-transform:uppercase;letter-spacing:.4px;">${esc(r.gate)}</td>
        </tr>`,
    ).join('');
    const handoverDocs = m.documentSchedule.filter((r) => /handover|commissioning/i.test(r.phase));
    const docRows = handoverDocs.map((r, i) =>
        `<tr${i % 2 ? ` style="background:${T.surfaceAlt};"` : ''}>
            <td style="padding:5px 8px;font-size:10px;color:${T.text};">${esc(r.deliverable)}</td>
            <td style="padding:5px 8px;font-size:9.5px;color:${T.muted};text-align:center;text-transform:capitalize;">${esc(r.phase)}</td>
            <td style="padding:5px 8px;font-size:9.5px;text-align:center;font-family:'JetBrains Mono',monospace;color:${T.cyan};">${esc(r.approver)}</td>
        </tr>`,
    ).join('');
    return `<section class="block">
        ${secHead(11, 'per-system walkdowns → assembled dossier → ops-readiness gates')}
        ${cards}
        <div style="display:flex;gap:18px;flex-wrap:wrap;margin-top:8px;">
            ${m.opsReadiness.length ? `<div style="flex:1.2;min-width:280px;">
                <h3 style="font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.7px;color:${T.cyan};margin:0 0 5px;">Ops-Readiness Gates ${srcChip('standard')}</h3>
                <table class="tbl">
                    <thead><tr><th style="text-align:left;">Item</th><th style="text-align:center;">Owner</th><th style="text-align:center;">Gate</th></tr></thead>
                    <tbody>${opsRows}</tbody>
                </table>
            </div>` : ''}
            ${handoverDocs.length ? `<div style="flex:1;min-width:260px;">
                <h3 style="font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.7px;color:${T.cyan};margin:0 0 5px;">Handover Deliverables ${srcChip('standard')}</h3>
                <table class="tbl">
                    <thead><tr><th style="text-align:left;">Deliverable</th><th style="text-align:center;">Phase</th><th style="text-align:center;">Approver</th></tr></thead>
                    <tbody>${docRows}</tbody>
                </table>
            </div>` : ''}
        </div>
        <p style="font-size:9.5px;line-height:1.6;color:${T.muted};margin:8px 0 0;">
            A-items block substantial completion (liquidated damages keep accruing); B-items do not.
            The turnover dossier is assembled <b style="color:${T.text};">progressively per system</b> from Cx completion
            onward — a dossier assembled in the last month of a ${qtyFmt(p.totalMonths)}-month program is the classic
            retention-money dispute.
        </p>
    </section>`;
}

function pmFrameworkSection(m: DeliveryGovernanceModel): string {
    const roles = m.governance.pmFramework.roles;
    const roleCard = (title: string, charter: string, accent: string) =>
        `<div style="flex:1;min-width:280px;border:1px solid ${T.line};border-left:3px solid ${accent};border-radius:0 8px 8px 0;background:${T.surface};padding:11px 13px;page-break-inside:avoid;">
            <h3 style="font-size:11px;font-weight:800;color:${accent};text-transform:uppercase;letter-spacing:.7px;margin:0 0 5px;">${esc(title)}</h3>
            <p style="font-size:10px;line-height:1.65;color:${T.text};margin:0;">${esc(charter)}</p>
        </div>`;
    return `<section class="block">
        ${secHead(12, 'who owns the system vs who owns the rhythm')}
        <div style="display:flex;gap:14px;flex-wrap:wrap;">
            ${roleCard('Senior PM — owns the governance system', roles.senior, T.amber)}
            ${roleCard('Intermediate PM — owns the execution rhythm', roles.intermediate, T.cyan)}
        </div>
        <p style="font-size:9.5px;line-height:1.6;color:${T.muted};margin:8px 0 0;">
            The reporting rhythm in §7 is the interface between the two charters: the intermediate PM produces the weekly
            aging/PPC/EVM-flash artifacts; the senior PM converts them into stage-gate and steering-committee decisions.
            Neither role reviews raw documents — both manage cycle-time and aging distributions.
        </p>
    </section>`;
}

function countryRiskSection(m: DeliveryGovernanceModel): string {
    if (!m.countryRisks.length) {
        return `<section class="block">
            ${secHead(13)}
            <p style="font-size:10px;color:${T.muted};">No country selected on the CAPEX inputs — select a country to derive the location hazard / grid / talent profile.</p>
        </section>`;
    }
    const rows = m.countryRisks.map((r, i) =>
        `<tr${i % 2 ? ` style="background:${T.surfaceAlt};"` : ''}>
            <td style="padding:5px 8px;font-size:10px;color:${T.text};font-weight:700;">${esc(r.hazard)}</td>
            <td style="padding:5px 8px;font-size:9.5px;font-family:'JetBrains Mono',monospace;color:${T.muted};">${esc(r.metric)}</td>
            <td style="padding:5px 8px;text-align:center;">${riskChip(r.severity)}</td>
            <td style="padding:5px 8px;font-size:9.5px;color:${T.muted};">${esc(r.mitigation)}</td>
            <td style="padding:5px 8px;font-size:9px;font-family:'JetBrains Mono',monospace;color:${T.cyan};">${esc(r.standard)}</td>
        </tr>`,
    ).join('');
    return `<section class="block">
        ${secHead(13, `derived live from ${m.projectMeta.location} — hazard / grid / talent profile (screening)`)}
        <table class="tbl">
            <thead><tr>
                <th style="text-align:left;">Hazard</th><th style="text-align:left;">Site Metric</th>
                <th style="text-align:center;">Severity</th><th style="text-align:left;">Mitigation</th>
                <th style="text-align:left;">Standard</th>
            </tr></thead>
            <tbody>${rows}</tbody>
        </table>
    </section>`;
}

function disclaimerSection(m: DeliveryGovernanceModel): string {
    return `<section class="block">
        <div style="border-left:3px solid ${T.fault};background:rgba(248,113,113,0.07);border-radius:0 10px 10px 0;padding:12px 14px;">
            <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:${T.fault};margin-bottom:5px;">Disclaimer — Screening / Standard-Practice Reference</div>
            <p style="font-size:10px;line-height:1.65;color:${T.text};margin:0 0 6px;">
                <b style="color:${T.emerald};">LIVE-WIRED</b> figures (document volumes, decision $-bands, program windows,
                country risks, tracked risks/issues) are computed from this project's current inputs
                (${m.projectMeta.itMw.toLocaleString()} MW · ${money(m.projectMeta.capexUsd)} · ${qtyFmt(m.projectMeta.totalMonths)} mo)
                using screening rules-of-thumb — order-of-magnitude planning bands, not a contract document plan.
                <b style="color:${T.slate};">STANDARD PRACTICE</b> content (playbooks, control accounts, reporting rhythm,
                security posture, role charters, permitting matrix) is a reference model of advanced delivery-governance
                practice (ISO 19650, FIDIC, ISO 9001, Last-Planner) — calibrate to the executed contract, the appointed EPC's
                management plan, and the AHJ.
            </p>
            <p style="font-size:9.5px;line-height:1.6;color:${T.muted};margin:0;">
                Method: ${esc(m.governance.method)}. Not a quotation, tender, or legal/contractual advice.
            </p>
        </div>
    </section>`;
}

/* ── document assembly ─────────────────────────────────────────────────── */

/** Render the full delivery-governance dossier as a standalone HTML5 document. */
export function renderDeliveryGovernanceHTML(model: DeliveryGovernanceModel): string {
    const v = esc(model.projectMeta.version);
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Delivery Governance Dossier — ${esc(model.projectMeta.projectName || 'DC-OS')}</title>
    <style>
        @media print {
            body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
            @page { size:A4; margin:12mm 12mm; }
            .no-print { display:none !important; }
            .cover { page-break-inside:avoid; }
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
        section.block { margin:22px 0; }
        table.tbl { width:100%; border-collapse:collapse; }
        table.tbl thead th {
            font-size:9px; text-transform:uppercase; letter-spacing:.5px; color:${T.muted};
            padding:5px 8px; border-bottom:1px solid ${T.line}; font-weight:700;
        }
        table.tbl tbody td { border-bottom:1px solid ${T.line}; }
        .mini-stat { flex:1; min-width:110px; padding:9px 12px; border:1px solid ${T.line}; border-radius:10px; background:${T.surface}; }
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
    ${coverSection(model)}
    ${tocSection()}
    ${execSummarySection(model)}
    ${contextSection(model)}
    ${permitSection(model)}
    ${designSection(model)}
    ${qualitySection(model)}
    ${scheduleGovSection(model)}
    ${commercialSection(model)}
    ${securitySection(model)}
    ${riskSection(model)}
    ${turnoverSection(model)}
    ${pmFrameworkSection(model)}
    ${countryRiskSection(model)}
    ${disclaimerSection(model)}
    <footer>
        <span>SCREENING-GRADE · standard-practice reference · resistancezero.com · v${v}</span>
        <span>DC-OS · Delivery Governance Dossier · Construction Delivery Controls</span>
    </footer>
    </body></html>`;
}

/**
 * Open the delivery-governance dossier in a print window. Returns false when
 * the popup is blocked so the caller can alert the user.
 */
export function openDeliveryGovernanceDossier(model: DeliveryGovernanceModel): boolean {
    if (typeof window === 'undefined') return false;
    const w = window.open('', '_blank');
    if (!w) return false;
    w.document.write(renderDeliveryGovernanceHTML(model));
    w.document.close();
    return true;
}
