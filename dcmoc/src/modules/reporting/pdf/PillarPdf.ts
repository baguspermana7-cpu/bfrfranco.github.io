/* ─── Generic DC-OS pillar PDF report ─────────────────────────────────────────
 * One reusable generator for the new-engine pillar dashboards (Requirements /
 * Site / Architecture / Construction / Commissioning / Asset). Reuses the shared
 * PdfUtils primitives. Renders cover → KPIs → sections (tables) → provenance note.
 * ──────────────────────────────────────────────────────────────────────────── */

import {
    initDoc, savePdf, drawCoverPage, drawModernHeader, drawFooter,
    drawSectionTitle, drawKpiCard, drawParagraph, today, PDF_COLORS,
} from '../PdfUtils';

export interface PillarKpi { label: string; value: string; sub?: string; }
export interface PillarSection { title: string; head: string[]; rows: (string | number)[][]; }
export interface PillarCallout { title: string; body: string; tone?: 'info' | 'good' | 'warn'; }
export interface PillarAction { priority: 'HIGH' | 'MEDIUM' | 'LOW'; action: string; }
export interface PillarReport {
    title: string; layer: string; project: string;
    kpis: PillarKpi[]; sections: PillarSection[]; note?: string;
    /* v1.83+ PDF standard (opex-report reference) — all OPTIONAL/additive */
    config?: [string, string][];          // configuration table (all inputs)
    callouts?: PillarCallout[];           // tinted analysis boxes
    actions?: PillarAction[];             // prioritized action items
    summaryBand?: PillarKpi[];            // footer mini-KPI band
    orgName?: string;                     // from Settings
}

