/* ─── EXECUTIVE DASHBOARD PDF ─────────────────────────────────────────────────
 * A super-complete report for the DC-OS Executive Overview: project roll-up KPIs
 * (engine-sourced), the 13-engine lifecycle status, and the Layer-13 AI Decision
 * read (recommendations + explainable rationale). Reuses the shared PdfUtils
 * primitives + the store→generator(props) pattern. Pure function.
 * ──────────────────────────────────────────────────────────────────────────── */

import {
    initDoc, savePdf, drawCoverPage, drawModernHeader, drawFooter,
    drawSectionTitle, drawKpiCard, drawParagraph, drawExecutiveBox, today,
    PDF_COLORS, type BrandingConfig,
} from '../PdfUtils';
import type { DecisionResult } from '@/lib/decision';

export interface DashboardReportData {
    project: string;
    country: string;
    itLoadKw: number;
    tier: number;
    redundancy: string;
    coolingType: string;
    pue: number;
    capex?: { total: number; perKw?: number; racks?: number; timelineMonths?: number };
    engines: { num: number; label: string; status: 'engine' | 'partial' | 'local' }[];
    decision: DecisionResult | null;
}

const MARGIN = 14;
/** autoTable augments the doc with lastAutoTable.finalY at runtime. */
const lastY = (doc: unknown): number | undefined =>
    (doc as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY;
const usd = (n: number) => n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${Math.round(n)}`;

export const generateDashboardPDF = async (data: DashboardReportData, branding?: BrandingConfig) => {
    const { doc, autoTable } = await initDoc(branding);
    const pageW = doc.internal.pageSize.width;
    let page = 1;

    // ── Cover ──
    drawCoverPage(doc, 'Executive Overview', 'DC-OS · Data Center Intelligence Platform', {
        client: `${data.project} — ${data.country}`,
        date: today(),
        version: 'DC-OS',
        confidential: true,
    }, branding);

    // ── Page 2: roll-up ──
    doc.addPage(); page++;
    drawModernHeader(doc, 'Project Roll-up', `${data.country} · Tier ${data.tier} · ${(data.itLoadKw / 1000).toFixed(1)} MW`, branding);
    let y = 40;
    y = drawSectionTitle(doc, y, 'Key Performance Indicators', '1', branding);

    const cardW = (pageW - MARGIN * 2 - 8) / 3;
    const cardH = 22;
    const kpis: [string, string, string, [number, number, number]][] = [
        ['IT Load', `${(data.itLoadKw / 1000).toFixed(1)} MW`, `${data.itLoadKw.toLocaleString()} kW`, PDF_COLORS.info],
        ['Tier', `Tier ${data.tier}`, data.redundancy, PDF_COLORS.accent],
        ['Total CAPEX', data.capex ? usd(data.capex.total) : '—', data.capex?.perKw ? `${usd(data.capex.perKw)}/kW` : 'not computed', PDF_COLORS.secondary],
        ['PUE (design)', data.pue.toFixed(2), data.coolingType, PDF_COLORS.primary],
        ['Racks', data.capex?.racks != null ? String(data.capex.racks) : '—', 'engine', PDF_COLORS.info],
        ['Build Timeline', data.capex?.timelineMonths != null ? `${data.capex.timelineMonths} mo` : '—', 'engine', PDF_COLORS.warning],
    ];
    kpis.forEach((k, i) => {
        const col = i % 3, row = Math.floor(i / 3);
        drawKpiCard(doc, MARGIN + col * (cardW + 4), y + row * (cardH + 4), cardW, cardH, k[0], k[1], k[2], k[3]);
    });
    y += 2 * (cardH + 4) + 6;

    // ── 13-engine lifecycle status ──
    y = drawSectionTitle(doc, y, 'Lifecycle Engine Status', '2', branding);
    autoTable(doc, {
        startY: y,
        head: [['#', 'Engine', 'Calculation source']],
        body: data.engines.map((e) => [
            String(e.num), e.label,
            e.status === 'engine' ? 'Engine-sourced (shared RZEngine/FINEngine)'
                : e.status === 'partial' ? 'Partly engine-sourced'
                    : 'Scheduled (engine wiring in progress)',
        ]),
        theme: 'striped',
        headStyles: { fillColor: PDF_COLORS.slate900 },
        styles: { fontSize: 8, cellPadding: 1.5 },
        margin: { left: MARGIN, right: MARGIN },
    });
    y = (lastY(doc) ?? y + 60) + 8;

    // ── AI Decision ──
    if (y > 240) { drawFooter(doc, page, branding); doc.addPage(); page++; drawModernHeader(doc, 'AI Decision', '', branding); y = 40; }
    y = drawSectionTitle(doc, y, 'AI Decision Engine (Layer 13)', '3', branding);
    if (data.decision) {
        y = drawExecutiveBox(doc, y, 'Recommendation', data.decision.summary, data.decision.metrics.feasible ? 'success' : 'warning');
        if (data.decision.recommendations.length) {
            data.decision.recommendations.forEach((r) => {
                y = drawParagraph(doc, y, `• ${r.title} — ${r.detail}`);
                y += 1;
            });
        }
        if (data.decision.rationale.length) {
            y += 2;
            y = drawSectionTitle(doc, y, 'Rationale', '3.1', branding);
            autoTable(doc, {
                startY: y,
                head: [['Engine', 'Observation', 'Rule → Conclusion']],
                body: data.decision.rationale.map((s) => [s.engine, s.observation, `${s.rule} → ${s.conclusion}`]),
                theme: 'grid',
                headStyles: { fillColor: PDF_COLORS.slate900 },
                styles: { fontSize: 7.5, cellPadding: 1.5 },
                margin: { left: MARGIN, right: MARGIN },
            });
            y = (lastY(doc) ?? y + 40) + 6;
        }
        y = drawParagraph(doc, y, data.decision.disclaimer);
    } else {
        y = drawParagraph(doc, y, 'Run the engines to generate an AI decision read.');
    }

    // ── provenance footer note ──
    if (y > 250) { drawFooter(doc, page, branding); doc.addPage(); page++; y = 40; }
    y += 4;
    drawExecutiveBox(doc, y, 'Data provenance', 'Every figure is produced by the shared RZEngine / FINEngine (single source of truth) with its DATA.sources citation — DCMOC does not re-implement the math. Engineering guidance only; not investment or professional advice.', 'info');

    drawFooter(doc, page, branding);
    savePdf(doc, `DC-OS_Executive_Overview_${data.country.replace(/\s+/g, '_')}.pdf`);
};
