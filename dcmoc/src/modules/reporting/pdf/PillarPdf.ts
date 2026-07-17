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
export interface PillarReport {
    title: string; layer: string; project: string;
    kpis: PillarKpi[]; sections: PillarSection[]; note?: string;
}

const MARGIN = 14;
const lastY = (doc: unknown): number | undefined => (doc as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY;

export async function generatePillarPDF(r: PillarReport): Promise<void> {
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

    if (r.note) { if (y > 255) { drawFooter(doc, page); doc.addPage(); page++; y = 40; } y = drawParagraph(doc, y, r.note); }
    drawFooter(doc, page);
    savePdf(doc, `DC-OS_${r.title.replace(/\s+/g, '_')}.pdf`);
}