const MARGIN = 14;
const lastY = (doc: unknown): number | undefined => (doc as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY;

export async function generatePillarPDF(r: PillarReport & { legacyJsPdf?: boolean }): Promise<void> {
    /* orgName auto-resolves from Settings when the caller doesn't pass one */
    if (!r.orgName && typeof window !== 'undefined') {
        try {
            const { useSettingsStore } = await import('@/store/settings');
            const org = useSettingsStore.getState().general.orgName;
            if (org) r = { ...r, orgName: org };
        } catch { /* settings store absent — skip */ }
    }
    /* Min-standard render = print-window HTML (opex-report reference). The
     * jsPDF path below stays only as an explicit legacy fallback. */
    if (!r.legacyJsPdf) {
        const { openStandardReport } = await import('./PrintReport');
        if (openStandardReport(r)) return;
        // popup blocked → fall through to the jsPDF download path
    }
    const { doc, autoTable } = await initDoc();
    const pageW = doc.internal.pageSize.width;
    let page = 1;

    drawCoverPage(doc, r.title, `DC-OS · ${r.layer}`, { client: r.project, date: today(), version: 'DC-OS', confidential: true });

    doc.addPage(); page++;
    drawModernHeader(doc, r.title, r.layer);
    let y = 40;
    y = drawSectionTitle(doc, y, 'Key Metrics', '1');
    const cardW = (pageW - MARGIN * 2 - 8) / 3, cardH = 22;
    const palette = [PDF_COLORS.primary, PDF_COLORS.secondary, PDF_COLORS.accent, PDF_COLORS.info, PDF_COLORS.warning, PDF_COLORS.success];
    r.kpis.forEach((k, i) => {
        const col = i % 3, row = Math.floor(i / 3);
        drawKpiCard(doc, MARGIN + col * (cardW + 4), y + row * (cardH + 4), cardW, cardH, k.label, k.value, k.sub || '', palette[i % palette.length]);
    });
    y += Math.ceil(r.kpis.length / 3) * (cardH + 4) + 6;

    let n = 2;
    for (const s of r.sections) {
        if (y > 245) { drawFooter(doc, page, undefined); doc.addPage(); page++; drawModernHeader(doc, r.title, r.layer); y = 40; }
        y = drawSectionTitle(doc, y, s.title, String(n++));
        autoTable(doc, {
            startY: y, head: [s.head], body: s.rows,
            theme: 'striped', headStyles: { fillColor: PDF_COLORS.slate900 },
            styles: { fontSize: 8, cellPadding: 1.6 }, margin: { left: MARGIN, right: MARGIN },
        });
        y = (lastY(doc) ?? y + 40) + 8;
    }

    /* ── v1.83 PDF standard extras (optional) ── */
    if (r.config?.length) {
        if (y > 235) { drawFooter(doc, page); doc.addPage(); page++; drawModernHeader(doc, r.title, r.layer); y = 40; }
        y = drawSectionTitle(doc, y, 'Configuration', String(n++));
        autoTable(doc, {
            startY: y, head: [['Parameter', 'Value']], body: r.config,
            theme: 'plain', headStyles: { fillColor: PDF_COLORS.slate900 },
            styles: { fontSize: 8, cellPadding: 1.4 }, margin: { left: MARGIN, right: MARGIN },
        });
        y = (lastY(doc) ?? y + 30) + 8;
    }
    if (r.callouts?.length) {
        for (const c of r.callouts) {
            if (y > 245) { drawFooter(doc, page); doc.addPage(); page++; drawModernHeader(doc, r.title, r.layer); y = 40; }
            const tone = c.tone === 'good' ? [16, 185, 129] : c.tone === 'warn' ? [245, 158, 11] : [59, 130, 246];
            doc.setFillColor(tone[0], tone[1], tone[2]);
            doc.setDrawColor(tone[0], tone[1], tone[2]);
            doc.roundedRect(MARGIN, y, pageW - MARGIN * 2, 16, 2, 2, 'S');
            doc.setFontSize(9); doc.setTextColor(tone[0], tone[1], tone[2]);
            doc.text(c.title, MARGIN + 3, y + 5.5);
            doc.setFontSize(7.5); doc.setTextColor(71, 85, 105);
            doc.text(doc.splitTextToSize(c.body, pageW - MARGIN * 2 - 6), MARGIN + 3, y + 10.5); // audit-ok: PDF layout mm
            y += 20;
        }
    }
    if (r.actions?.length) {
        if (y > 235) { drawFooter(doc, page); doc.addPage(); page++; drawModernHeader(doc, r.title, r.layer); y = 40; }
        y = drawSectionTitle(doc, y, 'Prioritized Action Items', String(n++));
        autoTable(doc, {
            startY: y, head: [['Priority', 'Action']],
            body: r.actions.map((a) => [a.priority, a.action]),
            theme: 'striped', headStyles: { fillColor: PDF_COLORS.slate900 },
            styles: { fontSize: 8, cellPadding: 1.6 },
            columnStyles: { 0: { cellWidth: 22, fontStyle: 'bold' } },
            margin: { left: MARGIN, right: MARGIN },
        });
        y = (lastY(doc) ?? y + 30) + 8;
    }
    if (r.summaryBand?.length) {
        if (y > 245) { drawFooter(doc, page); doc.addPage(); page++; y = 40; }
        const bw = (pageW - MARGIN * 2 - (r.summaryBand.length - 1) * 3) / r.summaryBand.length;
        doc.setFillColor(15, 23, 42);
        doc.roundedRect(MARGIN, y, pageW - MARGIN * 2, 18, 2, 2, 'F');
        r.summaryBand.forEach((k, i) => {
            const x = MARGIN + i * (bw + 3);
            doc.setFontSize(8.5); doc.setTextColor(255, 255, 255);
            doc.text(String(k.value), x + bw / 2, y + 8, { align: 'center' });
            doc.setFontSize(5.5); doc.setTextColor(148, 163, 184);
            doc.text(k.label.toUpperCase(), x + bw / 2, y + 13.5, { align: 'center' }); // audit-ok: PDF layout mm
        });
        y += 24;
    }
    if (r.note) { if (y > 255) { drawFooter(doc, page); doc.addPage(); page++; y = 40; } y = drawParagraph(doc, y, r.note); }
    if (r.orgName) { doc.setFontSize(6.5); doc.setTextColor(148, 163, 184); doc.text(`Prepared for ${r.orgName} · DC-OS`, MARGIN, 287); }
    drawFooter(doc, page);
    savePdf(doc, `DC-OS_${r.title.replace(/\s+/g, '_')}.pdf`);
}
